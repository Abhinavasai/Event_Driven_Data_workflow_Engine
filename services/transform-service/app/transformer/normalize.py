import pandas as pd

from app.transformer.base import BaseTransformer


class NormalizeTransformer(BaseTransformer):
    transformer_type = "normalize"

    def validate_config(self, config: dict) -> None:
        if "columns" not in config:
            raise ValueError("normalize requires config.columns")

    def transform(self, df: pd.DataFrame, config: dict) -> pd.DataFrame:
        self.validate_config(config)
        result = df.copy()
        operations = config.get("operations", ["trim"])
        for column in config["columns"]:
            if column not in result.columns:
                continue
            series = result[column].astype(str)
            for op in operations:
                if op in ("trim", "strip_whitespace"):
                    series = series.str.strip()
                elif op == "lowercase":
                    series = series.str.lower()
                elif op == "uppercase":
                    series = series.str.upper()
                elif op == "title_case":
                    series = series.str.title()
            result[column] = series
        return result
