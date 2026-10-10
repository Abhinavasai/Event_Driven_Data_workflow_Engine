from app.transformer.dedup import DedupTransformer


def test_dedup(sample_orders_df):
    result = DedupTransformer().transform(
        sample_orders_df,
        {"key_columns": ["order_id"], "keep": "first"},
    )
    assert len(result) == 3
