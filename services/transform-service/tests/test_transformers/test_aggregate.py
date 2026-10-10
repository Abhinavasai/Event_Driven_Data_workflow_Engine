import pandas as pd

from app.transformer.aggregate import AggregateTransformer


def test_aggregate():
    df = pd.DataFrame({"category": ["a", "a", "b"], "amount": [1, 2, 3]})
    result = AggregateTransformer().transform(
        df,
        {
            "group_by": ["category"],
            "aggregations": {"amount": "sum"},
            "rename": {"amount": "total_amount"},
        },
    )
    assert len(result) == 2
    totals = sorted(result["total_amount"].tolist())
    assert totals == [3, 3]
