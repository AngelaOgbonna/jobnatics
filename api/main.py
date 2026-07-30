"""
Fairness-Aware Job Recommendation API (Jobnatics AI)
=====================================================
Backend for the MIT thesis "Algorithmic Bias in Job Recommendations:
A Fairness-Aware Ranking System".

Numbers in this file are the HELD-OUT (out-of-sample) validated results:
ThresholdOptimizer fit on 80%, evaluated on the held-out 20%, refit on
100% for the deployed models. Bootstrap pass-rates (1000 resamples)
accompany each point estimate.

Gender encoding (verified by pronoun analysis): 0 = male, 1 = female.
In Test B the UNDER-SELECTED group was male (gender 0).
"""

import os
import re
import pickle
import __main__
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.base import BaseEstimator
from fairlearn.metrics import (
    demographic_parity_difference,
    demographic_parity_ratio,
)
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.stem import PorterStemmer

nltk.download('stopwords', quiet=True)
nltk.download('punkt', quiet=True)
nltk.download('punkt_tab', quiet=True)

app = FastAPI(
    title="Fairness-Aware Job Recommendation API",
    description=(
        "Two-tier system: individual recommendations with match "
        "explanation, plus population-level batch fairness evaluation "
        "and correction. Fairness is a population-level property and is "
        "computed only where a group structure exists (batch endpoints)."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Constants ────────────────────────────────────────────────────────────────

BASE_THRESHOLD = 0.25

# Held-out (out-of-sample) validated results. Point estimates carry their
# bootstrap pass-rate (fraction of 1000 resamples clearing BOTH thresholds).
VALIDATED_FAIRNESS_METRICS = {
    "test_A_gender_balanced": {
        "before_correction": {"DPD": 0.0625, "DIR": 0.8718},
        "after_correction":  {"DPD": 0.0375, "DIR": 0.9231},
        "bootstrap_pass_rate": 0.737,
        "status": "PASS",
        "sample_size": 800,
        "held_out_size": 160,
        "note": "Control condition: balanced sample stays fair after correction.",
    },
    "test_B_gender_imbalanced": {
        "before_correction": {"DPD": 0.1891, "DIR": 0.6878},
        "after_correction":  {"DPD": 0.0296, "DIR": 0.9533},
        "bootstrap_pass_rate": 0.806,
        "status": "PASS after correction",
        "sample_size": 1000,
        "held_out_size": 200,
        "under_selected_group": "gender 0 (male)",
        "note": "Headline result: constructed gender violation corrected on held-out data.",
    },
    "test_C_profession_4groups": {
        "before_correction": {"DPD": 0.2100, "DIR": 0.6912},
        "after_correction":  {"DPD": 0.1200, "DIR": 0.7757},
        "bootstrap_pass_rate": 0.256,
        "status": "FAIL - correction improves disparity but does not achieve held-out compliance",
        "sample_size": 4000,
        "held_out_size": 800,
        "note": (
            "Four-group stress case. On held-out data the correction improves "
            "the disparity (DPD 0.2100->0.1200, DIR 0.6912->0.7757) but does "
            "NOT clear both thresholds (DPD remains above 0.10, DIR below "
            "0.80). This demonstrates the structural limit of post-processing "
            "correction as the number of protected groups increases, "
            "converging with the intersectional finding. The full-sample "
            "refit (deployed model) reaches DPD 0.0110 / DIR 0.9766 in-sample."
        ),
    },
    "thresholds": {
        "DPD_threshold": 0.10,
        "DIR_threshold": 0.80,
        "similarity_threshold": BASE_THRESHOLD,
    },
    "gender_encoding": {
        "0": "male",
        "1": "female",
        "note": (
            "Verified by pronoun analysis. In Test B the under-selected "
            "group was male (gender 0); correction raised the male selection "
            "rate to parity."
        ),
    },
    "evaluation_note": (
        "Metrics validated out-of-sample on the held-out 20% of Bias in Bios "
        "(De-Arteaga et al., 2019); fit on 80%, refit on 100% for deployment. "
        "Bootstrap pass-rates (1000 resamples) accompany point estimates. "
        "ThresholdOptimizer applied with the demographic_parity constraint. "
        "Only DPD and DIR are computed: EOD and Equalised Odds require a "
        "ground-truth qualification label absent from recommendation data."
    ),
}


# ── Custom estimator ──────────────────────────────────────────────────────────
# Must be defined before pickle loading so __main__ registration works.

class ScorePassthroughEstimator(BaseEstimator):
    """
    Wraps cosine similarity scores as a sklearn-compatible estimator.
    Inherits BaseEstimator for Scikit-learn 1.9+ compatibility.
    Registered in __main__ so saved pkl files can deserialise correctly.
    """

    def __init__(self, threshold: float = 0.25):
        self.threshold = threshold

    def fit(self, X, y):
        return self

    def predict(self, X):
        return (X.flatten() >= self.threshold).astype(int)

    def predict_proba(self, X):
        scores = X.flatten()
        return np.column_stack([1 - scores, scores])


# Register in __main__ so pickle can find it when loading saved optimizers.
__main__.ScorePassthroughEstimator = ScorePassthroughEstimator


# ── NLTK tools ─────────────────────────────────────────────────────────────────

stop_words = set(stopwords.words('english'))
stemmer = PorterStemmer()


# ── Global state ───────────────────────────────────────────────────────────────

df_jobs_pool = None
df_resumes_pool = None
optimizer_a = None
optimizer_b = None
optimizer_c = None

# Pre-fitted vectoriser + job matrix (fix: fit once, not per request).
job_vectoriser = None
job_matrix = None
job_feature_names = None


# ── Text preprocessing ─────────────────────────────────────────────────────────

def fix_glued_words(text: str) -> str:
    text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)
    text = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1 \2', text)
    return text


def preprocess_text(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = fix_glued_words(text)
    text = text.lower()
    text = re.sub(r'[^a-z\s]', ' ', text)
    tokens = word_tokenize(text)
    cleaned = [
        stemmer.stem(w) for w in tokens
        if w not in stop_words and len(w) > 2
    ]
    return " ".join(cleaned)


# ── Startup ──────────────────────────────────────────────────────────────────

@app.on_event("startup")
def load_all():
    global df_jobs_pool, df_resumes_pool
    global optimizer_a, optimizer_b, optimizer_c
    global job_vectoriser, job_matrix, job_feature_names

    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")

    # Load jobs
    jobs_path = os.path.join(data_dir, "jobs_clean.csv")
    if os.path.exists(jobs_path):
        df_jobs_pool = pd.read_csv(jobs_path, encoding="utf-8")
        if 'Job_Description_clean' not in df_jobs_pool.columns:
            df_jobs_pool['Job_Description_clean'] = (
                df_jobs_pool['Job Description'].apply(preprocess_text)
            )
        print(f"Loaded {len(df_jobs_pool)} jobs from jobs_clean.csv")
    else:
        print("WARNING: jobs_clean.csv not found. Using fallback data.")
        df_jobs_pool = pd.DataFrame({
            "Job Title": [
                "Data Analyst", "HR Manager",
                "Software Engineer", "Operations Manager",
            ],
            "Company": [
                "Tech Corp", "People Ltd",
                "Dev Solutions", "Logistics Inc",
            ],
            "location": ["Lagos", "Abuja", "Lagos", "Port Harcourt"],
            "skills": [
                "Python, SQL, statistics",
                "recruiting, payroll, relations",
                "Python, JavaScript, React",
                "logistics, budgets, metrics",
            ],
            "Job Description": [
                "Analyze data Python SQL dashboards statistics regression.",
                "Manage human resources recruiting talent relations payroll.",
                "Build software Python JavaScript React APIs deployment.",
                "Oversee logistics operations budgets performance metrics.",
            ],
        })
        df_jobs_pool['Job_Description_clean'] = (
            df_jobs_pool['Job Description'].apply(preprocess_text)
        )

    # Pre-fit the vectoriser ONCE on the job corpus (fix: was per-request).
    # This removes run-to-run score drift and the per-call refit cost.
    # Parameters MATCH the Colab evaluation (min_df=2, max_df=0.85) so API
    # scores are consistent with the thesis results. The guard drops to
    # min_df=1 only for the tiny fallback corpus, where min_df=2 is invalid
    # and exact score-matching is not claimed anyway.
    _min_df = 2 if len(df_jobs_pool) >= 10 else 1
    job_vectoriser = TfidfVectorizer(
        min_df=_min_df, max_df=0.85, ngram_range=(1, 2)
    )
    job_matrix = job_vectoriser.fit_transform(
        df_jobs_pool['Job_Description_clean'].tolist()
    )
    job_feature_names = job_vectoriser.get_feature_names_out()
    print(f"Vectoriser fitted once on {job_matrix.shape[0]} jobs, "
          f"{len(job_feature_names)} features.")

    # Load resumes
    resumes_path = os.path.join(data_dir, "resumes_clean.csv")
    if os.path.exists(resumes_path):
        df_resumes_pool = pd.read_csv(resumes_path, encoding="utf-8")
        print(f"Loaded {len(df_resumes_pool)} resumes from resumes_clean.csv")
    else:
        print("WARNING: resumes_clean.csv not found.")
        df_resumes_pool = pd.DataFrame()

    # Load saved ThresholdOptimizer models.
    for attr_name, filename in [
        ("optimizer_a", "threshold_optimizer_a.pkl"),
        ("optimizer_b", "threshold_optimizer_b.pkl"),
        ("optimizer_c", "threshold_optimizer_c.pkl"),
    ]:
        path = os.path.join(data_dir, filename)
        if os.path.exists(path):
            try:
                with open(path, "rb") as f:
                    model = pickle.load(f)
                globals()[attr_name] = model
                print(f"Loaded {filename}")
            except Exception as e:
                print(f"WARNING: Could not load {filename}: {e}")
        else:
            print(f"WARNING: {filename} not found.")

    print("Startup complete.")


# ── Helpers ────────────────────────────────────────────────────────────────────

def safe_field(row, col: str, default: str = "") -> str:
    """Return a row field as str, or default if the column is absent/NaN."""
    if col in row and pd.notna(row[col]):
        return str(row[col])
    return default


def rank_jobs(clean_resume: str) -> pd.DataFrame:
    """
    Rank the fixed job pool against a resume, using the PRE-FITTED vectoriser.
    The resume is transformed into the job corpus vocabulary (not refitted),
    so scores are stable across calls.
    """
    resume_vec = job_vectoriser.transform([clean_resume])
    scores = cosine_similarity(resume_vec, job_matrix).flatten()
    result = df_jobs_pool.copy()
    result['score'] = scores
    return result


def explain_match(clean_resume: str, job_row_index: int, top_n: int = 5):
    """
    Return the top contributing terms for a resume-job match.
    Uses the element-wise product of the two L2-normalised TF-IDF vectors,
    so each term's contribution to the cosine score is exact (not approximate).
    Satisfies the section 3.4.3 explainability requirement.
    """
    resume_vec = job_vectoriser.transform([clean_resume]).toarray().flatten()
    job_vec = job_matrix[job_row_index].toarray().flatten()
    contributions = resume_vec * job_vec
    if contributions.sum() == 0:
        return []  # zero-overlap guard
    top_idx = contributions.argsort()[-top_n:][::-1]
    return [
        {"term": str(job_feature_names[i]),
         "contribution": round(float(contributions[i]), 4)}
        for i in top_idx if contributions[i] > 0
    ]


# ── Request schemas ────────────────────────────────────────────────────────────

class ResumePayload(BaseModel):
    resume_text: str
    demographic_group: int = 0  # accepted for record-keeping; NOT used to
    # "correct" a single person (fairness is population-level).


class BatchCandidate(BaseModel):
    candidate_id: str
    resume_text: str
    demographic_group: int


class BatchPayload(BaseModel):
    candidates: List[BatchCandidate]


class JobPosting(BaseModel):
    job_title: str
    company: str
    job_description: str


# ── Endpoint 1: Health check ─────────────────────────────────────────────────

@app.get("/")
def health_check():
    return {
        "status": "running",
        "jobs_loaded": len(df_jobs_pool) if df_jobs_pool is not None else 0,
        "resumes_loaded": (
            len(df_resumes_pool) if df_resumes_pool is not None else 0
        ),
        "models_loaded": {
            "optimizer_a": optimizer_a is not None,
            "optimizer_b": optimizer_b is not None,
            "optimizer_c": optimizer_c is not None,
        },
        "endpoints": {
            "individual_match": "POST /api/match",
            "batch_match":       "POST /api/batch-match",
            "find_candidates":   "POST /api/find-candidates",
            "post_job":          "POST /api/post-job",
            "fairness_metrics":  "GET  /api/fairness-metrics",
        },
    }


# ── Endpoint 2: Fairness metrics dashboard ───────────────────────────────────

@app.get("/api/fairness-metrics")
def get_fairness_metrics():
    return {
        "system_fairness_evaluation": VALIDATED_FAIRNESS_METRICS,
        "models_loaded": {
            "optimizer_a_gender_balanced":   optimizer_a is not None,
            "optimizer_b_gender_imbalanced": optimizer_b is not None,
            "optimizer_c_profession_groups": optimizer_c is not None,
        },
        "description": (
            "Out-of-sample held-out metrics on Bias in Bios test populations. "
            "Tests A and B clear both fairness thresholds after correction. "
            "Test C (four groups) improves the disparity but does not clear "
            "both thresholds on held-out data, demonstrating the structural "
            "limit of post-processing correction as protected groups increase."
        ),
    }


# ── Endpoint 3: Individual match ─────────────────────────────────────────────

@app.post("/api/match")
def individual_match(payload: ResumePayload):
    """
    Individual recommendation for a jobseeker.

    IMPORTANT: no per-individual "fairness correction" is applied here.
    Demographic parity is a population-level property computed across people
    in different groups; a single resume has no group structure, so applying
    ThresholdOptimizer to one person's job list would be meaningless.
    Instead the seeker receives: their ranked matches, an exact explanation
    of WHY each was matched (top contributing terms), and the system's
    VALIDATED population-level fairness record.
    """
    if df_jobs_pool is None or df_jobs_pool.empty:
        raise HTTPException(status_code=500, detail="Job data not loaded.")

    try:
        clean_resume = preprocess_text(payload.resume_text)
        results = rank_jobs(clean_resume)
        results['recommended'] = (results['score'] >= BASE_THRESHOLD).astype(int)

        top = results.sort_values(by='score', ascending=False).head(10)

        recommendations = []
        for rank, (idx, row) in enumerate(top.iterrows(), start=1):
            recommendations.append({
                "rank": rank,
                "job_title": str(row['Job Title']),
                "company": str(row['Company']),
                "location": safe_field(row, 'location'),
                "skills": safe_field(row, 'skills'),
                "similarity_score": round(float(row['score']), 4),
                "recommended": bool(row['recommended']),
                "why_matched": explain_match(clean_resume, idx),
            })

        return {
            "candidate_demographic_group": payload.demographic_group,
            "ranking_source": "TF-IDF cosine similarity (base ranking)",
            "fairness_note": (
                "Fairness is evaluated at the population level, not per "
                "individual. Below is the system's validated fairness record."
            ),
            "recommendations": recommendations,
            "system_fairness_record": {
                "test_B_gender": {
                    "DPD_after": VALIDATED_FAIRNESS_METRICS
                    ["test_B_gender_imbalanced"]["after_correction"]["DPD"],
                    "DIR_after": VALIDATED_FAIRNESS_METRICS
                    ["test_B_gender_imbalanced"]["after_correction"]["DIR"],
                    "bootstrap_pass_rate": 0.806,
                    "status": "PASS after correction",
                },
                "note": (
                    "Population-level metrics from held-out validation. "
                    "Gender encoding: 0 = male, 1 = female."
                ),
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Endpoint 4: Batch match (HR) ─────────────────────────────────────────────

@app.post("/api/batch-match")
def batch_match(payload: BatchPayload):
    """
    Batch recommendation for HR. Multiple candidates across >=2 groups, so
    DPD/DIR ARE genuinely computable and correction genuinely applies.
    """
    if df_jobs_pool is None or df_jobs_pool.empty:
        raise HTTPException(status_code=500, detail="Job data not loaded.")

    if len(payload.candidates) < 4:
        raise HTTPException(
            status_code=400,
            detail="Batch requires at least 4 candidates (2 per group).",
        )

    groups_present = set(c.demographic_group for c in payload.candidates)
    if len(groups_present) < 2:
        raise HTTPException(
            status_code=400,
            detail="Batch requires candidates from at least 2 demographic groups.",
        )

    try:
        all_results = []
        for candidate in payload.candidates:
            clean_resume = preprocess_text(candidate.resume_text)
            ranked = rank_jobs(clean_resume)
            best_score = float(ranked['score'].max())
            best_row = ranked.loc[ranked['score'].idxmax()]
            all_results.append({
                "candidate_id": candidate.candidate_id,
                "demographic_group": candidate.demographic_group,
                "best_score": best_score,
                "top_job": str(best_row['Job Title']),
                "top_company": str(best_row['Company']),
                "base_outcome": int(best_score >= BASE_THRESHOLD),
            })

        df_batch = pd.DataFrame(all_results)

        dpd_before = float(demographic_parity_difference(
            y_true=df_batch['base_outcome'],
            y_pred=df_batch['base_outcome'],
            sensitive_features=df_batch['demographic_group'],
        ))
        dir_before = float(demographic_parity_ratio(
            y_true=df_batch['base_outcome'],
            y_pred=df_batch['base_outcome'],
            sensitive_features=df_batch['demographic_group'],
        ))

        violation = dpd_before > 0.10 or dir_before < 0.80
        correction_applied = False
        optimizer_used = "none"

        unique_groups = df_batch['demographic_group'].nunique()
        unique_outcomes = df_batch['base_outcome'].nunique()

        if violation and unique_outcomes > 1:
            if unique_groups == 2 and optimizer_b is not None:
                chosen = optimizer_b
                optimizer_used = "optimizer_b (gender imbalanced)"
            elif unique_groups > 2 and optimizer_c is not None:
                chosen = optimizer_c
                optimizer_used = "optimizer_c (profession groups)"
            elif optimizer_a is not None:
                chosen = optimizer_a
                optimizer_used = "optimizer_a (gender balanced, fallback)"
            else:
                chosen = None

            if chosen is not None:
                X = df_batch['best_score'].values.reshape(-1, 1)
                sensitive = df_batch['demographic_group'].values
                try:
                    df_batch['fair_outcome'] = chosen.predict(
                        X, sensitive_features=sensitive
                    )
                    correction_applied = True
                except Exception:
                    df_batch['fair_outcome'] = df_batch['base_outcome']
            else:
                df_batch['fair_outcome'] = df_batch['base_outcome']
        else:
            df_batch['fair_outcome'] = df_batch['base_outcome']

        dpd_after = float(demographic_parity_difference(
            y_true=df_batch['fair_outcome'],
            y_pred=df_batch['fair_outcome'],
            sensitive_features=df_batch['demographic_group'],
        ))
        dir_after = float(demographic_parity_ratio(
            y_true=df_batch['fair_outcome'],
            y_pred=df_batch['fair_outcome'],
            sensitive_features=df_batch['demographic_group'],
        ))

        return {
            "batch_size": len(payload.candidates),
            "fairness_correction_applied": correction_applied,
            "optimizer_used": optimizer_used,
            "gender_encoding": {"0": "male", "1": "female"},
            "fairness_metrics": {
                "before_correction": {
                    "DPD": round(dpd_before, 4),
                    "DIR": round(dir_before, 4),
                    "DPD_status": "PASS" if dpd_before <= 0.10 else "FLAG",
                    "DIR_status": "PASS" if dir_before >= 0.80 else "FLAG",
                },
                "after_correction": {
                    "DPD": round(dpd_after, 4),
                    "DIR": round(dir_after, 4),
                    "DPD_status": "PASS" if dpd_after <= 0.10 else "FLAG",
                    "DIR_status": "PASS" if dir_after >= 0.80 else "FLAG",
                },
                "thresholds": {"DPD_threshold": 0.10, "DIR_threshold": 0.80},
            },
            "candidates": [
                {
                    "candidate_id": row['candidate_id'],
                    "demographic_group": int(row['demographic_group']),
                    "top_job_match": row['top_job'],
                    "company": row['top_company'],
                    "similarity_score": round(row['best_score'], 4),
                    "shortlisted_base": bool(row['base_outcome']),
                    "shortlisted_fair": bool(row['fair_outcome']),
                    "reranked": bool(row['fair_outcome'] != row['base_outcome']),
                }
                for _, row in df_batch.iterrows()
            ],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Endpoint 5: Find candidates (HR reverse search) ──────────────────────────

@app.post("/api/find-candidates")
def find_candidates(payload: JobPosting):
    """
    HR reverse search: rank the resume pool against a posted job description.
    NOTE: reconstruct/verify against your original working version - the body
    was truncated in the source file. This implementation ranks resumes by
    cosine similarity to the job description using the pre-fitted job
    vocabulary transform direction reversed onto resumes.
    """
    if df_resumes_pool is None or df_resumes_pool.empty:
        raise HTTPException(status_code=500, detail="Resume data not loaded.")

    try:
        clean_job = preprocess_text(payload.job_description)

        # Build a temporary vectoriser over the resume pool + this job,
        # since the pre-fitted vectoriser is over the JOB corpus vocabulary.
        resume_col = (
            'Resume_clean' if 'Resume_clean' in df_resumes_pool.columns
            else df_resumes_pool.columns[0]
        )
        corpus = [clean_job] + df_resumes_pool[resume_col].fillna("").tolist()
        _min_df = 2 if len(df_resumes_pool) >= 10 else 1
        vec = TfidfVectorizer(min_df=_min_df, max_df=0.85, ngram_range=(1, 2))
        matrix = vec.fit_transform(corpus)
        scores = cosine_similarity(matrix[0:1], matrix[1:]).flatten()

        result = df_resumes_pool.copy()
        result['score'] = scores
        top = result.sort_values(by='score', ascending=False).head(10)

        return {
            "job_title": payload.job_title,
            "company": payload.company,
            "candidates_found": int((result['score'] >= BASE_THRESHOLD).sum()),
            "top_candidates": [
                {
                    "rank": i + 1,
                    "similarity_score": round(float(row['score']), 4),
                    "shortlisted": bool(row['score'] >= BASE_THRESHOLD),
                }
                for i, (_, row) in enumerate(top.iterrows())
            ],
            "fairness_note": (
                "Run a batch fairness audit on the shortlist to evaluate "
                "demographic parity; single rankings carry no group structure."
            ),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Endpoint 6: Post job (HR) ────────────────────────────────────────────────

@app.post("/api/post-job")
def post_job(payload: JobPosting):
    """
    Add a new job to the in-memory pool and refresh the pre-fitted vectoriser
    so the new posting is immediately searchable. In-memory only; persist to
    CSV/DB if you need it to survive a restart.
    """
    global df_jobs_pool, job_vectoriser, job_matrix, job_feature_names

    if df_jobs_pool is None:
        raise HTTPException(status_code=500, detail="Job data not loaded.")

    try:
        clean_desc = preprocess_text(payload.job_description)
        new_row = {
            "Job Title": payload.job_title,
            "Company": payload.company,
            "Job Description": payload.job_description,
            "Job_Description_clean": clean_desc,
        }
        df_jobs_pool = pd.concat(
            [df_jobs_pool, pd.DataFrame([new_row])], ignore_index=True
        )

        # Refit the vectoriser so the new job enters the vocabulary.
        _min_df = 2 if len(df_jobs_pool) >= 10 else 1
        job_vectoriser = TfidfVectorizer(
            min_df=_min_df, max_df=0.85, ngram_range=(1, 2)
        )
        job_matrix = job_vectoriser.fit_transform(
            df_jobs_pool['Job_Description_clean'].tolist()
        )
        job_feature_names = job_vectoriser.get_feature_names_out()

        return {
            "status": "job posted",
            "job_title": payload.job_title,
            "company": payload.company,
            "total_jobs_now": len(df_jobs_pool),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))