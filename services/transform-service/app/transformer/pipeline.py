from __future__ import annotations

import logging
from dataclasses import dataclass, field

import pandas as pd

from app.transformer.aggregate import AggregateTransformer
from app.transformer.base import BaseTransformer
from app.transformer.column_rename import ColumnRenameTransformer
from app.transformer.dedup import DedupTransformer
from app.transformer.derive_columns import DeriveColumnsTransformer
from app.transformer.filter_rows import FilterRowsTransformer
from app.transformer.normalize import NormalizeTransformer
from app.transformer.type_cast import TypeCastTransformer

logger = logging.getLogger(__name__)

TRANSFORMER_REGISTRY: dict[str, type[BaseTransformer]] = {
    "column_rename": ColumnRenameTransformer,
    "type_cast": TypeCastTransformer,
    "filter_rows": FilterRowsTransformer,
    "dedup": DedupTransformer,
    "aggregate": AggregateTransformer,
    "derive_columns": DeriveColumnsTransformer,
    "normalize": NormalizeTransformer,
}


@dataclass
class PipelineResult:
    dataframe: pd.DataFrame
    transformations_applied: list[str] = field(default_factory=list)
    input_rows: int = 0
    output_rows: int = 0


class TransformPipeline:
    def __init__(self, steps: list[dict] | None = None) -> None:
        self.steps = steps or []

    def run(self, df: pd.DataFrame) -> PipelineResult:
        current = df.copy()
        applied: list[str] = []
        input_rows = len(current)
        for step in self.steps:
            step_type = step.get("type")
            config = step.get("config", {})
            if not step_type:
                continue
            transformer_cls = TRANSFORMER_REGISTRY.get(step_type)
            if transformer_cls is None:
                raise ValueError(f"Unknown transformation type: {step_type}")
            transformer = transformer_cls()
            transformer.validate_config(config)
            before = len(current)
            current = transformer.transform(current, config)
            after = len(current)
            applied.append(step_type)
            logger.info(
                "Applied %s: rows %s -> %s",
                step_type,
                before,
                after,
            )
        return PipelineResult(
            dataframe=current,
            transformations_applied=applied,
            input_rows=input_rows,
            output_rows=len(current),
        )
