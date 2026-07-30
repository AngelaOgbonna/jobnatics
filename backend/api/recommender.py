import re
import pandas as pd
import numpy as np
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.stem import PorterStemmer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

stop_words = set(stopwords.words('english'))
stemmer = PorterStemmer()

def fix_glued_words(text):
    text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)
    text = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1 \2', text)
    return text

def preprocess_text(text):
    if not isinstance(text, str):
        return ""
    text = fix_glued_words(text)
    text = text.lower()
    text = re.sub(r'[^a-z\s]', ' ', text)
    tokens = word_tokenize(text)
    cleaned_tokens = [
        stemmer.stem(word) for word in tokens
        if word not in stop_words and len(word) > 2
    ]
    return " ".join(cleaned_tokens)

def recommend_jobs(resume_text_clean, job_df, top_n=10):
    corpus = [resume_text_clean] + job_df['Job_Description_clean'].tolist()
    vectoriser = TfidfVectorizer(min_df=2, max_df=0.85, ngram_range=(1, 2))
    tfidf_matrix = vectoriser.fit_transform(corpus)
    resume_vector = tfidf_matrix[0:1]
    job_vectors = tfidf_matrix[1:]
    scores = cosine_similarity(resume_vector, job_vectors).flatten()
    top_indices = scores.argsort()[::-1][:top_n]
    results = job_df.iloc[top_indices][['Job Title', 'Company', 'location', 'Job Description', 'skills']].copy()
    results['similarity_score'] = scores[top_indices]
    return results.reset_index(drop=True)
