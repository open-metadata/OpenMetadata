#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""MinIO and S3 container classification test fixtures"""

import csv
import io
import json
import uuid
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from _openmetadata_testutils.factories.metadata.generated.schema.api.classification.create_classification import (
    CreateClassificationRequestFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.api.classification.create_tag import (
    CreateTagRequestFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.type.recognizer import (
    RecognizerFactory,
)
from _openmetadata_testutils.ometa import OM_JWT, int_admin_ometa
from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.entity.classification.classification import (
    Classification,
    ConflictResolution,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.services.storageService import StorageService
from metadata.generated.schema.entity.teams.user import AuthenticationMechanism, User
from metadata.generated.schema.type.predefinedRecognizer import Name
from metadata.generated.schema.type.recognizer import Recognizer
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.storage.storage_service import (
    OPENMETADATA_TEMPLATE_FILE_NAME,
)
from metadata.workflow.classification import AutoClassificationWorkflow
from metadata.workflow.metadata import MetadataWorkflow

from ...containers import MinioContainerConfigs, get_minio_container


@pytest.fixture(scope="module")
def metadata():
    return int_admin_ometa()


@pytest.fixture(scope="module")
def service_name():
    return f"s3_container_classification_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def bucket_name():
    return "test-pii-bucket"


@pytest.fixture(scope="module", autouse=True)
def mock_cloudwatch():
    """Mock CloudWatch client since MinIO doesn't support it"""
    from metadata.clients.aws_client import AWSClient

    original_get_client = AWSClient.get_client

    def get_client_override(self, service_name):
        if service_name == "cloudwatch":
            mock_cw = MagicMock()
            mock_cw.get_metric_data.return_value = {"MetricDataResults": [{"StatusCode": "Complete", "Values": [0]}]}
            mock_cw.list_metrics.return_value = {"Metrics": []}
            return mock_cw
        return original_get_client(self, service_name)

    with patch.object(AWSClient, "get_client", get_client_override):
        yield


@pytest.fixture(scope="module")
def minio(bucket_name):
    config = MinioContainerConfigs(container_name=f"minio_{uuid.uuid4().hex[:8]}")
    minio_container = get_minio_container(config)
    minio_container.with_exposed_ports(9000, 9001)

    with minio_container:
        minio_client = minio_container.get_client()
        minio_client.make_bucket(bucket_name)
        yield minio_container, minio_client


@pytest.fixture(scope="module")
def pii_customers_csv():
    """Generate CSV data with PII fields"""
    csv_data = [
        [
            "customer_id",
            "name",
            "email",
            "phone",
            "ssn",
            "credit_card",
            "address",
            "created_date",
        ],
        [
            "1",
            "John Smith",
            "john.smith@example.com",
            "+1-555-123-4567",
            "479-13-8850",
            "4242-4242-4242-4242",
            "123 Main St",
            "2024-01-15",
        ],
        [
            "2",
            "Alice Johnson",
            "alice.j@company.org",
            "+1-555-987-6543",
            "153-10-3105",
            "5555-5555-5555-4444",
            "456 Oak Ave",
            "2024-02-20",
        ],
        [
            "3",
            "Bob Williams",
            "bob.w@test.com",
            "+1-555-246-8135",
            "456-78-9012",
            "4000-0566-5566-5556",
            "789 Pine Rd",
            "2024-03-10",
        ],
        [
            "4",
            "Carol Davis",
            "carol.davis@mail.net",
            "+1-555-369-2580",
            "234-56-7890",
            "2223-0031-2200-3222",
            "321 Elm St",
            "2024-04-05",
        ],
        [
            "5",
            "David Brown",
            "d.brown@domain.io",
            "+1-555-147-2589",
            "345-67-8901",
            "5200-8282-8282-8210",
            "654 Maple Dr",
            "2024-05-12",
        ],
    ]

    csv_buffer = io.StringIO()
    writer = csv.writer(csv_buffer)
    writer.writerows(csv_data)
    return csv_buffer.getvalue().encode("utf-8")


@pytest.fixture(scope="module")
def non_pii_orders_csv():
    """Generate CSV data without PII fields"""
    csv_data = [
        ["order_id", "product_id", "quantity", "price", "order_date"],
        ["1001", "PROD-A", "2", "29.99", "2024-01-15"],
        ["1002", "PROD-B", "1", "49.99", "2024-01-16"],
        ["1003", "PROD-C", "5", "9.99", "2024-01-17"],
        ["1004", "PROD-A", "3", "29.99", "2024-01-18"],
        ["1005", "PROD-D", "1", "99.99", "2024-01-19"],
    ]

    csv_buffer = io.StringIO()
    writer = csv.writer(csv_buffer)
    writer.writerows(csv_data)
    return csv_buffer.getvalue().encode("utf-8")


@pytest.fixture(scope="module")
def pii_employees_parquet():
    """Generate Parquet data with PII fields"""
    data = {
        "employee_id": [1, 2, 3, 4, 5],
        "full_name": [
            "Sarah Thompson",
            "Michael Chen",
            "Jennifer Martinez",
            "Robert Taylor",
            "Emily Anderson",
        ],
        "email": [
            "s.thompson@corp.com",
            "m.chen@corp.com",
            "j.martinez@corp.com",
            "r.taylor@corp.com",
            "e.anderson@corp.com",
        ],
        "ssn": [
            "111-22-3333",
            "444-55-6666",
            "777-88-9999",
            "222-33-4444",
            "555-66-7777",
        ],
        "phone": [
            "+1-555-111-2222",
            "+1-555-333-4444",
            "+1-555-555-6666",
            "+1-555-777-8888",
            "+1-555-999-0000",
        ],
        "hire_date": [
            "2020-01-15",
            "2021-03-20",
            "2019-07-10",
            "2022-05-05",
            "2023-02-28",
        ],
    }

    df = pd.DataFrame(data)
    parquet_buffer = io.BytesIO()
    df.to_parquet(parquet_buffer, engine="pyarrow", index=False)
    parquet_buffer.seek(0)
    return parquet_buffer.getvalue()


@pytest.fixture(scope="module")
def upload_test_data(minio, bucket_name, pii_customers_csv, non_pii_orders_csv, pii_employees_parquet):
    """Upload test data files to MinIO"""
    _, minio_client = minio

    minio_client.put_object(
        bucket_name,
        "customers/data.csv",
        io.BytesIO(pii_customers_csv),
        len(pii_customers_csv),
        content_type="text/csv",
    )

    minio_client.put_object(
        bucket_name,
        "orders/data.csv",
        io.BytesIO(non_pii_orders_csv),
        len(non_pii_orders_csv),
        content_type="text/csv",
    )

    minio_client.put_object(
        bucket_name,
        "employees/data.parquet",
        io.BytesIO(pii_employees_parquet),
        len(pii_employees_parquet),
        content_type="application/octet-stream",
    )

    metadata_config = {
        "entries": [
            {
                "dataPath": "customers",
                "structureFormat": "csv",
                "separator": ",",
            },
            {
                "dataPath": "orders",
                "structureFormat": "csv",
                "separator": ",",
            },
            {
                "dataPath": "employees",
                "structureFormat": "parquet",
            },
        ]
    }
    metadata_json = json.dumps(metadata_config).encode("utf-8")
    minio_client.put_object(
        bucket_name,
        OPENMETADATA_TEMPLATE_FILE_NAME,
        io.BytesIO(metadata_json),
        len(metadata_json),
        content_type="application/json",
    )

    yield

    for obj in minio_client.list_objects(bucket_name):
        minio_client.remove_object(bucket_name, obj.object_name)


@pytest.fixture(scope="module")
def storage_service_config(minio, service_name, bucket_name):
    """Storage service configuration for S3/MinIO"""
    minio_container, _ = minio
    return {
        "source": {
            "type": "s3",
            "serviceName": service_name,
            "serviceConnection": {
                "config": {
                    "type": "S3",
                    "awsConfig": {
                        "awsAccessKeyId": minio_container.access_key,
                        "awsSecretAccessKey": minio_container.secret_key,
                        "awsRegion": "us-east-1",
                        "endPointURL": f"http://localhost:{minio_container.get_exposed_port(9000)}",
                    },
                    "bucketNames": [bucket_name],
                }
            },
            "sourceConfig": {"config": {"type": "StorageMetadata"}},
        },
        "sink": {"type": "metadata-rest", "config": {}},
        "workflowConfig": {
            "loggerLevel": "DEBUG",
            "openMetadataServerConfig": {
                "hostPort": "http://localhost:8585/api",
                "authProvider": "openmetadata",
                "securityConfig": {"jwtToken": OM_JWT},
            },
        },
    }


@pytest.fixture(scope="module")
def ingest_storage_metadata(metadata, storage_service_config, upload_test_data, run_workflow):
    """Ingest storage service metadata"""
    workflow = run_workflow(MetadataWorkflow, storage_service_config)
    yield workflow

    service_name = storage_service_config["source"]["serviceName"]
    service = metadata.get_by_name(entity=StorageService, fqn=service_name)
    if service:
        metadata.delete(
            entity=StorageService,
            entity_id=service.id,
            hard_delete=True,
            recursive=True,
        )


@pytest.fixture(scope="module")
def run_workflow():
    def _run(workflow_type, config, raise_from_status=True):
        workflow = workflow_type.create(config)
        workflow.execute()
        if raise_from_status:
            workflow.print_status()
            workflow.raise_from_status()
        return workflow

    return _run


@pytest.fixture(scope="module")
def bot_metadata(metadata) -> OpenMetadata:
    """Get the bot ometa for auto-classification"""
    automator_bot = metadata.get_by_name(entity=User, fqn="ingestion-bot")
    automator_bot_auth = metadata.get_by_id(entity=AuthenticationMechanism, entity_id=automator_bot.id)
    return int_admin_ometa(jwt=automator_bot_auth.config.JWTToken.get_secret_value())


@pytest.fixture(scope="module")
def bot_workflow_config(bot_metadata, storage_service_config):
    bot_config = storage_service_config["workflowConfig"].copy()
    bot_config["openMetadataServerConfig"] = bot_metadata.config.model_dump()
    return bot_config


@pytest.fixture(scope="module")
def email_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="email_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.EmailRecognizer,
    )


@pytest.fixture(scope="module")
def credit_card_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="credit_card_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.CreditCardRecognizer,
    )


@pytest.fixture(scope="module")
def us_ssn_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="us_ssn_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.UsSsnRecognizer,
    )


@pytest.fixture(scope="module")
def phone_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="phone_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.PhoneRecognizer,
    )


@pytest.fixture(scope="module")
def date_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="date_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.DateRecognizer,
    )


@pytest.fixture(scope="module")
def pii_spacy_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="spacy_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.SpacyRecognizer,
    )


@pytest.fixture(scope="module")
def pii_classification(
    metadata: OpenMetadata[Classification, CreateClassificationRequest],
) -> Classification:
    create_classification_request = CreateClassificationRequestFactory.create(
        fqn="PII",
        autoClassificationConfig__conflictResolution=ConflictResolution.highest_priority.value,
    )
    return metadata.create_or_update(create_classification_request)


@pytest.fixture(scope="module")
def sensitive_pii_tag(
    metadata: OpenMetadata[Tag, CreateTagRequest],
    pii_classification: Classification,
    email_recognizer: Recognizer,
    credit_card_recognizer: Recognizer,
    us_ssn_recognizer: Recognizer,
    pii_spacy_recognizer: Recognizer,
) -> Tag:
    create_tag_request = CreateTagRequestFactory.create(
        tag_name="Sensitive",
        tag_classification=pii_classification.fullyQualifiedName.root,
        autoClassificationPriority=100,
        recognizers=[
            email_recognizer,
            credit_card_recognizer,
            us_ssn_recognizer,
            pii_spacy_recognizer,
        ],
    )
    return metadata.create_or_update(create_tag_request)


@pytest.fixture(scope="module")
def non_sensitive_pii_tag(
    metadata: OpenMetadata[Tag, CreateTagRequest],
    pii_classification: Classification,
    phone_recognizer: Recognizer,
    date_recognizer: Recognizer,
) -> Tag:
    create_tag_request = CreateTagRequestFactory.create(
        tag_name="NonSensitive",
        tag_classification=pii_classification.fullyQualifiedName.root,
        autoClassificationPriority=80,
        recognizers=[
            phone_recognizer,
            date_recognizer,
        ],
    )
    return metadata.create_or_update(create_tag_request)


@pytest.fixture(scope="module")
def autoclassification_config(storage_service_config, bot_workflow_config, bucket_name, service_name, minio):
    minio_container, _ = minio
    return {
        "source": {
            "type": "s3",
            "serviceName": service_name,
            "serviceConnection": {
                "config": {
                    "type": "S3",
                    "awsConfig": {
                        "awsAccessKeyId": minio_container.access_key,
                        "awsSecretAccessKey": minio_container.secret_key,
                        "awsRegion": "us-east-1",
                        "endPointURL": f"http://localhost:{minio_container.get_exposed_port(9000)}",
                    },
                    "bucketNames": [bucket_name],
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "AutoClassification",
                    "bucketFilterPattern": {"includes": [f"^{bucket_name}$"]},
                    "storeSampleData": True,
                    "sampleDataCount": 50,
                    "enableAutoClassification": True,
                    "confidence": 80,
                }
            },
        },
        "processor": {
            "type": "tag-pii-processor",
            "config": {},
        },
        "sink": {"type": "metadata-rest", "config": {}},
        "workflowConfig": bot_workflow_config,
    }


@pytest.fixture(scope="module")
def run_autoclassification(
    pii_classification: Classification,
    sensitive_pii_tag: Tag,
    non_sensitive_pii_tag: Tag,
    run_workflow,
    ingest_storage_metadata: MetadataWorkflow,
    autoclassification_config,
) -> AutoClassificationWorkflow:
    return run_workflow(AutoClassificationWorkflow, autoclassification_config)
