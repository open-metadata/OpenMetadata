import logging
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple, Type, Union

import great_expectations.exceptions as ge_exceptions
from great_expectations.core.id_dict import IDDict
from great_expectations.core.metric import Metric
from great_expectations.validator.validation_graph import MetricConfiguration

logger = logging.getLogger(__name__)

_registered_expectations = {}
_registered_metrics = {}
_registered_renderers = {}

"""
{
  "metric_name"
    metric_domain_keys
    metric_value_keys
    metric_dependencies
    providers:
      engine: provider
}
"""


def register_renderer(
    object_name: str,
    parent_class: Type[Union["Expectation", "Metric"]],
    renderer_fn: Callable,
):
    renderer_name = renderer_fn._renderer_type
    if object_name not in _registered_renderers:
        logger.debug(f"Registering {renderer_name} for expectation_type {object_name}.")
        _registered_renderers[object_name] = {
            renderer_name: (parent_class, renderer_fn)
        }
        return

    if renderer_name in _registered_renderers[object_name]:
        if _registered_renderers[object_name][renderer_name] == (
            parent_class,
            renderer_fn,
        ):
            logger.info(
                f"Multiple declarations of {renderer_name} renderer for expectation_type {object_name} "
                f"found."
            )
            return
        else:
            logger.warning(
                f"Overwriting declaration of {renderer_name} renderer for expectation_type "
                f"{object_name}."
            )
            _registered_renderers[object_name][renderer_name] = (
                parent_class,
                renderer_fn,
            )
        return
    else:
        logger.debug(f"Registering {renderer_name} for expectation_type {object_name}.")
        _registered_renderers[object_name][renderer_name] = (parent_class, renderer_fn)
        return


def get_renderer_impl(object_name, renderer_type):
    return _registered_renderers.get(object_name, {}).get(renderer_type)


def register_expectation(expectation: Type["Expectation"]) -> None:
    expectation_type = expectation.expectation_type
    # TODO: add version to key
    if expectation_type in _registered_expectations:
        if _registered_expectations[expectation_type] == expectation:
            logger.info(
                "Multiple declarations of expectation " + expectation_type + " found."
            )
            return
        else:
            logger.warning(
                "Overwriting declaration of expectation " + expectation_type + "."
            )
    logger.debug("Registering expectation: " + expectation_type)
    _registered_expectations[expectation_type] = expectation


def _add_response_key(res, key, value):
    if key in res:
        res[key].append(value)
    else:
        res[key] = [value]
    return res


def register_metric(
    metric_name: str,
    metric_domain_keys: Tuple[str, ...],
    metric_value_keys: Tuple[str, ...],
    execution_engine: Type["ExecutionEngine"],
    metric_class: Type["MetricProvider"],
    metric_provider: Optional[Callable],
    metric_fn_type: Optional[
        Union["MetricFunctionTypes", "MetricPartialFunctionTypes"]
    ] = None,
) -> dict:
    res = {}
    execution_engine_name = execution_engine.__name__
    logger.debug(f"Registering metric: {metric_name}")
    if metric_provider is not None and metric_fn_type is not None:
        metric_provider.metric_fn_type = metric_fn_type
    if metric_name in _registered_metrics:
        metric_definition = _registered_metrics[metric_name]
        current_domain_keys = metric_definition.get("metric_domain_keys", set())
        if set(current_domain_keys) != set(metric_domain_keys):
            logger.warning(
                f"metric {metric_name} is being registered with different metric_domain_keys; overwriting metric_domain_keys"
            )
            _add_response_key(
                res,
                "warning",
                f"metric {metric_name} is being registered with different metric_domain_keys; overwriting metric_domain_keys",
            )
        current_value_keys = metric_definition.get("metric_value_keys", set())
        if set(current_value_keys) != set(metric_value_keys):
            logger.warning(
                f"metric {metric_name} is being registered with different metric_value_keys; overwriting metric_value_keys"
            )
            _add_response_key(
                res,
                "warning",
                f"metric {metric_name} is being registered with different metric_value_keys; overwriting metric_value_keys",
            )
        providers = metric_definition.get("providers", {})
        if execution_engine_name in providers:
            current_provider_cls, current_provider_fn = providers[execution_engine_name]
            if current_provider_fn != metric_provider:
                logger.warning(
                    f"metric {metric_name} is being registered with different metric_provider; overwriting metric_provider"
                )
                _add_response_key(
                    res,
                    "warning",
                    f"metric {metric_name} is being registered with different metric_provider; overwriting metric_provider",
                )
                providers[execution_engine_name] = metric_class, metric_provider
            else:
                logger.info(
                    f"Multiple declarations of metric {metric_name} for engine {execution_engine_name}."
                )
                _add_response_key(
                    res,
                    "info",
                    f"Multiple declarations of metric {metric_name} for engine {execution_engine_name}.",
                )
        else:
            providers[execution_engine_name] = metric_class, metric_provider
    else:
        metric_definition = {
            "metric_domain_keys": metric_domain_keys,
            "metric_value_keys": metric_value_keys,
            "default_kwarg_values": metric_class.default_kwarg_values,
            "providers": {execution_engine_name: (metric_class, metric_provider)},
        }
        _registered_metrics[metric_name] = metric_definition
    res["success"] = True
    return res


def get_metric_provider(
    metric_name: str, execution_engine: "ExecutionEngine"
) -> Tuple["MetricProvider", Callable]:
    try:
        metric_definition = _registered_metrics[metric_name]
        return metric_definition["providers"][type(execution_engine).__name__]
    except KeyError:
        raise ge_exceptions.MetricProviderError(
            f"No provider found for {metric_name} using {type(execution_engine).__name__}"
        )


def get_metric_function_type(
    metric_name: str, execution_engine: "ExecutionEngine"
) -> Optional[Union["MetricPartialFunctionTypes", "MetricFunctionTypes"]]:
    try:
        metric_definition = _registered_metrics[metric_name]
        provider_fn, provider_class = metric_definition["providers"][
            type(execution_engine).__name__
        ]
        return getattr(provider_fn, "metric_fn_type", None)
    except KeyError:
        raise ge_exceptions.MetricProviderError(
            f"No provider found for {metric_name} using {type(execution_engine).__name__}"
        )


def get_metric_kwargs(
    metric_name: str,
    configuration: Optional["ExpectationConfiguration"] = None,
    runtime_configuration: Optional[dict] = None,
) -> Dict:
    try:
        metric_definition = _registered_metrics.get(metric_name)
        if metric_definition is None:
            raise ge_exceptions.MetricProviderError(
                f"No definition found for {metric_name}"
            )
        default_kwarg_values = metric_definition["default_kwarg_values"]
        metric_kwargs = {
            "metric_domain_keys": metric_definition["metric_domain_keys"],
            "metric_value_keys": metric_definition["metric_value_keys"],
        }
        if configuration:
            expectation_impl = get_expectation_impl(configuration.expectation_type)
            configuration_kwargs = expectation_impl().get_runtime_kwargs(
                configuration=configuration, runtime_configuration=runtime_configuration
            )
            if len(metric_kwargs["metric_domain_keys"]) > 0:
                metric_domain_kwargs = IDDict(
                    {
                        k: configuration_kwargs.get(k) or default_kwarg_values.get(k)
                        for k in metric_kwargs["metric_domain_keys"]
                    }
                )
            else:
                metric_domain_kwargs = IDDict()
            if len(metric_kwargs["metric_value_keys"]) > 0:
                metric_value_kwargs = IDDict(
                    {
                        k: configuration_kwargs.get(k)
                        if configuration_kwargs.get(k) is not None
                        else default_kwarg_values.get(k)
                        for k in metric_kwargs["metric_value_keys"]
                    }
                )
            else:
                metric_value_kwargs = IDDict()
            metric_kwargs["metric_domain_kwargs"] = metric_domain_kwargs
            metric_kwargs["metric_value_kwargs"] = metric_value_kwargs
        return metric_kwargs
    except KeyError:
        raise ge_exceptions.MetricProviderError(
            f"Incomplete definition found for {metric_name}"
        )


def get_domain_metrics_dict_by_name(
    metrics: Dict[Tuple, Any], metric_domain_kwargs: IDDict
):
    return {
        metric_edge_key_id_tuple[0]: metric_value
        for metric_edge_key_id_tuple, metric_value in metrics.items()
        if metric_edge_key_id_tuple[1] == metric_domain_kwargs.to_id()
    }


def get_expectation_impl(expectation_name):
    return _registered_expectations.get(expectation_name)


def list_registered_expectation_implementations(
    expectation_root: Type["Expectation"] = None,
) -> List[str]:
    registered_expectation_implementations = []
    for (
        expectation_name,
        expectation_implementation,
    ) in _registered_expectations.items():
        if expectation_root is None:
            registered_expectation_implementations.append(expectation_name)
        elif expectation_root and issubclass(
            expectation_implementation, expectation_root
        ):
            registered_expectation_implementations.append(expectation_name)

    return registered_expectation_implementations
