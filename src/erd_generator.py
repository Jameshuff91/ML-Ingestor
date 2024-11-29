import pandas as pd
import numpy as np
import os
import subprocess
from src.logger import setup_logger
import graphviz

logger = setup_logger()

class ERDGenerator:
    def __init__(self):
        self.logger = logger

    def generate(self, df: pd.DataFrame, dot_path: str = None, png_path: str = None) -> str:
        """Generate an ERD from a pandas DataFrame.
        
        Args:
            df: Input DataFrame
            dot_path: Optional path for the DOT file
            png_path: Optional path for the PNG file
        
        Returns:
            Path to the generated ERD image
        """
        try:
            # Create graph
            dot = graphviz.Digraph(comment='Entity Relationship Diagram')
            dot.attr(rankdir='LR')
            
            # Add nodes for each column
            for col in df.columns:
                dot.node(col, f"{col}\n{df[col].dtype}")
                
            # Add edges for potential relationships
            for col1 in df.columns:
                for col2 in df.columns:
                    if col1 != col2 and ('id' in col1.lower() or 'id' in col2.lower()):
                        if df[col1].dtype == df[col2].dtype:
                            dot.edge(col1, col2)
            
            # Use provided paths or generate default ones
            if not dot_path:
                dot_path = os.path.join(os.path.dirname(__file__), '..', 'static', 'plots', 'erd.dot')
            if not png_path:
                png_path = os.path.join(os.path.dirname(__file__), '..', 'static', 'plots', 'erd.png')
                
            # Ensure directories exist
            os.makedirs(os.path.dirname(dot_path), exist_ok=True)
            os.makedirs(os.path.dirname(png_path), exist_ok=True)
            
            # Save DOT file
            dot.save(dot_path)
            
            # Generate PNG
            dot.render(dot_path, format='png', cleanup=True)
            
            # Return path relative to static directory
            return os.path.join('plots', os.path.basename(png_path))
            
        except Exception as e:
            logger.error(f"Error generating ERD: {str(e)}")
            raise

    def detect_relationships(self, df):
        """Detect potential relationships between columns."""
        relationships = []
        
        # Look for foreign key relationships based on column names
        for col in df.columns:
            if col.endswith('_id'):
                # Find the referenced table's primary key
                referenced_col = col.replace('_id', '') + '_id'
                if referenced_col in df.columns:
                    # Check if it's a many-to-one relationship
                    if df[col].nunique() < df[referenced_col].nunique():
                        relationships.append({
                            'from_column': col,
                            'to_column': referenced_col,
                            'type': 'many-to-one'
                        })
        
        # Look for relationships between columns with matching values
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        for col1 in numeric_cols:
            if not col1.endswith('_id'):
                continue
                
            for col2 in numeric_cols:
                if col1 != col2 and col2.endswith('_id'):
                    # Check if values in col1 are a subset of values in col2
                    if set(df[col1].dropna()).issubset(set(df[col2].dropna())):
                        relationships.append({
                            'from_column': col1,
                            'to_column': col2,
                            'type': 'many-to-one'
                        })
        
        return relationships
