import pandas as pd
from src.validation import DataValidation
from src.correlation import CorrelationAnalyzer
from src.logger import setup_logger

logger = setup_logger()

class DataProcessor:
    """Class for processing data, combining validation and correlation analysis."""
    
    def __init__(self):
        """Initialize DataProcessor with validation and correlation components."""
        self.logger = logger
        self.validator = DataValidation()
        self.correlation_analyzer = CorrelationAnalyzer()
    
    def validate_data(self, df: pd.DataFrame) -> dict:
        """Validate the data using DataValidation.
        
        Args:
            df: Input DataFrame to validate
            
        Returns:
            dict: Dictionary containing validation results
        """
        try:
            # Get missing value statistics
            missing_stats = self.validator.check_missing_values(df)
            
            # Get duplicate statistics
            duplicate_stats = self.validator.check_duplicates(df)
            
            # Get numeric column statistics
            numeric_stats = self.validator.get_numeric_stats(df)
            
            # Combine all validation results
            validation_results = {
                'missing_values': missing_stats,
                'duplicates': duplicate_stats,
                'numeric_stats': numeric_stats
            }
            
            return validation_results
            
        except Exception as e:
            self.logger.error(f"Error in validate_data: {str(e)}")
            raise
    
    def analyze_correlations(self, df: pd.DataFrame, task_id: str = None) -> dict:
        """Analyze correlations in the data using CorrelationAnalyzer.
        
        Args:
            df: Input DataFrame to analyze
            task_id: Optional task ID for generating unique plot files
            
        Returns:
            dict: Dictionary containing correlation analysis results
        """
        try:
            return self.correlation_analyzer.analyze(df, task_id)
        except Exception as e:
            self.logger.error(f"Error in analyze_correlations: {str(e)}")
            raise
