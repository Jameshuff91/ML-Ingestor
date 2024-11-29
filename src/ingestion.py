import pandas as pd
import os
from werkzeug.utils import secure_filename
from src.logger import setup_logger

logger = setup_logger()

class DataIngestion:
    def __init__(self):
        self.logger = logger

    def load_file(self, file):
        """Load data from an uploaded file."""
        filename = secure_filename(file.filename)
        self.logger.info(f"Loading file: {filename}")
        
        try:
            if filename.endswith('.csv'):
                df = pd.read_csv(file.stream)
            elif filename.endswith(('.xls', '.xlsx')):
                df = pd.read_excel(file.stream)
            else:
                raise ValueError(f"Unsupported file type: {filename}")
            
            self.logger.info(f"Successfully loaded file with shape: {df.shape}")
            return df
            
        except Exception as e:
            self.logger.error(f"Error loading file {filename}: {str(e)}")
            raise

    def save_processed_data(self, df, output_path):
        """Save processed data to a file."""
        try:
            df.to_csv(output_path, index=False)
            self.logger.info(f"Successfully saved processed data to: {output_path}")
        except Exception as e:
            self.logger.error(f"Error saving processed data: {str(e)}")
            raise

    def preprocess_data(self, df):
        """Preprocess the data by removing duplicates and handling missing values."""
        try:
            self.logger.info("Starting data preprocessing")
            
            # Create a copy of the dataframe to avoid modifying the original
            df_processed = df.copy()
            
            # Remove duplicates (keep first occurrence, consider 'id' and 'value' columns)
            df_processed = df_processed.drop_duplicates(subset=['id', 'value'], keep='first')
            
            # Handle missing values
            for column in df_processed.columns:
                if pd.api.types.is_numeric_dtype(df_processed[column]):
                    # For numeric columns, fill with mean
                    df_processed[column] = df_processed[column].fillna(df_processed[column].mean())
                else:
                    # For non-numeric columns, fill with mode
                    mode_value = df_processed[column].mode()[0] if not df_processed[column].mode().empty else "Unknown"
                    df_processed[column] = df_processed[column].fillna(mode_value)
            
            self.logger.info("Data preprocessing completed successfully")
            return df_processed
            
        except Exception as e:
            self.logger.error(f"Error during data preprocessing: {str(e)}")
            raise

    def validate_schema(self, df, schema):
        """Validate the dataframe against a provided schema."""
        try:
            self.logger.info("Starting schema validation")
            
            for column, expected_type in schema.items():
                if column not in df.columns:
                    self.logger.error(f"Column {column} not found in dataframe")
                    return False
                
                # Check data types
                if expected_type == 'integer':
                    if not pd.api.types.is_integer_dtype(df[column].dtype):
                        self.logger.error(f"Column {column} is not of type integer")
                        return False
                elif expected_type == 'string':
                    if not pd.api.types.is_string_dtype(df[column].dtype) and not pd.api.types.is_object_dtype(df[column].dtype):
                        self.logger.error(f"Column {column} is not of type string")
                        return False
                        
            self.logger.info("Schema validation completed successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Error during schema validation: {str(e)}")
            raise

    def get_data_summary(self, df):
        """Generate a summary of the dataframe."""
        try:
            self.logger.info("Generating data summary")
            
            summary = {
                'row_count': len(df),
                'column_count': len(df.columns),
                'missing_values': df.isnull().sum().sum(),
                'data_types': df.dtypes.to_dict()
            }
            
            self.logger.info("Data summary generated successfully")
            return summary
            
        except Exception as e:
            self.logger.error(f"Error generating data summary: {str(e)}")
            raise
