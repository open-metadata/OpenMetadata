import copy
import logging
from functools import wraps
from typing import Callable, Optional, Type, Union

import great_expectations.exceptions as ge_exceptions
from great_expectations.core import ExpectationConfiguration
from great_expectations.core.util import nested_update
from great_expectations.execution_engine import ExecutionEngine
from great_expectations.execution_engine.execution_engine import (
    MetricDomainTypes,
    MetricFunctionTypes,
    MetricPartialFunctionTypes,
)
from great_expectations.expectations.metrics import MetaMetricProvider
from great_expectations.expectations.registry import (
    get_metric_function_type,
    get_metric_provider,
    register_metric,
    register_renderer,
)
from great_expectations.validator.validation_graph import MetricConfiguration

logger = logging.getLogger(__name__)


def metric_value(
    engine: Type[ExecutionEngine],
    metric_fn_type: Union[str, MetricFunctionTypes] = MetricFunctionTypes.VALUE,
    **kwargs,
):
    """The metric decorator annotates a method"""

    def wrapper(metric_fn: Callable):
        @wraps(metric_fn)
        def inner_func(*args, **kwargs):
            return metric_fn(*args, **kwargs)

        inner_func.metric_engine = engine
        inner_func.metric_fn_type = MetricFunctionTypes(metric_fn_type)
        inner_func.metric_definition_kwargs = kwargs
        return inner_func

    return wrapper


def metric_partial(
    engine: Type[ExecutionEngine],
    partial_fn_type: Union[str, MetricPartialFunctionTypes],
    domain_type: Union[str, MetricDomainTypes],
    **kwargs,
):
    """The metric decorator annotates a method"""

    def wrapper(metric_fn: Callable):
        @wraps(metric_fn)
        def inner_func(*args, **kwargs):
            return metric_fn(*args, **kwargs)

        inner_func.metric_engine = engine
        inner_func.metric_fn_type = MetricPartialFunctionTypes(
            partial_fn_type
        )  # raises ValueError if unknown type
        inner_func.domain_type = MetricDomainTypes(domain_type)
        inner_func.metric_definition_kwargs = kwargs
        return inner_func

    return wrapper


class MetricProvider(metaclass=MetaMetricProvider):
    """Base class for all metric providers.

    MetricProvider classes *must* have the following attributes set:
        1. `metric_name`: the name to use. Metric Name must be globally unique in
           a great_expectations installation.
        1. `domain_keys`: a tuple of the *keys* used to determine the domain of the
           metric
        2. `value_keys`: a tuple of the *keys* used to determine the value of
           the metric.

    In some cases, subclasses of Expectation, such as TableMetricProvider will already
    have correct values that may simply be inherited.

    They *may* optionally override the `default_kwarg_values` attribute.

    MetricProvider classes *must* implement the following:
        1. `_get_evaluation_dependencies`. Note that often, _get_evaluation_dependencies should
        augment dependencies provided by a parent class; consider calling super()._get_evaluation_dependencies

    In some cases, subclasses of Expectation, such as MapMetricProvider will already
    have correct implementations that may simply be inherited.

    Additionally, they *may* provide implementations of:
        1. Data Docs rendering methods decorated with the @renderer decorator. See the guide
        "How to create renderers for custom expectations" for more information.

    """

    domain_keys = tuple()
    value_keys = tuple()
    default_kwarg_values = {}

    @classmethod
    def _register_metric_functions(cls):
        metric_name = getattr(cls, "metric_name", None)
        metric_domain_keys = cls.domain_keys
        metric_value_keys = cls.value_keys

        for attr_name in dir(cls):
            attr_obj = getattr(cls, attr_name)
            if not hasattr(attr_obj, "metric_engine") and not hasattr(
                attr_obj, "_renderer_type"
            ):
                # This is not a metric or renderer
                continue
            elif hasattr(attr_obj, "metric_engine"):
                engine = getattr(attr_obj, "metric_engine")
                if not issubclass(engine, ExecutionEngine):
                    raise ValueError(
                        "metric functions must be defined with an Execution Engine"
                    )
                metric_fn = attr_obj
                if metric_name is None:
                    # No metric name has been defined
                    continue
                metric_definition_kwargs = getattr(
                    metric_fn, "metric_definition_kwargs", {}
                )
                declared_metric_name = metric_name + metric_definition_kwargs.get(
                    "metric_name_suffix", ""
                )
                metric_fn_type = getattr(
                    metric_fn, "metric_fn_type", MetricFunctionTypes.VALUE
                )
                if metric_fn_type == MetricFunctionTypes.VALUE:
                    register_metric(
                        metric_name=declared_metric_name,
                        metric_domain_keys=metric_domain_keys,
                        metric_value_keys=metric_value_keys,
                        execution_engine=engine,
                        metric_class=cls,
                        metric_provider=metric_fn,
                        metric_fn_type=metric_fn_type,
                    )
                else:
                    register_metric(
                        metric_name=declared_metric_name
                        + "."
                        + metric_fn_type.metric_suffix,  # this will be a MetricPartial
                        metric_domain_keys=metric_domain_keys,
                        metric_value_keys=metric_value_keys,
                        execution_engine=engine,
                        metric_class=cls,
                        metric_provider=metric_fn,
                        metric_fn_type=metric_fn_type,
                    )
                    register_metric(
                        metric_name=declared_metric_name,
                        metric_domain_keys=metric_domain_keys,
                        metric_value_keys=metric_value_keys,
                        execution_engine=engine,
                        metric_class=cls,
                        metric_provider=None,
                        metric_fn_type=metric_fn_type,
                    )
            elif hasattr(attr_obj, "_renderer_type"):
                register_renderer(
                    object_name=metric_name, parent_class=cls, renderer_fn=attr_obj
                )

    @classmethod
    def get_evaluation_dependencies(
        cls,
        metric: MetricConfiguration,
        configuration: Optional[ExpectationConfiguration] = None,
        execution_engine: Optional[ExecutionEngine] = None,
        runtime_configuration: Optional[dict] = None,
    ):
        """This should return a dictionary:

        {
          "dependency_name": MetricConfiguration,
          ...
        }
        """
        return (
            cls._get_evaluation_dependencies(
                metric=metric,
                configuration=configuration,
                execution_engine=execution_engine,
                runtime_configuration=runtime_configuration,
            )
            or {}
        )

    @classmethod
    def _get_evaluation_dependencies(
        cls,
        metric: MetricConfiguration,
        configuration: Optional[ExpectationConfiguration] = None,
        execution_engine: Optional[ExecutionEngine] = None,
        runtime_configuration: Optional[dict] = None,
    ):
        metric_name = metric.metric_name
        dependencies = {}
        for metric_fn_type in MetricPartialFunctionTypes:
            metric_suffix = "." + metric_fn_type.metric_suffix
            try:
                _ = get_metric_provider(metric_name + metric_suffix, execution_engine)
                has_aggregate_fn = True
            except ge_exceptions.MetricProviderError:
                has_aggregate_fn = False
            if has_aggregate_fn:
                dependencies["metric_partial_fn"] = MetricConfiguration(
                    metric_name + metric_suffix,
                    metric.metric_domain_kwargs,
                    metric.metric_value_kwargs,
                )
        return dependencies
