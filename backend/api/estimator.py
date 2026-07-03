# api/estimator.py
import numpy as np

class ScorePassthroughEstimator:
    def fit(self, X, y):
        return self

    def predict(self, X):
        return (X.flatten() >= 0.25).astype(int)

    def predict_proba(self, X):
        scores = X.flatten()
        return np.column_stack([1 - scores, scores])