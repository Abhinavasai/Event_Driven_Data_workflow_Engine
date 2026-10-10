from app.transformer.normalize import NormalizeTransformer


def test_normalize_trim_and_title(sample_orders_df):
    result = NormalizeTransformer().transform(
        sample_orders_df,
        {"columns": ["customer_name"], "operations": ["trim", "title_case"]},
    )
    assert result.loc[0, "customer_name"] == "Alice"
    assert result.loc[1, "customer_name"] == "Bob"
