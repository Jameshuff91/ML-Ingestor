import pandas as pd
import numpy as np
import seaborn as sns
import matplotlib
matplotlib.use('Agg')  # Set non-interactive backend before importing pyplot
import matplotlib.pyplot as plt
from src.logger import setup_logger
import yaml
import os

logger = setup_logger()

class CorrelationAnalyzer:
    def __init__(self):
        self.logger = logger
        with open('config.yaml', 'r') as f:
            config = yaml.safe_load(f)
        self.correlation_threshold = config['validation']['correlation_threshold']

    def analyze(self, df):
        """Analyze correlations in the dataset."""
        # Get numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        
        if len(numeric_cols) < 2:
            self.logger.warning("Not enough numeric columns for correlation analysis")
            return {
                'correlations': {},
                'high_correlations': [],
                'top_correlations': [],
                'correlation_matrix_path': None
            }

        # Calculate correlations
        correlation_matrix = df[numeric_cols].corr()
        
        # Find all correlations (excluding self-correlations)
        all_correlations = []
        for i in range(len(correlation_matrix.columns)):
            for j in range(i+1, len(correlation_matrix.columns)):  # Only upper triangle to avoid duplicates
                col1 = correlation_matrix.columns[i]
                col2 = correlation_matrix.columns[j]
                corr = correlation_matrix.loc[col1, col2]
                all_correlations.append({
                    'column1': col1,
                    'column2': col2,
                    'correlation': corr
                })
        
        # Sort by absolute correlation value and get top 5
        all_correlations.sort(key=lambda x: abs(x['correlation']), reverse=True)
        top_correlations = all_correlations[:5]
        
        # Debug logging
        self.logger.info(f"Top 5 correlations: {top_correlations}")
        
        # Filter high correlations based on threshold
        high_correlations = [corr for corr in all_correlations if abs(corr['correlation']) >= self.correlation_threshold]

        # Generate correlation heatmap
        plt.figure(figsize=(10, 8))
        sns.heatmap(correlation_matrix, annot=True, cmap='coolwarm', center=0)
        plt.title('Correlation Matrix')
        
        # Save plot with unique name
        os.makedirs('static/plots', exist_ok=True)
        plot_path = f'static/plots/correlation_matrix_{hash(frozenset(numeric_cols))}.png'
        plt.savefig(plot_path)
        plt.close()

        return {
            'correlations': correlation_matrix.to_dict(),
            'high_correlations': high_correlations,
            'top_correlations': top_correlations,
            'correlation_matrix_path': plot_path
        }

    def get_feature_importance(self, df, target_column):
        """Calculate feature importance based on correlation with target."""
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found in dataset")

        numeric_cols = df.select_dtypes(include=[np.number]).columns
        correlations = df[numeric_cols].corr()[target_column].sort_values(ascending=False)
        
        return {
            'feature_importance': correlations.to_dict(),
            'top_features': correlations[1:6].index.tolist()  # Exclude target column itself
        }
