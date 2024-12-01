import pandas as pd
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
from typing import List, Dict, Any
import os
from src.logger import setup_logger
from src.correlation import CorrelationAnalyzer

logger = setup_logger()

class MultiFileCorrelationAnalyzer:
    def __init__(self):
        self.logger = logger
        self.correlation_analyzer = CorrelationAnalyzer()
        
    def find_similar_columns(self, df1: pd.DataFrame, df2: pd.DataFrame, similarity_threshold: float = 0.9) -> List[tuple]:
        """Find potentially related columns between two dataframes based on value overlap."""
        similar_columns = []
        
        # Only compare numeric columns
        numeric_cols1 = df1.select_dtypes(include=[np.number]).columns
        numeric_cols2 = df2.select_dtypes(include=[np.number]).columns
        
        for col1 in numeric_cols1:
            values1 = set(df1[col1].dropna().unique())
            
            for col2 in numeric_cols2:
                values2 = set(df2[col2].dropna().unique())
                
                # Calculate Jaccard similarity for value overlap
                intersection = len(values1.intersection(values2))
                union = len(values1.union(values2))
                
                if union > 0:
                    similarity = intersection / union
                    if similarity >= similarity_threshold:
                        similar_columns.append((col1, col2, similarity))
        
        return similar_columns

    def analyze_cross_file_correlations(self, files: List[str]) -> Dict[str, Any]:
        """Analyze correlations between multiple CSV files.
        
        Args:
            files: List of paths to CSV files
            
        Returns:
            Dictionary containing:
            - cross_correlations: Correlations between similar columns across files
            - file_correlations: Individual file correlation matrices
            - similar_columns: List of similar columns found between files
        """
        if len(files) < 2:
            return {"error": "Need at least 2 files for cross-file correlation analysis"}
            
        try:
            # Load all dataframes
            dataframes = {}
            for file in files:
                df = pd.read_csv(file)
                dataframes[os.path.basename(file)] = df
                
            # Store individual file correlations
            file_correlations = {}
            for filename, df in dataframes.items():
                file_correlations[filename] = self.correlation_analyzer.analyze(df)
            
            # Find cross-file correlations
            cross_correlations = []
            similar_columns = []
            
            # Compare each pair of files
            file_names = list(dataframes.keys())
            for i in range(len(file_names)):
                for j in range(i + 1, len(file_names)):
                    file1, file2 = file_names[i], file_names[j]
                    df1, df2 = dataframes[file1], dataframes[file2]
                    
                    # Find similar columns
                    similar = self.find_similar_columns(df1, df2)
                    
                    for col1, col2, similarity in similar:
                        similar_columns.append({
                            'file1': file1,
                            'file2': file2,
                            'column1': col1,
                            'column2': col2,
                            'similarity': similarity
                        })
                        
                        # Calculate correlation between similar columns
                        correlation = df1[col1].corr(df2[col2])
                        if not np.isnan(correlation):
                            cross_correlations.append({
                                'file1': file1,
                                'file2': file2,
                                'column1': col1,
                                'column2': col2,
                                'correlation': correlation
                            })
            
            # Generate cross-file correlation heatmap
            if cross_correlations:
                plt.figure(figsize=(12, 8))
                
                # Create a matrix for the heatmap
                unique_columns = set()
                for corr in cross_correlations:
                    unique_columns.add(f"{corr['file1']}:{corr['column1']}")
                    unique_columns.add(f"{corr['file2']}:{corr['column2']}")
                
                unique_columns = sorted(list(unique_columns))
                matrix_size = len(unique_columns)
                correlation_matrix = np.zeros((matrix_size, matrix_size))
                
                # Fill the matrix
                for corr in cross_correlations:
                    idx1 = unique_columns.index(f"{corr['file1']}:{corr['column1']}")
                    idx2 = unique_columns.index(f"{corr['file2']}:{corr['column2']}")
                    correlation_matrix[idx1][idx2] = corr['correlation']
                    correlation_matrix[idx2][idx1] = corr['correlation']  # Mirror the correlation
                
                # Create heatmap
                sns.heatmap(correlation_matrix, 
                           xticklabels=unique_columns,
                           yticklabels=unique_columns,
                           cmap='coolwarm',
                           center=0,
                           annot=True)
                plt.title('Cross-file Correlation Matrix')
                plt.xticks(rotation=45, ha='right')
                plt.yticks(rotation=0)
                plt.tight_layout()
                
                # Save plot
                os.makedirs('static/plots', exist_ok=True)
                plot_path = 'static/plots/cross_file_correlation_matrix.png'
                plt.savefig(plot_path)
                plt.close()
            else:
                plot_path = None
            
            return {
                'cross_correlations': cross_correlations,
                'file_correlations': file_correlations,
                'similar_columns': similar_columns,
                'cross_correlation_matrix_path': plot_path
            }
            
        except Exception as e:
            self.logger.error(f"Error in cross-file correlation analysis: {str(e)}")
            return {"error": str(e)}
