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
"""Integration tests for container auto-classification"""

import pytest

from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.services.storageService import StorageService
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.classification import AutoClassificationWorkflow
from metadata.workflow.workflow_status_mixin import WorkflowResultStatus


def test_storage_service_ingested(metadata: OpenMetadata, ingest_storage_metadata, service_name):
    """Verify storage service was ingested successfully"""
    service = metadata.get_by_name(entity=StorageService, fqn=service_name)
    assert service is not None
    assert service.name.root == service_name


def test_containers_ingested(metadata: OpenMetadata, ingest_storage_metadata, service_name, bucket_name):
    """Verify containers were ingested with data models"""
    bucket = metadata.get_by_name(entity=Container, fqn=f"{service_name}.{bucket_name}", fields=["*"])
    assert bucket is not None
    assert bucket.children is not None
    assert len(bucket.children.root) >= 3

    customers_container = metadata.get_by_name(
        entity=Container, fqn=f"{service_name}.{bucket_name}.customers", fields=["*"]
    )
    assert customers_container is not None
    assert customers_container.dataModel is not None
    assert customers_container.dataModel.columns is not None
    assert len(customers_container.dataModel.columns) == 8

    employees_container = metadata.get_by_name(
        entity=Container,
        fqn=f"{service_name}.{bucket_name}.employees",
        fields=["*"],
    )
    assert employees_container is not None
    assert employees_container.dataModel is not None
    assert employees_container.dataModel.columns is not None
    assert len(employees_container.dataModel.columns) == 6


def test_container_pii_classification_csv(
    metadata: OpenMetadata,
    run_autoclassification: AutoClassificationWorkflow,
    service_name: str,
    bucket_name: str,
):
    """Test PII classification on CSV container (customers.csv)"""
    container = metadata.get_by_name(
        entity=Container,
        fqn=f"{service_name}.{bucket_name}.customers",
        fields=["dataModel", "tags"],
    )

    assert container is not None
    assert container.dataModel is not None
    columns = container.dataModel.columns

    email_column = next((c for c in columns if c.name.root == "email"), None)
    assert email_column is not None
    assert email_column.tags is not None
    assert len(email_column.tags) > 0
    assert any(tag.tagFQN.root == "PII.Sensitive" for tag in email_column.tags), (
        "Email column should be tagged as PII.Sensitive"
    )

    ssn_column = next((c for c in columns if c.name.root == "ssn"), None)
    assert ssn_column is not None
    assert ssn_column.tags is not None
    assert len(ssn_column.tags) > 0
    assert any(tag.tagFQN.root == "PII.Sensitive" for tag in ssn_column.tags), (
        "SSN column should be tagged as PII.Sensitive"
    )

    credit_card_column = next((c for c in columns if c.name.root == "credit_card"), None)
    assert credit_card_column is not None
    assert credit_card_column.tags is not None
    assert len(credit_card_column.tags) > 0
    assert any(tag.tagFQN.root == "PII.Sensitive" for tag in credit_card_column.tags), (
        "Credit card column should be tagged as PII.Sensitive"
    )

    name_column = next((c for c in columns if c.name.root == "name"), None)
    assert name_column is not None
    assert name_column.tags is not None
    assert len(name_column.tags) > 0
    assert any(tag.tagFQN.root == "PII.Sensitive" for tag in name_column.tags), (
        "Name column should be tagged as PII.Sensitive (person names)"
    )


def test_container_pii_classification_parquet(
    metadata: OpenMetadata,
    run_autoclassification: AutoClassificationWorkflow,
    service_name: str,
    bucket_name: str,
):
    """Test PII classification on Parquet container (employees.parquet)"""
    container = metadata.get_by_name(
        entity=Container,
        fqn=f"{service_name}.{bucket_name}.employees",
        fields=["dataModel", "tags"],
    )

    assert container is not None
    assert container.dataModel is not None
    columns = container.dataModel.columns

    email_column = next((c for c in columns if c.name.root == "email"), None)
    assert email_column is not None
    assert email_column.tags is not None
    assert any(tag.tagFQN.root == "PII.Sensitive" for tag in email_column.tags)

    ssn_column = next((c for c in columns if c.name.root == "ssn"), None)
    assert ssn_column is not None
    assert ssn_column.tags is not None
    assert any(tag.tagFQN.root == "PII.Sensitive" for tag in ssn_column.tags)

    full_name_column = next((c for c in columns if c.name.root == "full_name"), None)
    assert full_name_column is not None
    assert full_name_column.tags is not None
    assert any(tag.tagFQN.root == "PII.Sensitive" for tag in full_name_column.tags)


def test_container_non_sensitive_pii(
    metadata: OpenMetadata,
    run_autoclassification: AutoClassificationWorkflow,
    service_name: str,
    bucket_name: str,
):
    """Test non-sensitive PII classification (phone, date)"""
    container = metadata.get_by_name(
        entity=Container,
        fqn=f"{service_name}.{bucket_name}.customers",
        fields=["dataModel", "tags"],
    )

    assert container is not None
    columns = container.dataModel.columns

    phone_column = next((c for c in columns if c.name.root == "phone"), None)
    assert phone_column is not None
    assert phone_column.tags is not None

    created_date_column = next((c for c in columns if c.name.root == "created_date"), None)
    assert created_date_column is not None


def test_container_no_pii_classification(
    metadata: OpenMetadata,
    run_autoclassification: AutoClassificationWorkflow,
    service_name: str,
    bucket_name: str,
):
    """Test that non-PII container columns are not classified"""
    container = metadata.get_by_name(
        entity=Container,
        fqn=f"{service_name}.{bucket_name}.orders",
        fields=["dataModel", "tags"],
    )

    assert container is not None
    assert container.dataModel is not None
    columns = container.dataModel.columns

    product_id_column = next((c for c in columns if c.name.root == "product_id"), None)
    assert product_id_column is not None
    assert product_id_column.tags is None or len(product_id_column.tags) == 0, "Product ID should not have PII tags"

    quantity_column = next((c for c in columns if c.name.root == "quantity"), None)
    assert quantity_column is not None
    assert quantity_column.tags is None or len(quantity_column.tags) == 0, "Quantity should not have PII tags"


def test_container_classification_reasons(
    metadata: OpenMetadata,
    run_autoclassification: AutoClassificationWorkflow,
    service_name: str,
    bucket_name: str,
):
    """Test that classification includes proper reason/explanation"""
    container = metadata.get_by_name(
        entity=Container,
        fqn=f"{service_name}.{bucket_name}.customers",
        fields=["dataModel", "tags"],
    )

    assert container is not None
    columns = container.dataModel.columns

    email_column = next((c for c in columns if c.name.root == "email"), None)
    assert email_column is not None
    assert email_column.tags is not None

    email_tag = next((tag for tag in email_column.tags if tag.tagFQN.root == "PII.Sensitive"), None)
    assert email_tag is not None
    assert email_tag.reason is not None
    assert "EmailRecognizer" in email_tag.reason or "Detected" in email_tag.reason


def test_container_sample_data_stored(
    metadata: OpenMetadata,
    run_autoclassification: AutoClassificationWorkflow,
    service_name: str,
    bucket_name: str,
):
    """Test that sample data is stored when storeSampleData=True"""
    container = metadata.get_by_name(
        entity=Container,
        fqn=f"{service_name}.{bucket_name}.customers",
    )

    assert container is not None

    container_with_sample = metadata.get_container_sample_data(container)
    assert container_with_sample is not None
    sample_data = container_with_sample.sampleData
    assert sample_data is not None
    assert sample_data.columns is not None
    assert len(sample_data.columns) > 0
    assert sample_data.rows is not None
    assert len(sample_data.rows) > 0


def test_autoclassification_workflow_status(
    run_autoclassification: AutoClassificationWorkflow,
):
    """Test that auto-classification workflow completes successfully"""
    status = run_autoclassification.result_status()
    assert status is WorkflowResultStatus.SUCCESS, "Auto-classification workflow should complete with status SUCCESS"


def test_container_filter_pattern(
    metadata: OpenMetadata,
    run_autoclassification: AutoClassificationWorkflow,
    service_name: str,
    bucket_name: str,
):
    """Test that containerFilterPattern correctly filters containers"""
    containers_processed = []

    customers = metadata.get_by_name(entity=Container, fqn=f"{service_name}.{bucket_name}.customers", fields=["*"])
    if customers and customers.dataModel and customers.dataModel.columns:
        has_tags = any(col.tags and len(col.tags) > 0 for col in customers.dataModel.columns)
        if has_tags:
            containers_processed.append("customers")

    employees = metadata.get_by_name(entity=Container, fqn=f"{service_name}.{bucket_name}.employees", fields=["*"])
    if employees and employees.dataModel and employees.dataModel.columns:
        has_tags = any(col.tags and len(col.tags) > 0 for col in employees.dataModel.columns)
        if has_tags:
            containers_processed.append("employees")

    assert len(containers_processed) >= 2, "At least 2 containers should be processed by filter pattern"


@pytest.mark.parametrize(
    "container_name,column_name,expected_tag",
    [
        ("customers", "email", "PII.Sensitive"),
        ("customers", "ssn", "PII.Sensitive"),
        ("customers", "credit_card", "PII.Sensitive"),
        ("employees", "email", "PII.Sensitive"),
        ("employees", "ssn", "PII.Sensitive"),
    ],
)
def test_specific_column_classification(
    metadata: OpenMetadata,
    run_autoclassification: AutoClassificationWorkflow,
    service_name: str,
    bucket_name: str,
    container_name: str,
    column_name: str,
    expected_tag: str,
):
    """Parametrized test for specific column classifications"""
    container = metadata.get_by_name(
        entity=Container,
        fqn=f"{service_name}.{bucket_name}.{container_name}",
        fields=["dataModel", "tags"],
    )

    assert container is not None
    assert container.dataModel is not None
    columns = container.dataModel.columns

    target_column = next((c for c in columns if c.name.root == column_name), None)
    assert target_column is not None, f"Column {column_name} not found"
    assert target_column.tags is not None, f"Column {column_name} has no tags"
    assert any(tag.tagFQN.root == expected_tag for tag in target_column.tags), (
        f"Column {column_name} should have tag {expected_tag}"
    )
