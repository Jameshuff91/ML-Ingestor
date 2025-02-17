import pandas as pd
import numpy as np
from src.logger import setup_logger
import yaml
from scipy import stats
from scipy.stats import shapiro, anderson

logger = setup_logger()

class DataValidation:
    def __init__(self):
        self.logger = logger
        with open('config.yaml', 'r') as f:
            config = yaml.safe_load(f)
        self.missing_threshold = config['validation']['missing_threshold']
        self.correlation_threshold = 0.8  # Configurable threshold for multicollinearity
        self.outlier_sensitivity = config['validation']['outlier_sensitivity']
        self.z_score_threshold = self.outlier_sensitivity['z_score']
        self.iqr_threshold = self.outlier_sensitivity['iqr']
        self.range_validation_config = config['validation']['range_validation']
        self.custom_rules_config = config['validation']['custom_validation_rules']
        self.range_validation_config = config['validation']['range_validation']
    def validate_data(self, df, expected_dtypes=None):
        """Perform comprehensive data validation."""
        basic_validation = {
            'missing_values': self.check_missing_values(df),
            'negative_values': self.check_negative_values(df),
            'duplicates': self.check_duplicates(df),
            'data_types': self.get_data_types(df),
            'data_type_validation': self.check_data_types(df, expected_dtypes) if expected_dtypes else "No expected data types provided", # Add data type validation
            'range_validation': self.check_range_validation(df, self.range_validation_config), # Add range validation
            'custom_rule_validation': self.check_custom_validation_rules(df, self.custom_rules_config) # Add custom rule validation
        }

        advanced_validation = {
            'outliers': self.detect_outliers(df),
            'quality_scores': self.calculate_quality_scores(df),
            'distribution_analysis': self.analyze_distributions(df),
            'multicollinearity': self.detect_multicollinearity(df)
        }

        return {
            'basic_validation': basic_validation,
            'advanced_validation': advanced_validation
        }

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

    def check_data_types(self, df, expected_dtypes):
        """
        Ensure columns adhere to expected data types.
        Args:
            df (pd.DataFrame): DataFrame to validate.
            expected_dtypes (dict): Dictionary of column names and expected data types (e.g., {'column_name': 'numeric'}).
        Returns:
            dict: Dictionary of columns with data type inconsistencies.
        """
        inconsistent_columns = {}
        for column, expected_dtype in expected_dtypes.items():
            if column not in df.columns:
                inconsistent_columns[column] = "Column not found"
                continue

            actual_dtype = df[column].dtype
            if expected_dtype == 'numeric':
                if not pd.api.types.is_numeric_dtype(actual_dtype):
                    inconsistent_columns[column] = f"Expected numeric, got {actual_dtype}"
            elif expected_dtype == 'string':
                if not pd.api.types.is_string_dtype(actual_dtype):
                    inconsistent_columns[column] = f"Expected string, got {actual_dtype}"
            elif expected_dtype == 'datetime':
                if not pd.api.types.is_datetime64_any_dtype(actual_dtype):
                    inconsistent_columns[column] = f"Expected datetime, got {actual_dtype}"
            # Add more data type checks as needed

        return inconsistent_columns

    def check_range_validation(self, df, range_config):
        """
        Validate if numerical columns are within specified ranges.
        Args:
            df (pd.DataFrame): DataFrame to validate.
            range_config (dict): Dictionary of column names and their valid ranges (e.g., {'column_name': {'min': 0, 'max': 100}}).
        Returns:
            dict: Dictionary of columns with range validation issues.
        """
        out_of_range_columns = {}
        for column, ranges in range_config.items():
            if column not in df.columns:
                out_of_range_columns[column] = "Column not found"
                continue

            if pd.api.types.is_numeric_dtype(df[column]):
                min_val = ranges.get('min')
                max_val = ranges.get('max')

                if min_val is not None and max_val is not None:
                    out_of_range_values = df[(df[column] < min_val) | (df[column] > max_val)][column]
                elif min_val is not None:
                    out_of_range_values = df[df[column] < min_val][column]
                elif max_val is not None:
                    out_of_range_values = df[df[column] > max_val][column]
                else:
                    continue # No range specified

                if not out_of_range_values.empty:
                    out_of_range_columns[column] = {
                        'min_range': min_val,
                        'max_range': max_val,
                        'out_of_range_count': int(out_of_range_values.count()),
                        'out_of_range_values': out_of_range_values.tolist()
                    }
            else:
                out_of_range_columns[column] = "Column is not numeric"

        return out_of_range_columns

    
    def check_custom_validation_rules(self, df, custom_rules_config):
        """
        Apply custom validation rules defined in the configuration.
        Args:
            df (pd.DataFrame): DataFrame to validate.
            custom_rules_config (dict): Dictionary of custom validation rules.
        Returns:
            dict: Dictionary of columns with custom validation rule violations.
        """
        violated_rules = {}
        for rule_name, rule_details in custom_rules_config.items():
            column = rule_details.get('column')
            rule_type = rule_details.get('type')
            expression = rule_details.get('expression')
            script = rule_details.get('script')

            if column not in df.columns:
                violated_rules[rule_name] = "Column not found"
                continue

            if rule_type == 'expression' and expression:
                try:
                    # Evaluate expression using DataFrame.apply and convert result to boolean
                    rule_result = df.apply(lambda row: pd.eval(expression, local_dict={'row': row}), axis=1) == False
                    violated_data = df[rule_result]

                    if not violated_data.empty:
                        violated_rules[rule_name] = {
                            'rule_description': rule_details.get('description', rule_name),
                            'violated_count': len(violated_data),
                            'violated_rows_indices': violated_data.index.tolist(),
                            'expression': expression
                        }

                except Exception as e:
                    violated_rules[rule_name] = f"Error evaluating expression: {e}"
            elif rule_type == 'script' and script:
                try:
                    # Execute script (not implemented for security reasons, consider using expression instead)
                    violated_rules[rule_name] = "Script execution is not supported for security reasons. Use 'expression' type instead."
                except Exception as e:
                    violated_rules[rule_name] = f"Error executing script: {e}"
            else:
                violated_rules[rule_name] = "Invalid rule configuration: type or expression/script missing"

        return violated_rules

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

    def detect_outliers(self, df):
        """
        Apply custom validation rules defined in the configuration.
                Args:
                    df (pd.DataFrame): DataFrame to validate.
                    custom_rules_config (dict): Dictionary of custom validation rules.
                Returns:
                    dict: Dictionary of columns with custom validation rule violations.
        """
        violated_rules = {}
        for rule_name, rule_details in custom_rules_config.items():
            column = rule_details.get('column')
            rule_type = rule_details.get('type')
            expression = rule_details.get('expression')
            script = rule_details.get('script')

            if column not in df.columns:
                violated_rules[rule_name] = "Column not found"
                continue

            if rule_type == 'expression' and expression:
                try:
                    # Evaluate expression using DataFrame.apply and convert result to boolean
                    rule_result = df.apply(lambda row: pd.eval(expression, local_dict={'row': row}), axis=1) == False
                    violated_data = df[rule_result]

                    if not violated_data.empty:
                        violated_rules[rule_name] = {
                            'rule_description': rule_details.get('description', rule_name),
                            'violated_count': len(violated_data),
                            'violated_rows_indices': violated_data.index.tolist(),
                            'expression': expression
                        }

                except Exception as e:
                    violated_rules[rule_name] = f"Error evaluating expression: {e}"
            elif rule_type == 'script' and script:
                try:
                    # Execute script (not implemented for security reasons, consider using expression instead)
                    violated_rules[rule_name] = "Script execution is not supported for security reasons. Use 'expression' type instead."
                except Exception as e:
                    violated_rules[rule_name] = f"Error executing script: {e}"
            else:
                violated_rules[rule_name] = "Invalid rule configuration: type or expression/script missing"

        return violated_rules

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

    def detect_outliers(self, df):
        """Detect outliers using Z-score and IQR methods."""
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        outliers = {}

        for col in numeric_cols:
            # Z-score method
            z_scores = np.abs(stats.zscore(df[col].dropna()))
            z_outliers = len(z_scores[z_scores > self.z_score_threshold])

            # IQR method
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            iqr_outliers = len(df[(df[col] < (Q1 - self.iqr_threshold * IQR)) | (df[col] > (Q3 + self.iqr_threshold * IQR))])

            outliers[col] = {
                'z_score_outliers': int(z_outliers),
                'iqr_outliers': int(iqr_outliers)
            }

        return outliers

    def calculate_quality_scores(self, df):
        """Calculate data quality scores for each column and overall."""
        scores = {}
        overall_score = 0

        for col in df.columns:
            # Initialize score at 100
            score = 100

            # Penalize for missing values
            missing_pct = df[col].isnull().mean()
            score -= missing_pct * 30

            # Penalize for duplicates (if not index)
            if not df[col].is_unique:
                score -= 10

            # Penalize for outliers if numeric
            if pd.api.types.is_numeric_dtype(df[col]):
                z_scores = np.abs(stats.zscore(df[col].dropna()))
                outlier_pct = (z_scores > 3).mean()
                score -= outlier_pct * 20

            # Ensure score is between 0 and 100
            score = max(0, min(100, score))

            # Assign letter grade
            if score >= 90: grade = 'A'
            elif score >= 80: grade = 'B'
            elif score >= 70: grade = 'C'
            elif score >= 60: grade = 'D'
            else: grade = 'F'

            scores[col] = {
                'score': round(score, 2),
                'grade': grade
            }
            overall_score += score

        overall_score = round(overall_score / len(df.columns), 2)
        return {
            'column_scores': scores,
            'overall_score': overall_score,
            'overall_grade': self.get_grade(overall_score)
        }

    def get_grade(self, score):
        """Convert numeric score to letter grade."""
        if score >= 90: return 'A'
        elif score >= 80: return 'B'
        elif score >= 70: return 'C'
        elif score >= 60: return 'D'
        else: return 'F'

    def analyze_distributions(self, df):
        """Analyze distributions of numeric columns."""
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        distributions = {}

        for col in numeric_cols:
            data = df[col].dropna()
            if len(data) < 3:  # Skip if too few samples
                continue

            # Basic statistics
            stats_dict = {
                'mean': float(data.mean()),
                'median': float(data.median()),
                'std': float(data.std()),
                'skewness': float(data.skew()),
                'kurtosis': float(data.kurtosis())
            }

            # Normality tests
            try:
                # Check for zero variance
                if data.var() == 0:
                    stats_dict['normality_tests'] = 'Skipping normality tests - zero variance in data'
                    self.logger.warning(f"Column {col} has zero variance, skipping normality tests")
                else:
                    shapiro_stat, shapiro_p = shapiro(data)
                    anderson_result = anderson(data)

                    stats_dict.update({
                        'normality_tests': {
                            'shapiro_wilk': {
                                'statistic': float(shapiro_stat),
                                'p_value': float(shapiro_p),
                                'is_normal': int(shapiro_p > 0.05)  # Convert boolean to int
                            },
                            'anderson_darling': {
                                'statistic': float(anderson_result.statistic),
                                'critical_values': [float(x) for x in anderson_result.critical_values.tolist()],  # Ensure all values are float
                                'significance_level': [float(x) for x in anderson_result.significance_level.tolist()]  # Ensure all values are float
                            }
                        }
                    })
            except Exception as e:
                self.logger.error(f"Error in normality tests for column {col}: {str(e)}")
                stats_dict['normality_tests'] = f'Could not perform normality tests: {str(e)}'

            distributions[col] = stats_dict

        return distributions

    def detect_multicollinearity(self, df):
        """Detect multicollinearity between numeric features."""
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) < 2:
            return {'message': 'Not enough numeric columns for correlation analysis'}

        corr_matrix = df[numeric_cols].corr()
        high_correlations = []

        for i in range(len(numeric_cols)):
            for j in range(i+1, len(numeric_cols)):
                correlation = abs(corr_matrix.iloc[i, j])
                if correlation > self.correlation_threshold:
                    high_correlations.append({
                        'feature1': numeric_cols[i],
                        'feature2': numeric_cols[j],
                        'correlation': float(correlation)
                    })

        return {
            'correlation_matrix': corr_matrix.to_dict(),
            'high_correlations': high_correlations,
            'threshold': self.correlation_threshold
        }
