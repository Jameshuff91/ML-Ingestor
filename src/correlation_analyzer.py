"""Correlation analysis module for ML Ingestor."""
import pandas as pd
import numpy as np
from typing import Dict, Any, List

def analyze(df: pd.DataFrame) -> Dict[str, Any]:
    """Analyze correlations in the dataset."""
    # Get numeric columns only
    numeric_df = df.select_dtypes(include=[np.number])
    
    if numeric_df.empty:
        return {
            'correlations': {},
            'high_correlations': [],
            'top_correlations': []
        }
    
    # Calculate correlation matrix
    corr_matrix = numeric_df.corr()
    
    # Convert correlation matrix to nested dictionary format for frontend
    correlations = {}
    for col1 in corr_matrix.columns:
        correlations[col1] = {}
        for col2 in corr_matrix.columns:
            correlations[col1][col2] = float(corr_matrix.loc[col1, col2])
    
    # Find high correlations (absolute value > 0.7)
    high_correlations = []
    for i, col1 in enumerate(corr_matrix.columns):
        for j, col2 in enumerate(corr_matrix.columns):
            if i < j:  # Only look at upper triangle to avoid duplicates
                corr = float(corr_matrix.loc[col1, col2])
                if abs(corr) > 0.7:
                    high_correlations.append({
                        'column1': col1,
                        'column2': col2,
                        'correlation': corr
                    })
    
    # Sort high correlations by absolute correlation value
    high_correlations.sort(key=lambda x: abs(x['correlation']), reverse=True)
    
    # Get top 10 correlations
    top_correlations = high_correlations[:10]
    
    return {
        'correlations': correlations,
        'high_correlations': high_correlations,
        'top_correlations': top_correlations
    }
