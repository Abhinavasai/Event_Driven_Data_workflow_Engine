import pandas as pd

from app.transformer.derive_columns import DeriveColumnsTransformer


def test_derive_columns_eval_and_flat_config():
    df = pd.DataFrame({"amount": [100.0, 200.0]})
    result = DeriveColumnsTransformer().transform(df, {"tax_amount": "amount * 0.08"})
    assert list(result["tax_amount"]) == [8.0, 16.0]


def test_derive_columns_with_columns_key():
    df = pd.DataFrame({"first_name": ["Ada"], "last_name": ["Lovelace"]})
    result = DeriveColumnsTransformer().transform(
        df,
        {"columns": {"full_name": "first_name + ' ' + last_name"}},
    )
    assert result.loc[0, "full_name"] == "Ada Lovelace"
