import pandas as pd

from app.transformer.pipeline import TransformPipeline


def test_full_pipeline_from_plan_config():
    df = pd.DataFrame(
        {
            "order_id": ["1", "2", "2"],
            "customer_name": ["  alice ", "BOB", "BOB"],
            "amount": ["10.5", "0", "5.0"],
            "order_date": ["2024-01-01", "2024-01-02", "2024-01-02"],
        }
    )
    steps = [
        {
            "type": "normalize",
            "config": {"columns": ["customer_name"], "operations": ["trim", "title_case"]},
        },
        {"type": "type_cast", "config": {"amount": "float64", "order_date": "datetime"}},
        {"type": "derive_columns", "config": {"tax_amount": "amount * 0.08"}},
        {"type": "filter_rows", "config": {"column": "amount", "operator": "gt", "value": 0}},
        {"type": "dedup", "config": {"key_columns": ["order_id"]}},
    ]
    result = TransformPipeline(steps=steps).run(df)
    assert result.input_rows == 3
    assert result.output_rows == 2
    assert result.transformations_applied == [
        "normalize",
        "type_cast",
        "derive_columns",
        "filter_rows",
        "dedup",
    ]
    assert "tax_amount" in result.dataframe.columns
