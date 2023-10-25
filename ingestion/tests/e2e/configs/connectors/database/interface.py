"""connectors interface"""

import random
import string
import time
from abc import ABC, abstractmethod
from time import sleep

from playwright.sync_api import Page, TimeoutError, expect

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineState,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.time_utils import (
    get_beginning_of_day_timestamp_mill,
    get_end_of_day_timestamp_mill,
)

from ...connectors.model import ConnectorTestConfig, IngestionFilterConfig

BASE_URL = "http://localhost:8585"


class DataBaseConnectorInterface(ABC):
    """Interface for connectors class for e2e tests"""

    def __init__(self, config: ConnectorTestConfig):
        """Initialize the connector"""
        self.supports_profiler_ingestion = True
        self.profiler_summary_card_count = 4

        self.ingestion_config = config.ingestion
        self.validation_config = config.validation

        self.service_type = "Databases"
        self.service_name = None
        self.metadata_ingestion_pipeline_fqn = None
        self.profiler_ingestion_pipeline_fqn = None
        self.ometa = OpenMetadata(
            OpenMetadataConnection(
                hostPort=f"{BASE_URL}/api",
                authProvider="openmetadata",
                securityConfig=OpenMetadataJWTClientConfig(
                    jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
                ),
            )
        )

    def _check_and_handle_workflow(self, page: Page, ingestion_pipeline_fqn: str):
        pipeline_status = None
        try_ = 0
        sleep(1)
        # we'll iterate until we get a pipeline status
        while not pipeline_status:
            pipeline_status = self.ometa.get_pipeline_status_between_ts(
                f"{self.service_name}.{ingestion_pipeline_fqn}",
                get_beginning_of_day_timestamp_mill(),
                get_end_of_day_timestamp_mill(),
            )
            if not pipeline_status and try_ > 10:
                # if we don't get a pipeline status after trying 10 times
                # we need to deploy the workflow
                try:
                    page.get_by_role(
                        "row", name=f"{ingestion_pipeline_fqn}"
                    ).get_by_test_id("re-deploy").click()
                except TimeoutError:
                    page.get_by_role(
                        "row", name=f"{ingestion_pipeline_fqn}"
                    ).get_by_test_id("deploy").click()
            if try_ > 20:
                # if we've tried 20 times, we'll raise an exception
                raise TimeoutError("Pipeline status not found")
            try_ += 1

    @abstractmethod
    def get_service(self, page: Page):
        """get service from the service page"""
        raise NotImplementedError

    @abstractmethod
    def set_connection(self, page: Page):
        """Set connection for redshift service"""
        raise NotImplementedError

    @staticmethod
    def generate_service_name():
        """Generate a random service name"""
        chinese_char = "".join([chr(random.randint(0x4E00, 0x9FBF)) for _ in range(3)])
        cyrillic_char = "".join([chr(random.randint(1072, 1104)) for _ in range(3)])
        return (
            "".join(random.choices(string.ascii_lowercase, k=10))
            + chinese_char
            + cyrillic_char
            + "_-1"
        )

    def _set_ingestion_filter(self, type_: str, page: Page):
        """Set schema filter for redshift service"""
        filter_config: IngestionFilterConfig = getattr(self.ingestion_config, type_)
        if not filter_config:
            return

        for container_type, value in filter_config:
            if not value:
                continue
            if container_type == "schema_":
                container_type = "schema"
            for filter_type, filter_elements in value:
                if not filter_elements:
                    continue
                for element in filter_elements:
                    page.locator(
                        f'xpath=//*[@id="root/{container_type}FilterPattern/{filter_type}"]'
                    ).fill(element)

    def get_sorted_ingestion_pipeline_statues(
        self, ingestion_pipeline_fqn: str, desc=True
    ):
        statuses = self.ometa.get_pipeline_status_between_ts(
            ingestion_pipeline_fqn,
            get_beginning_of_day_timestamp_mill(),
            get_end_of_day_timestamp_mill(),
        )
        return sorted(
            statuses,
            key=lambda x: x.startDate.__root__,
            reverse=True if desc else False,
        )

    def get_pipeline_status(self, ingestion_pipeline_fqn: str):
        # Not best practice. Should use `expect`, though playwright does not have a `wait_until` function
        # we'll make a call to the API to get the pipeline status and check if it's success
        status = None
        timeout = time.time() + 60 * 5  # 5 minutes from now

        while not status or status == PipelineState.running:
            if time.time() > timeout:
                raise TimeoutError(
                    "Pipeline with status {status} has been running for more than 5 minutes"
                )
            statuses = self.get_sorted_ingestion_pipeline_statues(
                ingestion_pipeline_fqn,
            )
            # we'll get the state of the most recent pipeline run
            status = statuses[0].pipelineState
            if status != PipelineState.running:
                break

        return status

    def create_service_ingest_metadata(self, page: Page):
        """Ingest redshift service data

        Args:
            page (Page): playwright page. Should be logged in and pointing to the home page
                e.g. page.goto(f"{BASE_URL}/")
        """
        page.get_by_test_id("app-bar-item-settings").click()
        page.get_by_text(self.service_type).click()
        page.get_by_test_id("add-service-button").click()
        self.get_service(page)
        page.get_by_test_id("next-button").click()
        self.service_name = self.generate_service_name()
        page.get_by_test_id("service-name").fill(self.service_name)
        expect(page.get_by_test_id("service-name")).to_have_value(self.service_name)
        page.get_by_test_id("next-button").click()
        self.set_connection(page)
        page.get_by_test_id("submit-btn").click()
        page.get_by_test_id("add-ingestion-button").click()
        self._set_ingestion_filter("metadata", page)
        self.metadata_ingestion_pipeline_fqn = page.get_by_label("name*").input_value()
        page.get_by_test_id("submit-btn").click()
        page.get_by_test_id("deploy-button").click()
        page.get_by_test_id("view-service-button").click()
        page.get_by_test_id("ingestions").click()
        self._check_and_handle_workflow(page, self.metadata_ingestion_pipeline_fqn)
        return self.service_name

    def create_profiler_workflow(self, page: Page):
        """create profiler workflow"""
        page.get_by_test_id("app-bar-item-settings").click()
        page.get_by_text("Databases").click()
        page.get_by_test_id(f"service-name-{self.service_name}").click()
        page.get_by_text("Ingestions").click()
        page.get_by_test_id("add-new-ingestion-button").click()
        page.get_by_text("Add Profiler Ingestion").click()
        page.locator(
            "div:nth-child(5) > div > div:nth-child(2) > .form-group > .ant-row > div:nth-child(2) > .ant-select > .ant-select-selector > .ant-select-selection-overflow"
        ).click()
        self._set_ingestion_filter("profiler", page)
        page.locator('[id="root\\/processPiiSensitive"]').click()
        self.profiler_ingestion_pipeline_fqn = page.get_by_label("name*").input_value()
        page.get_by_test_id("submit-btn").click()
        page.get_by_test_id("deploy-button").click()
        page.get_by_test_id("view-service-button").click()
        page.get_by_test_id("ingestions").click()
        self._check_and_handle_workflow(page, self.profiler_ingestion_pipeline_fqn)

    def delete_service(self, page: Page):
        """Delete service"""
        page.goto(f"{BASE_URL}/")
        page.get_by_test_id("app-bar-item-settings").click()
        page.get_by_text("Databases").click()
        page.get_by_test_id(f"service-name-{self.service_name}").click()
        page.get_by_test_id("manage-button").click()
        page.get_by_test_id("delete-button-title").click()
        page.get_by_test_id("confirmation-text-input").fill("DELETE")
        expect(page.get_by_test_id("confirmation-text-input")).to_have_value("DELETE")
        page.get_by_test_id("confirm-button").click()
