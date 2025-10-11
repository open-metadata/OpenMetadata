"""High-level entry points for the OpenMetadata Python SDK."""
from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Optional

from metadata.sdk.client import OpenMetadata
from metadata.sdk.config import OpenMetadataConfig
from metadata.sdk.entities import (
    APICollections,
    APIEndpoints,
    Charts,
    Classifications,
    Containers,
    DashboardDataModels,
    Dashboards,
    DashboardServices,
    Databases,
    DatabaseSchemas,
    DatabaseServices,
    DataContracts,
    DataProducts,
    Domains,
    Glossaries,
    GlossaryTerms,
    Metrics,
    MLModels,
    Pipelines,
    Queries,
    SearchIndexes,
    StoredProcedures,
    Tables,
    Tags,
    Teams,
    TestCases,
    TestDefinitions,
    TestSuites,
    Users,
)
from metadata.sdk.entities.base import BaseEntity

_global_client: Optional[OpenMetadata] = None


def configure(
    config: OpenMetadataConfig | Mapping[str, Any] | None = None,
    /,
    **kwargs: Any,
) -> OpenMetadata:
    """Configure the SDK with a connection to OpenMetadata.

    Mirrors the ergonomics of ``stripe.api_key = ...`` by establishing a global
    client that the entity facades rely on. You can either pass an
    :class:`OpenMetadataConfig` instance, a mapping, or keyword arguments.
    """

    global _global_client  # pylint: disable=global-statement

    if config is not None and kwargs:
        raise TypeError("Pass either a config object or keyword arguments, not both")

    config_obj: OpenMetadataConfig
    if config is None:
        if not kwargs:
            raise ValueError("Provide an OpenMetadataConfig or keyword arguments")
        config_obj = OpenMetadataConfig(**kwargs)
    elif isinstance(config, Mapping):
        config_obj = OpenMetadataConfig(**dict(config))
    else:
        config_obj = config

    _global_client = OpenMetadata.initialize(config_obj)
    return _global_client


def client() -> OpenMetadata:
    """Return the active OpenMetadata client."""
    if _global_client is None:
        raise RuntimeError("SDK not configured. Call metadata.sdk.configure(...) first")
    return _global_client


def reset() -> None:
    """Reset the SDK state, closing any cached client."""
    global _global_client  # pylint: disable=global-statement
    OpenMetadata.reset()
    _global_client = None


# Optional lowercase aliases for convenience (similar to stripe.Charge vs stripe.charge)
base_entity = BaseEntity  # pylint: disable=invalid-name
api_collections = APICollections  # pylint: disable=invalid-name
api_endpoints = APIEndpoints  # pylint: disable=invalid-name
charts = Charts  # pylint: disable=invalid-name
classifications = Classifications  # pylint: disable=invalid-name
containers = Containers  # pylint: disable=invalid-name
dashboard_data_models = DashboardDataModels  # pylint: disable=invalid-name
dashboard_services = DashboardServices  # pylint: disable=invalid-name
dashboards = Dashboards  # pylint: disable=invalid-name
data_contracts = DataContracts  # pylint: disable=invalid-name
data_products = DataProducts  # pylint: disable=invalid-name
databases = Databases  # pylint: disable=invalid-name
database_schemas = DatabaseSchemas  # pylint: disable=invalid-name
database_services = DatabaseServices  # pylint: disable=invalid-name
domains = Domains  # pylint: disable=invalid-name
glossaries = Glossaries  # pylint: disable=invalid-name
glossary_terms = GlossaryTerms  # pylint: disable=invalid-name
metrics = Metrics  # pylint: disable=invalid-name
mlmodels = MLModels  # pylint: disable=invalid-name
pipelines = Pipelines  # pylint: disable=invalid-name
queries = Queries  # pylint: disable=invalid-name
search_indexes = SearchIndexes  # pylint: disable=invalid-name
stored_procedures = StoredProcedures  # pylint: disable=invalid-name
tables = Tables  # pylint: disable=invalid-name
tags = Tags  # pylint: disable=invalid-name
teams = Teams  # pylint: disable=invalid-name
test_cases = TestCases  # pylint: disable=invalid-name
test_definitions = TestDefinitions  # pylint: disable=invalid-name
test_suites = TestSuites  # pylint: disable=invalid-name
users = Users  # pylint: disable=invalid-name

__all__ = [
    "OpenMetadata",
    "OpenMetadataConfig",
    "configure",
    "reset",
    "client",
    "BaseEntity",
    "base_entity",
    "APICollections",
    "api_collections",
    "APIEndpoints",
    "api_endpoints",
    "Charts",
    "charts",
    "Classifications",
    "classifications",
    "Containers",
    "containers",
    "DashboardDataModels",
    "dashboard_data_models",
    "DashboardServices",
    "dashboard_services",
    "Dashboards",
    "dashboards",
    "DataContracts",
    "data_contracts",
    "DataProducts",
    "data_products",
    "Databases",
    "databases",
    "DatabaseSchemas",
    "database_schemas",
    "DatabaseServices",
    "database_services",
    "Domains",
    "domains",
    "Glossaries",
    "glossaries",
    "GlossaryTerms",
    "glossary_terms",
    "Metrics",
    "metrics",
    "MLModels",
    "mlmodels",
    "Pipelines",
    "pipelines",
    "Queries",
    "queries",
    "SearchIndexes",
    "search_indexes",
    "StoredProcedures",
    "stored_procedures",
    "Tables",
    "tables",
    "Tags",
    "tags",
    "Teams",
    "teams",
    "TestCases",
    "test_cases",
    "TestDefinitions",
    "test_definitions",
    "TestSuites",
    "test_suites",
    "Users",
    "users",
]
