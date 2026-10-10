import pandas as pd
import pytest


@pytest.fixture
def sample_orders_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "order_id": ["1", "2", "2", "3"],
            "customer_name": ["  alice ", "BOB", "BOB", "charlie"],
            "amount": ["10.5", "0", "5.0", "bad"],
            "order_date": ["2024-01-01", "2024-01-02", "2024-01-02", "2024-01-03"],
        }
    )
