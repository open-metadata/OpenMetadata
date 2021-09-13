import logging
from typing import Any, Union, cast

import great_expectations.exceptions as ge_exceptions
from great_expectations.data_context.store import (
    CheckpointStore,
    ConfigurationStore,
    StoreBackend,
)
from great_expectations.data_context.types.base import BaseYamlConfig, CheckpointConfig
from great_expectations.data_context.types.resource_identifiers import (
    ConfigurationIdentifier,
)
from great_expectations.data_context.util import build_store_from_config

logger = logging.getLogger(__name__)


def build_configuration_store(
    class_name: str,
    store_name: str,
    store_backend: Union[StoreBackend, dict],
    *,
    module_name: str = "great_expectations.data_context.store",
    overwrite_existing: bool = False,
    **kwargs,
) -> ConfigurationStore:
    logger.debug(
        f"Starting data_context/store/util.py#build_configuration_store for store_name {store_name}"
    )

    if store_backend is not None and issubclass(type(store_backend), StoreBackend):
        store_backend = store_backend.config
    elif not isinstance(store_backend, dict):
        raise ge_exceptions.DataContextError(
            "Invalid configuration: A store_backend needs to be a dictionary or inherit from the StoreBackend class."
        )

    store_backend.update(**kwargs)

    store_config: dict = {
        "store_name": store_name,
        "module_name": module_name,
        "class_name": class_name,
        "overwrite_existing": overwrite_existing,
        "store_backend": store_backend,
    }
    configuration_store: ConfigurationStore = build_store_from_config(
        store_config=store_config,
        module_name=module_name,
        runtime_environment=None,
    )
    return configuration_store


def build_checkpoint_store_using_store_backend(
    store_name: str,
    store_backend: Union[StoreBackend, dict],
    overwrite_existing: bool = False,
) -> CheckpointStore:
    return cast(
        CheckpointStore,
        build_configuration_store(
            class_name="CheckpointStore",
            module_name="great_expectations.data_context.store",
            store_name=store_name,
            store_backend=store_backend,
            overwrite_existing=overwrite_existing,
        ),
    )


def save_config_to_store_backend(
    class_name: str,
    module_name: str,
    store_name: str,
    store_backend: Union[StoreBackend, dict],
    configuration_key: str,
    configuration: BaseYamlConfig,
):
    config_store: ConfigurationStore = build_configuration_store(
        class_name=class_name,
        module_name=module_name,
        store_name=store_name,
        store_backend=store_backend,
        overwrite_existing=True,
    )
    key: ConfigurationIdentifier = ConfigurationIdentifier(
        configuration_key=configuration_key,
    )
    config_store.set(key=key, value=configuration)


def load_config_from_store_backend(
    class_name: str,
    module_name: str,
    store_name: str,
    store_backend: Union[StoreBackend, dict],
    configuration_key: str,
) -> BaseYamlConfig:
    config_store: ConfigurationStore = build_configuration_store(
        class_name=class_name,
        module_name=module_name,
        store_name=store_name,
        store_backend=store_backend,
        overwrite_existing=False,
    )
    key: ConfigurationIdentifier = ConfigurationIdentifier(
        configuration_key=configuration_key,
    )
    return config_store.get(key=key)


def delete_config_from_store_backend(
    class_name: str,
    module_name: str,
    store_name: str,
    store_backend: Union[StoreBackend, dict],
    configuration_key: str,
):
    config_store: ConfigurationStore = build_configuration_store(
        class_name=class_name,
        module_name=module_name,
        store_name=store_name,
        store_backend=store_backend,
        overwrite_existing=True,
    )
    key: ConfigurationIdentifier = ConfigurationIdentifier(
        configuration_key=configuration_key,
    )
    config_store.remove_key(key=key)


def save_checkpoint_config_to_store_backend(
    store_name: str,
    store_backend: Union[StoreBackend, dict],
    checkpoint_name: str,
    checkpoint_configuration: CheckpointConfig,
):
    config_store: CheckpointStore = build_checkpoint_store_using_store_backend(
        store_name=store_name,
        store_backend=store_backend,
        overwrite_existing=True,
    )
    key: ConfigurationIdentifier = ConfigurationIdentifier(
        configuration_key=checkpoint_name,
    )
    config_store.set(key=key, value=checkpoint_configuration)


def load_checkpoint_config_from_store_backend(
    store_name: str,
    store_backend: Union[StoreBackend, dict],
    checkpoint_name: str,
) -> CheckpointConfig:
    config_store: CheckpointStore = build_checkpoint_store_using_store_backend(
        store_name=store_name,
        store_backend=store_backend,
    )
    key: ConfigurationIdentifier = ConfigurationIdentifier(
        configuration_key=checkpoint_name,
    )
    try:
        return config_store.get(key=key)
    except ge_exceptions.InvalidBaseYamlConfigError as exc:
        logger.error(exc.messages)
        raise ge_exceptions.InvalidCheckpointConfigError(
            "Error while processing DataContextConfig.", exc
        )


def delete_checkpoint_config_from_store_backend(
    store_name: str,
    store_backend: Union[StoreBackend, dict],
    checkpoint_name: str,
):
    config_store: CheckpointStore = build_checkpoint_store_using_store_backend(
        store_name=store_name,
        store_backend=store_backend,
    )
    key: ConfigurationIdentifier = ConfigurationIdentifier(
        configuration_key=checkpoint_name,
    )
    config_store.remove_key(key=key)
