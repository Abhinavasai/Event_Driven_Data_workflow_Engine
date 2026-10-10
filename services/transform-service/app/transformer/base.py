from abc import ABC, abstractmethod

import pandas as pd


class BaseTransformer(ABC):
    transformer_type: str

    @abstractmethod
    def transform(self, df: pd.DataFrame, config: dict) -> pd.DataFrame:
        """Apply transformation to DataFrame and return the result."""

    def validate_config(self, config: dict) -> None:
        """Validate transformer-specific config. Raise ValueError if invalid."""
