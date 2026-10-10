import pandas as pd

from app.transformer.base import BaseTransformer


class ColumnRenameTransformer(BaseTransformer):
    transformer_type = "column_rename"

    def validate_config(self, config: dict) -> None:
        if "mapping" not in config or not isinstance(config["mapping"], dict):
            raise ValueError("column_rename requires config.mapping dict")

    def transform(self, df: pd.DataFrame, config: dict) -> pd.DataFrame:
        self.validate_config(config)
        return df.rename(columns=config["mapping"])
