"""High-level entry points for the OpenMetadata Python SDK."""
from __future__ import annotations

from collections.abc import Mapping
from typing import Optional

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
    config: OpenMetadataConfig | Mapping[str, object] | None = None,
    /,
    **kwargs: object,
) -> OpenMetadata:
    """Configure the SDK with a connection to OpenMetadata.

    Mirrors the ergonomics of ``stripe.api_key = ...`` by establishing a global
    client that the entity facades rely on. You can either pass an
    :class:`OpenMetadataConfig` instance, a mapping, or keyword arguments.
    """

    global _global_client

    if config is not None and kwargs:
        raise TypeError("Pass either a config object or keyword arguments, not both")

    if config is None:
        if not kwargs:
            raise ValueError("Provide an OpenMetadataConfig or keyword arguments")
        config = OpenMetadataConfig(**kwargs)  # type: ignore[arg-type]
    elif isinstance(config, Mapping):
        config = OpenMetadataConfig(**config)  # type: ignore[arg-type]
    elif not isinstance(config, OpenMetadataConfig):
        raise TypeError("Unsupported configuration payload")

    _global_client = OpenMetadata.initialize(config)
    return _global_client


def client() -> OpenMetadata:
    """Return the active OpenMetadata client."""
    if _global_client is None:
        raise RuntimeError("SDK not configured. Call metadata.sdk.configure(...) first")
    return _global_client


def reset() -> None:
    """Reset the SDK state, closing any cached client."""
    global _global_client
    OpenMetadata.reset()
    _global_client = None


# Re-export resource facades following the Stripe convention
BaseEntity = BaseEntity
APICollections = APICollections
APIEndpoints = APIEndpoints
Charts = Charts
Classifications = Classifications
Containers = Containers
DashboardDataModels = DashboardDataModels
DashboardServices = DashboardServices
Dashboards = Dashboards
DataContracts = DataContracts
DataProducts = DataProducts
Databases = Databases
DatabaseSchemas = DatabaseSchemas
DatabaseServices = DatabaseServices
Domains = Domains
Glossaries = Glossaries
GlossaryTerms = GlossaryTerms
Metrics = Metrics
MLModels = MLModels
Pipelines = Pipelines
Queries = Queries
SearchIndexes = SearchIndexes
StoredProcedures = StoredProcedures
Tables = Tables
Tags = Tags
Teams = Teams
TestCases = TestCases
TestDefinitions = TestDefinitions
TestSuites = TestSuites
Users = Users

# Optional lowercase aliases for convenience (similar to stripe.Charge vs stripe.charge)
base_entity = BaseEntity
api_collections = APICollections
api_endpoints = APIEndpoints
charts = Charts
classifications = Classifications
containers = Containers
dashboard_data_models = DashboardDataModels
dashboard_services = DashboardServices
dashboards = Dashboards
data_contracts = DataContracts
data_products = DataProducts
databases = Databases
database_schemas = DatabaseSchemas
database_services = DatabaseServices
domains = Domains
glossaries = Glossaries
glossary_terms = GlossaryTerms
metrics = Metrics
mlmodels = MLModels
pipelines = Pipelines
queries = Queries
search_indexes = SearchIndexes
stored_procedures = StoredProcedures
tables = Tables
tags = Tags
teams = Teams
test_cases = TestCases
test_definitions = TestDefinitions
test_suites = TestSuites
users = Users

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
