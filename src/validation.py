import pandas as pd
import numpy as np
from src.logger import setup_logger
import yaml

logger = setup_logger()

class DataValidation:
    def __init__(self):
        self.logger = logger
        with open('config.yaml', 'r') as f:
            config = yaml.safe_load(f)
        self.missing_threshold = config['validation']['missing_threshold']

    def validate_data(self, df):
        """Perform comprehensive data validation."""
        results = {
            'missing_values': self.check_missing_values(df),
            'negative_values': self.check_negative_values(df),
            'duplicates': self.check_duplicates(df),
            'data_types': self.get_data_types(df)
        }
        return results

    def check_missing_values(self, df):
        """Check for missing values in the dataset."""
        missing = df.isnull().sum()
        missing_pct = (missing / len(df)) * 100
        
        columns_above_threshold = missing_pct[missing_pct > self.missing_threshold * 100]
        
        return {
            'total_missing': missing.to_dict(),
            'missing_percentages': missing_pct.to_dict(),
            'columns_above_threshold': columns_above_threshold.to_dict()
        }

    def check_negative_values(self, df):
        """Check for negative values in numeric columns."""
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        negative_counts = {}
        
        for col in numeric_cols:
            neg_count = (df[col] < 0).sum()
            if neg_count > 0:
                negative_counts[col] = int(neg_count)
        
        return negative_counts

    def check_duplicates(self, df):
        """Check for duplicate rows in the dataset."""
        duplicates = df.duplicated()
        duplicate_count = duplicates.sum()
        
        return {
            'total_duplicates': int(duplicate_count),
            'duplicate_rows': df[duplicates].index.tolist() if duplicate_count > 0 else []
        }

    def get_data_types(self, df):
        """Get data types of all columns."""
        return df.dtypes.astype(str).to_dict()

    def suggest_imputation_method(self, df, column):
        """Suggest an appropriate imputation method for a column."""
        if pd.api.types.is_numeric_dtype(df[column]):
            return 'mean' if df[column].skew() < 1 else 'median'
        else:
            return 'mode'

    def impute_missing_values(self, df, method='auto'):
        """Impute missing values in the dataset."""
        df_imputed = df.copy()
        
        for column in df.columns:
            if df[column].isnull().any():
                impute_method = method if method != 'auto' else self.suggest_imputation_method(df, column)
                
                if pd.api.types.is_numeric_dtype(df[column]):
                    if impute_method == 'mean':
                        df_imputed[column] = df_imputed[column].fillna(df_imputed[column].mean())
                    elif impute_method == 'median':
                        df_imputed[column] = df_imputed[column].fillna(df_imputed[column].median())
                    else:
                        df_imputed[column] = df_imputed[column].fillna(df_imputed[column].mode()[0])
                else:
                    # For non-numeric columns, always use mode
                    mode_value = df_imputed[column].mode()[0] if not df_imputed[column].mode().empty else "Unknown"
                    df_imputed[column] = df_imputed[column].fillna(mode_value)
                
                self.logger.info(f"Imputed missing values in column '{column}' using {impute_method}")
        
        return df_imputed
