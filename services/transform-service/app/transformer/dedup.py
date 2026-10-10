import pandas as pd

from app.transformer.base import BaseTransformer


class DedupTransformer(BaseTransformer):
    transformer_type = "dedup"

    def validate_config(self, config: dict) -> None:
        if "key_columns" not in config:
            raise ValueError("dedup requires config.key_columns")

    def transform(self, df: pd.DataFrame, config: dict) -> pd.DataFrame:
        self.validate_config(config)
        subset = [c for c in config["key_columns"] if c in df.columns]
        keep = config.get("keep", "first")
        return df.drop_duplicates(subset=subset, keep=keep).reset_index(drop=True)
