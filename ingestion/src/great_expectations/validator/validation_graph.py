import copy
import json
from typing import Dict, List, Optional, Tuple

from great_expectations.core.id_dict import IDDict


class MetricConfiguration:
    def __init__(
        self,
        metric_name: str,
        metric_domain_kwargs: Dict,
        metric_value_kwargs: dict = None,
        metric_dependencies: dict = None,
    ):
        self._metric_name = metric_name
        if not isinstance(metric_domain_kwargs, IDDict):
            metric_domain_kwargs = IDDict(metric_domain_kwargs)
        self._metric_domain_kwargs = metric_domain_kwargs
        if not isinstance(metric_value_kwargs, IDDict):
            if metric_value_kwargs is None:
                metric_value_kwargs = {}
            metric_value_kwargs = IDDict(metric_value_kwargs)
        self._metric_value_kwargs = metric_value_kwargs
        if metric_dependencies is None:
            metric_dependencies = {}
        self.metric_dependencies = metric_dependencies

    def __repr__(self):
        return json.dumps(self.to_json_dict(), indent=2)

    def __str__(self):
        return self.__repr__()

    @property
    def metric_name(self):
        return self._metric_name

    @property
    def metric_domain_kwargs(self):
        return self._metric_domain_kwargs

    @property
    def metric_value_kwargs(self):
        return self._metric_value_kwargs

    @property
    def metric_domain_kwargs_id(self):
        return self.metric_domain_kwargs.to_id()

    @property
    def metric_value_kwargs_id(self):
        return self.metric_value_kwargs.to_id()

    @property
    def id(self) -> Tuple[str, str, str]:
        return (
            self.metric_name,
            self.metric_domain_kwargs_id,
            self.metric_value_kwargs_id,
        )

    def to_json_dict(self) -> dict:
        json_dict: dict = {
            "metric_name": self.metric_name,
            "metric_domain_kwargs": self.metric_domain_kwargs,
            "metric_domain_kwargs_id": self.metric_domain_kwargs_id,
            "metric_value_kwargs": self.metric_value_kwargs,
            "metric_value_kwargs_id": self.metric_value_kwargs_id,
            "id": self.id,
        }
        return json_dict


class MetricEdge:
    def __init__(self, left: MetricConfiguration, right: Optional[MetricConfiguration]):
        self._left = left
        self._right = right

    @property
    def left(self):
        return self._left

    @property
    def right(self):
        return self._right

    @property
    def id(self):
        if self.right:
            return self.left.id, self.right.id
        return self.left.id, None


class ValidationGraph:
    def __init__(self, edges: Optional[List[MetricEdge]] = None):
        if edges:
            self._edges = edges
        else:
            self._edges = []

        self._edge_ids = {edge.id for edge in self._edges}

    def add(self, edge: MetricEdge):
        if edge.id not in self._edge_ids:
            self._edges.append(edge)
            self._edge_ids.add(edge.id)

    @property
    def edges(self):
        return copy.deepcopy(self._edges)
