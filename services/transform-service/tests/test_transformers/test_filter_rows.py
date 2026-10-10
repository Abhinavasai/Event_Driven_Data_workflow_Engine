from app.transformer.filter_rows import FilterRowsTransformer


def test_filter_rows_gt(sample_orders_df):
    cast = sample_orders_df.copy()
    cast["amount"] = [10.5, 0, 5.0, 0]
    result = FilterRowsTransformer().transform(
        cast,
        {"column": "amount", "operator": "gt", "value": 0},
    )
    assert len(result) == 2


def test_filter_drop_nulls(sample_orders_df):
    df = sample_orders_df.copy()
    df.loc[1, "customer_name"] = None
    result = FilterRowsTransformer().transform(
        df,
        {"columns": ["customer_name"], "how": "any"},
    )
    assert len(result) == 3
