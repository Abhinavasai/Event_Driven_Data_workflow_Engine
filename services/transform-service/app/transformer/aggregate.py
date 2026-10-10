import pandas as pd

from app.transformer.base import BaseTransformer


class AggregateTransformer(BaseTransformer):
    transformer_type = "aggregate"

    def validate_config(self, config: dict) -> None:
        if "group_by" not in config or "aggregations" not in config:
            raise ValueError("aggregate requires group_by and aggregations")

    def transform(self, df: pd.DataFrame, config: dict) -> pd.DataFrame:
        self.validate_config(config)
        group_by = [c for c in config["group_by"] if c in df.columns]
        aggregated = df.groupby(group_by, as_index=False).agg(config["aggregations"])
        rename_map = config.get("rename", {})
        if rename_map:
            aggregated = aggregated.rename(columns=rename_map)
        return aggregated
