import re

import pandas as pd

from app.transformer.base import BaseTransformer


class DeriveColumnsTransformer(BaseTransformer):
    transformer_type = "derive_columns"

    def _column_exprs(self, config: dict) -> dict[str, str]:
        if "columns" in config:
            return config["columns"]
        reserved = {"columns"}
        return {k: v for k, v in config.items() if k not in reserved and isinstance(v, str)}

    def transform(self, df: pd.DataFrame, config: dict) -> pd.DataFrame:
        result = df.copy()
        for new_col, expr in self._column_exprs(config).items():
            if "+" in expr and ".dt." not in expr and ("'" in expr or '"' in expr):
                raw_parts = [p.strip() for p in re.split(r"\s*\+\s*", expr)]
                pieces: list[str | pd.Series] = []
                for part in raw_parts:
                    if (part.startswith("'") and part.endswith("'")) or (
                        part.startswith('"') and part.endswith('"')
                    ):
                        pieces.append(part[1:-1])
                    elif part in result.columns:
                        pieces.append(result[part].astype(str))
                    else:
                        pieces = []
                        break
                if pieces:
                    combined: str | pd.Series = pieces[0]
                    for piece in pieces[1:]:
                        combined = combined + piece
                    result[new_col] = combined
                    continue
            if ".dt." in expr:
                col, attr = expr.split(".dt.", 1)
                col = col.strip()
                if col in result.columns:
                    series = pd.to_datetime(result[col], errors="coerce")
                    if attr == "year":
                        result[new_col] = series.dt.year
                    elif attr == "month":
                        result[new_col] = series.dt.month
                    elif attr == "day":
                        result[new_col] = series.dt.day
                    else:
                        raise ValueError(f"Unsupported datetime attribute: {attr}")
                continue
            try:
                result[new_col] = result.eval(expr)
            except Exception as exc:
                raise ValueError(f"Failed to evaluate expression for {new_col}: {expr}") from exc
        return result
