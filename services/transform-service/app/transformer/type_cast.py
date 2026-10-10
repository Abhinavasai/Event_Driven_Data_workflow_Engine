import pandas as pd

from app.transformer.base import BaseTransformer


class TypeCastTransformer(BaseTransformer):
    transformer_type = "type_cast"

    def transform(self, df: pd.DataFrame, config: dict) -> pd.DataFrame:
        result = df.copy()
        errors = config.get("errors", "coerce")
        for column, dtype in config.items():
            if column in ("errors", "defaults"):
                continue
            if column not in result.columns:
                continue
            if dtype in ("datetime", "datetime64", "date"):
                result[column] = pd.to_datetime(result[column], errors=errors)
            elif dtype in ("int", "int64", "integer"):
                result[column] = pd.to_numeric(result[column], errors=errors).astype("Int64")
            elif dtype in ("float", "float64", "decimal"):
                result[column] = pd.to_numeric(result[column], errors=errors)
            elif dtype in ("bool", "boolean"):
                result[column] = result[column].astype(str).str.lower().isin(
                    ["true", "1", "yes", "y"]
                )
            else:
                result[column] = result[column].astype(dtype)
            if column in config.get("defaults", {}):
                default = config["defaults"][column]
                if dtype in ("datetime", "datetime64", "date"):
                    result[column] = result[column].fillna(pd.Timestamp(default))
                else:
                    result[column] = result[column].fillna(default)
        return result
