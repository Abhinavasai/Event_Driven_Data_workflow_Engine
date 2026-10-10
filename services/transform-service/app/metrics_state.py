from dataclasses import dataclass, field
from threading import Lock


@dataclass
class TransformMetrics:
    transforms_processed: int = 0
    total_duration_ms: int = 0
    error_count: int = 0
    active_transforms: int = 0
    cache_writes: int = 0
    _lock: Lock = field(default_factory=Lock, repr=False)

    def record_success(self, duration_ms: int) -> None:
        with self._lock:
            self.transforms_processed += 1
            self.total_duration_ms += duration_ms

    def record_error(self) -> None:
        with self._lock:
            self.error_count += 1

    def record_cache_write(self) -> None:
        with self._lock:
            self.cache_writes += 1

    @property
    def avg_transform_duration_ms(self) -> float:
        with self._lock:
            if self.transforms_processed == 0:
                return 0.0
            return self.total_duration_ms / self.transforms_processed

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "transforms_processed": self.transforms_processed,
                "avg_transform_duration_ms": round(self.avg_transform_duration_ms, 2),
                "error_count": self.error_count,
                "cache_writes": self.cache_writes,
                "active_transforms": self.active_transforms,
            }


metrics = TransformMetrics()
