import os
import pandas as pd
import graphviz
from typing import Optional

class ERDGenerator:
    """Generate Entity Relationship Diagrams from pandas DataFrames."""
    
    def __init__(self):
        """Initialize the ERD Generator."""
        pass
        
    def generate_erd(self, df: pd.DataFrame, filename: str) -> str:
        """
        Generate an ERD from a pandas DataFrame.
        
        Args:
            df: The DataFrame to analyze
            filename: Original filename for naming the output file
        
        Returns:
            str: Path to the generated ERD image file
        """
        # Create a graph
        dot = graphviz.Digraph(comment=f'ERD for {filename}')
        dot.attr(rankdir='LR')
        
        # Add table node
        table_name = os.path.splitext(filename)[0]
        label = f'{table_name}\\n'
        
        # Add columns
        for col in df.columns:
            dtype = str(df[col].dtype)
            label += f'{col} ({dtype})\\n'
        
        dot.node(table_name, label)
        
        # Save the graph
        output_dir = os.path.join('static', 'plots')
        os.makedirs(output_dir, exist_ok=True)
        
        output_filename = f'erd_{os.path.splitext(filename)[0]}'
        output_path = os.path.join(output_dir, output_filename)
        
        # Render and save
        dot.render(output_path, format='png', cleanup=True)
        
        # Return the relative path for web access
        return os.path.join('static', 'plots', f'{output_filename}.png')
