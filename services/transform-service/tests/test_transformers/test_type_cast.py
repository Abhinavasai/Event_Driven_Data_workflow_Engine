import pandas as pd

from app.transformer.type_cast import TypeCastTransformer


def test_type_cast_numeric_and_datetime():
    df = pd.DataFrame({"amount": ["1.5", "2"], "order_date": ["2024-01-01", "2024-02-01"]})
    result = TypeCastTransformer().transform(
        df,
        {"amount": "float64", "order_date": "datetime"},
    )
    assert result["amount"].dtype == float
    assert pd.api.types.is_datetime64_any_dtype(result["order_date"])
