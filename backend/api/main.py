import os
from dotenv import load_dotenv
load_dotenv() # Load variables from .env file
import re
import pickle
import __main__
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException, UploadFile, File
import cloudinary
import cloudinary.uploader
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

# Configure NLTK to download to a writable directory on Vercel
import os
nltk_data_dir = os.path.join('/tmp', 'nltk_data')
if not os.path.exists(nltk_data_dir):
    try:
        os.makedirs(nltk_data_dir, exist_ok=True)
    except Exception:
        pass
if nltk_data_dir not in nltk.data.path:
    nltk.data.path.append(nltk_data_dir)

nltk.download('stopwords', download_dir=nltk_data_dir, quiet=True)
nltk.download('punkt', download_dir=nltk_data_dir, quiet=True)
nltk.download('punkt_tab', download_dir=nltk_data_dir, quiet=True)


from pypdf import PdfReader
import io

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
resumes_vectorizer = None
resumes_tfidf_matrix = None
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
    global resumes_vectorizer, resumes_tfidf_matrix

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
        # Limit to 5000 resumes for local/free-tier memory efficiency and speed
        df_resumes_pool = pd.read_csv(resumes_path).head(5000).copy()
        # Seed deterministic mock demographic groups (0 and 1) for fairness evaluation
        np.random.seed(42)
        df_resumes_pool['demographic_group'] = np.random.choice([0, 1], size=len(df_resumes_pool))
        
        # Fit TF-IDF on resumes
        try:
            resumes_vectorizer = TfidfVectorizer(min_df=2, max_df=0.85, ngram_range=(1, 2))
            resumes_tfidf_matrix = resumes_vectorizer.fit_transform(df_resumes_pool['Resume_clean'].fillna(''))
            print(f"Loaded {len(df_resumes_pool)} resumes and precomputed TF-IDF matrix.")
        except Exception as e:
            print(f"WARNING: TF-IDF vectorization failed: {e}")
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


class JobPayload(BaseModel):
    job_description: str


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
            "job_match":        "POST /api/match-job",
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


# ── Endpoint 5: Match job description against candidates ──────────────────────

@app.post("/api/match-job")
def match_job(payload: JobPayload):
    """
    Ranks candidates against a provided job description.
    Applies live demographic parity checks and fairness correction if needed.
    """
    if df_resumes_pool is None or df_resumes_pool.empty:
        raise HTTPException(status_code=500, detail="Resumes pool is not loaded.")
    if resumes_vectorizer is None or resumes_tfidf_matrix is None:
        raise HTTPException(status_code=500, detail="Resumes TF-IDF structures are not initialized.")

    try:
        # Preprocess the job description text
        clean_job_desc = preprocess_text(payload.job_description)
        if not clean_job_desc:
            raise HTTPException(status_code=400, detail="Invalid or empty job description.")

        # Compute TF-IDF vector for the job description
        job_tfidf = resumes_vectorizer.transform([clean_job_desc])
        
        # Calculate cosine similarity with all resumes in the pool
        scores = cosine_similarity(job_tfidf, resumes_tfidf_matrix).flatten()
        # Clean potential NaN values from cosine similarity division by zero
        scores = np.nan_to_num(scores, nan=0.0)
        
        # Build results DataFrame
        df_results = df_resumes_pool.copy()
        df_results['score'] = scores
        df_results['base_outcome'] = (df_results['score'] >= BASE_THRESHOLD).astype(int)

        # Evaluate fairness on the top 100 highest scoring candidates to see cohort-level parity
        df_top_cohort = df_results.sort_values(by='score', ascending=False).head(100).copy()

        # Compute DPD and DIR before correction on the top cohort
        dpd_before = float(demographic_parity_difference(
            y_true=df_top_cohort['base_outcome'],
            y_pred=df_top_cohort['base_outcome'],
            sensitive_features=df_top_cohort['demographic_group']
        ))
        if np.isnan(dpd_before):
            dpd_before = 0.0

        dir_before = float(demographic_parity_ratio(
            y_true=df_top_cohort['base_outcome'],
            y_pred=df_top_cohort['base_outcome'],
            sensitive_features=df_top_cohort['demographic_group']
        ))
        if np.isnan(dir_before):
            dir_before = 1.0

        violation = dpd_before > 0.10 or dir_before < 0.80
        correction_applied = False
        optimizer_used = "none"

        # Apply ThresholdOptimizer if a violation exists
        unique_groups = df_top_cohort['demographic_group'].nunique()
        unique_outcomes = df_top_cohort['base_outcome'].nunique()

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
                X = df_top_cohort['score'].values.reshape(-1, 1)
                sensitive = df_top_cohort['demographic_group'].values
                try:
                    corrected = chosen.predict(X, sensitive_features=sensitive)
                    df_top_cohort['fair_outcome'] = corrected
                    correction_applied = True
                except Exception:
                    df_top_cohort['fair_outcome'] = df_top_cohort['base_outcome']
            else:
                df_top_cohort['fair_outcome'] = df_top_cohort['base_outcome']
        else:
            df_top_cohort['fair_outcome'] = df_top_cohort['base_outcome']

        # Recalculate metrics after correction
        dpd_after = float(demographic_parity_difference(
            y_true=df_top_cohort['fair_outcome'],
            y_pred=df_top_cohort['fair_outcome'],
            sensitive_features=df_top_cohort['demographic_group']
        ))
        if np.isnan(dpd_after):
            dpd_after = 0.0

        dir_after = float(demographic_parity_ratio(
            y_true=df_top_cohort['fair_outcome'],
            y_pred=df_top_cohort['fair_outcome'],
            sensitive_features=df_top_cohort['demographic_group']
        ))
        if np.isnan(dir_after):
            dir_after = 1.0

        # Sort the top cohort to return the top 10 recommended candidates
        top_candidates = df_top_cohort.sort_values(
            by=['fair_outcome', 'score'], ascending=[False, False]
        ).head(10)

        return {
            "cohort_size": len(df_top_cohort),
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
                    "rank": i + 1,
                    "category": str(row['Category']) if pd.notna(row['Category']) else "",
                    "resume_snippet": (str(row['Resume'])[:200].replace("\n", " ").strip() + "...") if pd.notna(row['Resume']) else "",
                    "demographic_group": int(row['demographic_group']),
                    "similarity_score": round(float(row['score']), 4),
                    "shortlisted_base": bool(row['base_outcome']),
                    "shortlisted_fair": bool(row['fair_outcome']),
                    "reranked": bool(row['fair_outcome'] != row['base_outcome'])
                }
                for i, (_, row) in enumerate(top_candidates.iterrows())
            ]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Endpoint 6: Match specific applicants against a job description ────────────

class ApplicantMatchItem(BaseModel):
    applicant_id: str
    resume_text: str
    demographic_group: int = 0

class ApplicantMatchPayload(BaseModel):
    job_description: str
    applicants: List[ApplicantMatchItem]

@app.post("/api/match-applicants")
def match_applicants(payload: ApplicantMatchPayload):
    if resumes_vectorizer is None:
        raise HTTPException(status_code=500, detail="Resumes TF-IDF structures are not initialized.")

    try:
        clean_job_desc = preprocess_text(payload.job_description)
        if not clean_job_desc:
            raise HTTPException(status_code=400, detail="Invalid or empty job description.")

        # Compute TF-IDF vector for the job description
        job_tfidf = resumes_vectorizer.transform([clean_job_desc])
        
        matches = []
        for app_item in payload.applicants:
            clean_resume = preprocess_text(app_item.resume_text)
            if not clean_resume:
                matches.append({
                    "applicant_id": app_item.applicant_id,
                    "score": 0.0,
                    "base_outcome": False
                })
                continue
            
            # Compute TF-IDF vector for the resume
            app_tfidf = resumes_vectorizer.transform([clean_resume])
            score = float(cosine_similarity(job_tfidf, app_tfidf)[0][0])
            score = np.nan_to_num(score, nan=0.0)
            
            # Convert to percentage
            match_percentage = round(score * 100, 1)
            base_outcome = bool(score >= BASE_THRESHOLD)
            
            matches.append({
                "applicant_id": app_item.applicant_id,
                "score": match_percentage,
                "base_outcome": base_outcome
            })

        return {
            "matches": matches
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Cloudinary Configuration & CV Upload ───────────────────────────────────────

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")

if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True
    )
    print("Cloudinary SDK configured successfully.")
else:
    print("WARNING: Cloudinary environment variables not fully set. Running in Mock/Demo mode.")


@app.post("/api/upload-cv")
async def upload_cv(file: UploadFile = File(...)):
    """
    Receives a CV/resume file and uploads it to Cloudinary using the SDK.
    If Cloudinary config is missing, falls back to a simulated secure URL.
    """
    try:
        # Check file size (5MB limit)
        file.file.seek(0, os.SEEK_END)
        file_size = file.file.tell()
        file.file.seek(0)
        if file_size > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail="File size exceeds the 5MB limit."
            )

        # Check file extension
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in [".pdf", ".doc", ".docx", ".txt"]:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file format. Please upload PDF, Word, or TXT."
            )

        # Check that Cloudinary credentials are set up
        if not (CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET):
            raise HTTPException(
                status_code=500,
                detail="Cloudinary credentials are not configured in the backend environment variables (.env)."
            )

        # Read file bytes for text extraction before upload
        file_bytes = file.file.read()
        file.file.seek(0)

        extracted_text = ""
        if ext == ".pdf":
            try:
                pdf_reader = PdfReader(io.BytesIO(file_bytes))
                pages_text = []
                for page in pdf_reader.pages:
                    text = page.extract_text()
                    if text:
                        pages_text.append(text)
                extracted_text = "\n".join(pages_text)
            except Exception as pdf_err:
                print(f"Error parsing PDF: {pdf_err}")
        elif ext == ".txt":
            try:
                extracted_text = file_bytes.decode("utf-8", errors="ignore")
            except Exception as txt_err:
                print(f"Error decoding TXT: {txt_err}")

        try:
            # Upload using the Cloudinary SDK (with resource_type auto)
            result = cloudinary.uploader.upload(
                file.file,
                resource_type="auto",
                public_id=f"jobnatics_resumes/{os.path.splitext(file.filename)[0]}"
            )
            secure_url = result.get("secure_url")
            if not secure_url:
                raise Exception("Cloudinary did not return a secure URL.")
            print(f"Cloudinary upload successful: {secure_url}")
        except Exception as cl_err:
            print(f"Cloudinary upload error: {cl_err}")
            raise HTTPException(
                status_code=500,
                detail=f"Cloudinary upload failed: {str(cl_err)}"
            )

        return {
            "status": "success",
            "url": secure_url,
            "filename": file.filename,
            "text": extracted_text
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Upload process error: {e}")
        raise HTTPException(status_code=500, detail=str(e))