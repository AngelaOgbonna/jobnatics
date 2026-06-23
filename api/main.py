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
from fairlearn.postprocessing import ThresholdOptimizer
from fairlearn.metrics import (
    demographic_parity_difference,
    demographic_parity_ratio
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
        "Two-tier system: individual recommendations with saved "
        "ThresholdOptimizer reranking, plus population-level "
        "batch fairness evaluation."
    )
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Constants ──────────────────────────────────────────────────────────────────

BASE_THRESHOLD = 0.25

VALIDATED_FAIRNESS_METRICS = {
    "test_A_gender_balanced": {
        "before_correction": {"DPD": 0.0400, "DIR": 0.9180},
        "after_correction":  {"DPD": 0.0040, "DIR": 0.9912},
        "status": "PASS",
        "sample_size": 500
    },
    "test_B_gender_imbalanced": {
        "before_correction": {"DPD": 0.1646, "DIR": 0.7298},
        "after_correction":  {"DPD": 0.0364, "DIR": 0.9403},
        "status": "PASS after correction",
        "sample_size": 250
    },
    "test_C_profession_4groups": {
        "before_correction": {"DPD": 0.3067, "DIR": 0.5577},
        "after_correction":  {"DPD": 0.0267, "DIR": 0.9524},
        "status": "PASS after correction",
        "sample_size": 300
    },
    "thresholds": {
        "DPD_threshold": 0.10,
        "DIR_threshold": 0.80,
        "similarity_threshold": BASE_THRESHOLD
    },
    "evaluation_note": (
        "Metrics validated on Bias in Bios dataset "
        "(De-Arteaga et al., 2019) using gender and profession "
        "as sensitive features. ThresholdOptimizer applied with "
        "demographic_parity constraint."
    )
}

# ── Custom estimator ────────────────────────────────────────────────────────────
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


# Register in __main__ so pickle can find it when loading saved optimizers
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


# ── Startup ────────────────────────────────────────────────────────────────────

@app.on_event("startup")
def load_all():
    global df_jobs_pool, df_resumes_pool, optimizer_a, optimizer_b, optimizer_c

    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")

    # Load jobs
    jobs_path = os.path.join(data_dir, "jobs_clean.csv")
    if os.path.exists(jobs_path):
        df_jobs_pool = pd.read_csv(jobs_path)
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
                "Software Engineer", "Operations Manager"
            ],
            "Company": [
                "Tech Corp", "People Ltd",
                "Dev Solutions", "Logistics Inc"
            ],
            "Job Description": [
                "Analyze data Python SQL dashboards statistics regression.",
                "Manage human resources recruiting talent relations payroll.",
                "Build software Python JavaScript React APIs deployment.",
                "Oversee logistics operations budgets performance metrics."
            ]
        })
        df_jobs_pool['Job_Description_clean'] = (
            df_jobs_pool['Job Description'].apply(preprocess_text)
        )

    # Load resumes
    resumes_path = os.path.join(data_dir, "resumes_clean.csv")
    if os.path.exists(resumes_path):
        df_resumes_pool = pd.read_csv(resumes_path)
        print(f"Loaded {len(df_resumes_pool)} resumes from resumes_clean.csv")
    else:
        print("WARNING: resumes_clean.csv not found.")
        df_resumes_pool = pd.DataFrame()

    # Load saved ThresholdOptimizer models
    # ScorePassthroughEstimator is registered in __main__ above
    # so pickle can deserialise the saved objects correctly
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
                if attr_name == "optimizer_a":
                    optimizer_a = model
                elif attr_name == "optimizer_b":
                    optimizer_b = model
                else:
                    optimizer_c = model
                print(f"Loaded {filename}")
            except Exception as e:
                print(f"WARNING: Could not load {filename}: {e}")
        else:
            print(f"WARNING: {filename} not found.")

    print("Startup complete.")


# ── Helper: rank jobs ──────────────────────────────────────────────────────────

def rank_jobs(clean_resume: str, job_df: pd.DataFrame) -> pd.DataFrame:
    corpus = [clean_resume] + job_df['Job_Description_clean'].tolist()
    vectoriser = TfidfVectorizer(min_df=1, max_df=0.95, ngram_range=(1, 2))
    matrix = vectoriser.fit_transform(corpus)
    scores = cosine_similarity(matrix[0:1], matrix[1:]).flatten()
    result = job_df.copy()
    result['score'] = scores
    return result


# ── Request schemas ────────────────────────────────────────────────────────────

class ResumePayload(BaseModel):
    resume_text: str
    demographic_group: int = 0


class BatchCandidate(BaseModel):
    candidate_id: str
    resume_text: str
    demographic_group: int


class BatchPayload(BaseModel):
    candidates: List[BatchCandidate]


# ── Endpoint 1: Health check ───────────────────────────────────────────────────

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
            "optimizer_c": optimizer_c is not None
        },
        "endpoints": {
            "individual_match": "POST /api/match",
            "batch_match":      "POST /api/batch-match",
            "fairness_metrics": "GET  /api/fairness-metrics"
        }
    }


# ── Endpoint 2: Fairness metrics dashboard ─────────────────────────────────────

@app.get("/api/fairness-metrics")
def get_fairness_metrics():
    return {
        "system_fairness_evaluation": VALIDATED_FAIRNESS_METRICS,
        "models_loaded": {
            "optimizer_a_gender_balanced":   optimizer_a is not None,
            "optimizer_b_gender_imbalanced": optimizer_b is not None,
            "optimizer_c_profession_groups": optimizer_c is not None
        },
        "description": (
            "Metrics computed on Bias in Bios test populations. "
            "Saved ThresholdOptimizer models loaded from Colab evaluation."
        )
    }


# ── Endpoint 3: Individual match ───────────────────────────────────────────────

@app.post("/api/match")
def individual_match(payload: ResumePayload):
    """
    Individual recommendation endpoint.
    Uses saved ThresholdOptimizer from Test A (gender-balanced,
    500 biographies) to apply group-aware reranking live.
    """
    if df_jobs_pool is None or df_jobs_pool.empty:
        raise HTTPException(status_code=500, detail="Job data not loaded.")

    try:
        clean_resume = preprocess_text(payload.resume_text)
        results = rank_jobs(clean_resume, df_jobs_pool)
        results['base_outcome'] = (
            results['score'] >= BASE_THRESHOLD
        ).astype(int)
        results['demographic'] = payload.demographic_group

        reranking_applied = False
        reranking_source = "Base cosine similarity ranking"

        if optimizer_a is not None:
            X = results['score'].values.reshape(-1, 1)
            sensitive = results['demographic'].values
            try:
                corrected = optimizer_a.predict(
                    X, sensitive_features=sensitive
                )
                results['fair_outcome'] = corrected
                reranking_applied = True
                reranking_source = (
                    "Saved ThresholdOptimizer from Colab Test A "
                    "(gender-balanced, 500 biographies)"
                )
            except Exception:
                results['fair_outcome'] = results['base_outcome']
        else:
            results['fair_outcome'] = results['base_outcome']

        top = results.sort_values(
            by=['fair_outcome', 'score'], ascending=[False, False]
        ).head(10)

        return {
            "candidate_demographic_group": payload.demographic_group,
            "reranking_applied": reranking_applied,
            "reranking_source": reranking_source,
            "recommendations": [
                {
                    "rank": i + 1,
                    "job_title": str(row['Job Title']),
                    "company": str(row['Company']),
                    "similarity_score": round(float(row['score']), 4),
                    "recommended": bool(row['fair_outcome'])
                }
                for i, (_, row) in enumerate(top.iterrows())
            ],
            "system_fairness_metrics": {
                "DPD": VALIDATED_FAIRNESS_METRICS
                       ["test_A_gender_balanced"]
                       ["after_correction"]["DPD"],
                "DIR": VALIDATED_FAIRNESS_METRICS
                       ["test_A_gender_balanced"]
                       ["after_correction"]["DIR"],
                "status": "PASS",
                "note": "Population-level metrics from validated test set."
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Endpoint 4: Batch match ────────────────────────────────────────────────────

@app.post("/api/batch-match")
def batch_match(payload: BatchPayload):
    """
    Batch recommendation endpoint for HR managers.
    Loads appropriate saved ThresholdOptimizer based on group structure,
    computes live DPD and DIR before and after correction.
    """
    if df_jobs_pool is None or df_jobs_pool.empty:
        raise HTTPException(status_code=500, detail="Job data not loaded.")

    if len(payload.candidates) < 4:
        raise HTTPException(
            status_code=400,
            detail="Batch requires at least 4 candidates (2 per group)."
        )

    groups_present = set(c.demographic_group for c in payload.candidates)
    if len(groups_present) < 2:
        raise HTTPException(
            status_code=400,
            detail="Batch requires candidates from at least 2 demographic groups."
        )

    try:
        all_results = []

        for candidate in payload.candidates:
            clean_resume = preprocess_text(candidate.resume_text)
            ranked = rank_jobs(clean_resume, df_jobs_pool)
            best_score = float(ranked['score'].max())
            best_row = ranked.loc[ranked['score'].idxmax()]

            all_results.append({
                "candidate_id": candidate.candidate_id,
                "demographic_group": candidate.demographic_group,
                "best_score": best_score,
                "top_job": str(best_row['Job Title']),
                "top_company": str(best_row['Company']),
                "base_outcome": int(best_score >= BASE_THRESHOLD)
            })

        df_batch = pd.DataFrame(all_results)

        dpd_before = float(demographic_parity_difference(
            y_true=df_batch['base_outcome'],
            y_pred=df_batch['base_outcome'],
            sensitive_features=df_batch['demographic_group']
        ))
        dir_before = float(demographic_parity_ratio(
            y_true=df_batch['base_outcome'],
            y_pred=df_batch['base_outcome'],
            sensitive_features=df_batch['demographic_group']
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
                    corrected = chosen.predict(
                        X, sensitive_features=sensitive
                    )
                    df_batch['fair_outcome'] = corrected
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
            sensitive_features=df_batch['demographic_group']
        ))
        dir_after = float(demographic_parity_ratio(
            y_true=df_batch['fair_outcome'],
            y_pred=df_batch['fair_outcome'],
            sensitive_features=df_batch['demographic_group']
        ))

        return {
            "batch_size": len(payload.candidates),
            "fairness_correction_applied": correction_applied,
            "optimizer_used": optimizer_used,
            "fairness_metrics": {
                "before_correction": {
                    "DPD": round(dpd_before, 4),
                    "DIR": round(dir_before, 4),
                    "DPD_status": "PASS" if dpd_before <= 0.10 else "FLAG",
                    "DIR_status": "PASS" if dir_before >= 0.80 else "FLAG"
                },
                "after_correction": {
                    "DPD": round(dpd_after, 4),
                    "DIR": round(dir_after, 4),
                    "DPD_status": "PASS" if dpd_after <= 0.10 else "FLAG",
                    "DIR_status": "PASS" if dir_after >= 0.80 else "FLAG"
                },
                "thresholds": {
                    "DPD_threshold": 0.10,
                    "DIR_threshold": 0.80
                }
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
                    "reranked": bool(
                        row['fair_outcome'] != row['base_outcome']
                    )
                }
                for _, row in df_batch.iterrows()
            ]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))