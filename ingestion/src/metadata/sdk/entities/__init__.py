"""
OpenMetadata SDK Entities - Plural naming convention to avoid conflicts with generated entities
"""
from metadata.sdk.entities.apicollections import APICollections
from metadata.sdk.entities.apiendpoints import APIEndpoints
from metadata.sdk.entities.charts import Charts
from metadata.sdk.entities.classifications import Classifications
from metadata.sdk.entities.containers import Containers
from metadata.sdk.entities.dashboard_services import DashboardServices
from metadata.sdk.entities.dashboarddatamodels import DashboardDataModels
from metadata.sdk.entities.dashboards import Dashboards
from metadata.sdk.entities.database_services import DatabaseServices
from metadata.sdk.entities.databases import Databases
from metadata.sdk.entities.databaseschemas import DatabaseSchemas
from metadata.sdk.entities.datacontracts import DataContracts
from metadata.sdk.entities.dataproducts import DataProducts
from metadata.sdk.entities.domains import Domains
from metadata.sdk.entities.glossaries import Glossaries
from metadata.sdk.entities.glossaryterms import GlossaryTerms
from metadata.sdk.entities.metrics import Metrics
from metadata.sdk.entities.mlmodels import MLModels
from metadata.sdk.entities.pipelines import Pipelines
from metadata.sdk.entities.queries import Queries
from metadata.sdk.entities.searchindexes import SearchIndexes
from metadata.sdk.entities.storedprocedures import StoredProcedures
from metadata.sdk.entities.tables import Tables
from metadata.sdk.entities.tags import Tags
from metadata.sdk.entities.teams import Teams
from metadata.sdk.entities.testcases import TestCases
from metadata.sdk.entities.testdefinitions import TestDefinitions
from metadata.sdk.entities.testsuites import TestSuites
from metadata.sdk.entities.users import Users

__all__ = [
    "APICollections",
    "APIEndpoints",
    "Charts",
    "Classifications",
    "Containers",
    "DashboardDataModels",
    "Dashboards",
    "DatabaseServices",
    "DashboardServices",
    "Databases",
    "DatabaseSchemas",
    "DataContracts",
    "DataProducts",
    "Domains",
    "Glossaries",
    "GlossaryTerms",
    "Metrics",
    "MLModels",
    "Pipelines",
    "Queries",
    "SearchIndexes",
    "StoredProcedures",
    "Tables",
    "Tags",
    "Teams",
    "TestCases",
    "TestDefinitions",
    "TestSuites",
    "Users",
]
