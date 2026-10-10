import pandas as pd

from app.transformer.base import BaseTransformer

_OPERATORS = {
    "eq": lambda s, v: s == v,
    "ne": lambda s, v: s != v,
    "gt": lambda s, v: s > v,
    "ge": lambda s, v: s >= v,
    "lt": lambda s, v: s < v,
    "le": lambda s, v: s <= v,
    "isin": lambda s, v: s.isin(v if isinstance(v, list) else [v]),
    "notin": lambda s, v: ~s.isin(v if isinstance(v, list) else [v]),
    "isnull": lambda s, _: s.isna(),
    "notnull": lambda s, _: s.notna(),
}


class FilterRowsTransformer(BaseTransformer):
    transformer_type = "filter_rows"

    def transform(self, df: pd.DataFrame, config: dict) -> pd.DataFrame:
        if "columns" in config:
            how = config.get("how", "any")
            subset = [c for c in config["columns"] if c in df.columns]
            return df.dropna(subset=subset, how=how)

        column = config.get("column")
        operator = config.get("operator", "eq")
        value = config.get("value")
        if not column or column not in df.columns:
            return df
        if operator not in _OPERATORS:
            raise ValueError(f"Unsupported filter operator: {operator}")
        mask = _OPERATORS[operator](df[column], value)
        return df.loc[mask].reset_index(drop=True)
