from app.transformer.column_rename import ColumnRenameTransformer


def test_column_rename(sample_orders_df):
    transformer = ColumnRenameTransformer()
    result = transformer.transform(
        sample_orders_df,
        {"mapping": {"customer_name": "customer", "order_id": "id"}},
    )
    assert list(result.columns) == ["id", "customer", "amount", "order_date"]
