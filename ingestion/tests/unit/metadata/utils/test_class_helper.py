import pytest

from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.metadataService import MetadataService
from metadata.generated.schema.entity.services.mlmodelService import MlModelService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.utils.class_helper import (
    get_service_class_from_service_type,
    get_service_type_from_source_type,
)


@pytest.mark.parametrize(
    ("source_type", "expected_service_type"),
    [
        ("looker", ServiceType.Dashboard),
        ("mysql", ServiceType.Database),
        ("kafka", ServiceType.Messaging),
        ("amundsen", ServiceType.Metadata),
        ("mlflow", ServiceType.MlModel),
        ("airflow", ServiceType.Pipeline),
        ("clickhouse_usage", ServiceType.Database),
        ("redshift-usage", ServiceType.Database),
        ("metadata_elasticsearch", ServiceType.Metadata),
    ],
)
def test_get_service_type_from_source_type(
    source_type: str, expected_service_type: ServiceType
):
    actual_service_type = get_service_type_from_source_type(source_type)
    assert actual_service_type == expected_service_type


@pytest.mark.parametrize(
    ("service_type", "expected_service_class"),
    [
        (ServiceType.Dashboard, DashboardService),
        (ServiceType.Database, DatabaseService),
        (ServiceType.Messaging, MessagingService),
        (ServiceType.Metadata, MetadataService),
        (ServiceType.MlModel, MlModelService),
        (ServiceType.Pipeline, PipelineService),
    ],
)
def test_get_service_class_from_service_type(
    service_type: ServiceType, expected_service_class: object
):
    actual_service_class = get_service_class_from_service_type(service_type)
    assert actual_service_class == expected_service_class
