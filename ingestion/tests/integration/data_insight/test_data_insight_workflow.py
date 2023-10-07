#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Validate workflow configs and filters
"""

from __future__ import annotations

import random
import unittest
import uuid
from copy import deepcopy
from datetime import datetime, time, timedelta
from random import randint
from time import sleep

import pytest
import requests

from metadata.data_insight.processor.kpi.kpi_runner import KpiRunner
from metadata.generated.schema.analytics.basic import WebAnalyticEventType
from metadata.generated.schema.analytics.reportData import ReportDataType
from metadata.generated.schema.analytics.webAnalyticEventData import (
    WebAnalyticEventData,
)
from metadata.generated.schema.analytics.webAnalyticEventType.pageViewEvent import (
    PageViewData,
)
from metadata.generated.schema.api.dataInsight.kpi.createKpiRequest import (
    CreateKpiRequest,
)
from metadata.generated.schema.dataInsight.dataInsightChart import DataInsightChart
from metadata.generated.schema.dataInsight.dataInsightChartResult import (
    DataInsightChartResult,
    DataInsightChartType,
)
from metadata.generated.schema.dataInsight.kpi.basic import KpiResult, KpiTarget
from metadata.generated.schema.dataInsight.kpi.kpi import Kpi
from metadata.generated.schema.dataInsight.type.dailyActiveUsers import DailyActiveUsers
from metadata.generated.schema.dataInsight.type.pageViewsByEntities import (
    PageViewsByEntities,
)
from metadata.generated.schema.dataInsight.type.percentageOfEntitiesWithDescriptionByType import (
    PercentageOfEntitiesWithDescriptionByType,
)
from metadata.generated.schema.dataInsight.type.percentageOfEntitiesWithOwnerByType import (
    PercentageOfEntitiesWithOwnerByType,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.parser import ParsingConfigurationError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.data_insight import DataInsightWorkflow

data_insight_config = {
    "source": {
        "type": "dataInsight",
        "serviceName": "dataInsightWorkflow",
        "sourceConfig": {"config": {}},
    },
    "processor": {"type": "data-insight-processor", "config": {}},
    "sink": {
        "type": "elasticsearch",
        "config": {"es_host": "localhost", "es_port": 9200, "recreate_indexes": False},
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"  # pylint: disable=line-too-long
            },
        }
    },
}

WEB_EVENT_DATA = [
    WebAnalyticEventData(
        eventId=None,
        eventType=WebAnalyticEventType.PageView,
        eventData=PageViewData(
            fullUrl='http://localhost:8585/table/sample_data.ecommerce_db.shopify."dim.shop"',
            url='/table/sample_data.ecommerce_db.shopify."dim.shop"',
            hostname="localhost",
            language="en-US",
            screenSize="1280x720",
            userId=uuid.uuid4(),
            sessionId=uuid.uuid4(),
            pageLoadTime=0.0,
            referrer="",
        ),
    ),
    WebAnalyticEventData(
        eventId=None,
        eventType=WebAnalyticEventType.PageView,
        eventData=PageViewData(
            fullUrl="http://localhost:8585/table/mysql.default.airflow_db.dag_run/profiler",
            url="/table/mysql.default.airflow_db.dag_run/profiler",
            hostname="localhost",
            language="en-US",
            screenSize="1280x720",
            userId=uuid.uuid4(),
            sessionId=uuid.uuid4(),
            pageLoadTime=0.0,
            referrer="",
        ),
    ),
]


class DataInsightWorkflowTests(unittest.TestCase):
    """Test class for data insight workflow validation"""

    @classmethod
    def setUpClass(cls) -> None:
        cls.metadata = OpenMetadata(
            OpenMetadataConnection.parse_obj(
                data_insight_config["workflowConfig"]["openMetadataServerConfig"]
            )
        )

    def setUp(self) -> None:
        """Set up om client for the test class"""
        self.start_ts = int(
            datetime.combine(datetime.utcnow(), time.min).timestamp() * 1000
        ) - random.randint(1, 999)
        self.end_ts = int(
            datetime.combine(datetime.utcnow(), time.max).timestamp() * 1000
        ) - random.randint(1, 999)

        completed_description_chart = self.metadata.get_by_name(
            DataInsightChart, "PercentageOfEntitiesWithDescriptionByType", fields="*"
        )
        create = CreateKpiRequest(
            name=f"CompletedDescription__{self.id().split('.')[-1]}",
            dataInsightChart=completed_description_chart.fullyQualifiedName,
            description="foo",
            startDate=self.start_ts,
            endDate=self.end_ts,
            targetDefinition=[
                KpiTarget(name="completedDescriptionFraction", value="0.63")
            ],
            metricType="PERCENTAGE",
        )

        self.kpi = self.metadata.create_kpi(create)

        table: Table = self.metadata.get_by_name(
            Table, 'sample_data.ecommerce_db.shopify."dim.shop"'
        )
        user: User = self.metadata.get_by_name(User, "aaron_johnson0")
        self.metadata.patch_owner(
            entity=Table,
            source=table,
            owner=EntityReference(
                id=user.id,
                type="user",
            ),
            force=True,
        )

        for event in WEB_EVENT_DATA:
            event.timestamp = int(
                (
                    datetime.utcnow() - timedelta(days=1, milliseconds=randint(0, 999))
                ).timestamp()
                * 1000
            )
            self.metadata.add_web_analytic_events(event)

        # we'll add the user ID
        self.metadata.add_web_analytic_events(
            WebAnalyticEventData(
                eventId=None,
                timestamp=int(
                    (
                        datetime.utcnow()
                        - timedelta(days=1, milliseconds=randint(0, 999))
                    ).timestamp()
                    * 1000
                ),
                eventType=WebAnalyticEventType.PageView,
                eventData=PageViewData(
                    fullUrl='http://localhost:8585/table/sample_data.ecommerce_db.shopify."dim.shop"',
                    url='/table/sample_data.ecommerce_db.shopify."dim.shop"',
                    hostname="localhost",
                    language="en-US",
                    screenSize="1280x720",
                    userId=user.id,
                    sessionId=uuid.uuid4(),
                    pageLoadTime=0.0,
                    referrer="",
                ),
            ),
        )

    def test_create_method(self):
        """Test validation of the workflow config is properly happening"""
        DataInsightWorkflow.create(data_insight_config)

        with pytest.raises(ParsingConfigurationError):
            insight = deepcopy(data_insight_config)
            insight["source"]["sourceConfig"]["config"].update({"type": "Foo"})
            DataInsightWorkflow.create(insight)

    def test_execute_method(self):
        """test method execution"""
        workflow: DataInsightWorkflow = DataInsightWorkflow.create(data_insight_config)
        workflow.execute()

        sleep(1)  # wait for data to be available

        # Test the indexes have been created as expected and the data have been loaded
        entity_report_docs = requests.get(
            "http://localhost:9200/entity_report_data_index/_search", timeout=30
        )
        web_analytic_user_activity_report_data_docs = requests.get(
            "http://localhost:9200/web_analytic_user_activity_report_data_index/_search",
            timeout=30,
        )
        web_analytic_entity_view_report_data_docs = requests.get(
            "http://localhost:9200/web_analytic_entity_view_report_data_index/_search",
            timeout=30,
        )

        # check data have been correctly indexed in ES
        # --------------------------------------------
        assert entity_report_docs.json()["hits"]["total"]["value"] > 0
        assert (
            web_analytic_user_activity_report_data_docs.json()["hits"]["total"]["value"]
            > 0
        )
        assert (
            web_analytic_entity_view_report_data_docs.json()["hits"]["total"]["value"]
            > 0
        )

        # test report endpoints are returning data
        # --------------------------------------
        report_data = self.metadata.get_data_insight_report_data(
            self.start_ts,
            self.end_ts,
            ReportDataType.EntityReportData.value,
        )
        assert report_data.get("data")

        web_entity_analytics = self.metadata.get_data_insight_report_data(
            self.start_ts,
            self.end_ts,
            ReportDataType.WebAnalyticEntityViewReportData.value,
        )
        assert web_entity_analytics.get("data")

        web_user_analytics = self.metadata.get_data_insight_report_data(
            self.start_ts,
            self.end_ts,
            ReportDataType.WebAnalyticUserActivityReportData.value,
        )
        assert web_user_analytics.get("data")

        # test data insight aggregation endpoints are returning data
        # ----------------------------------------------------------
        resp = self.metadata.get_aggregated_data_insight_results(
            start_ts=self.start_ts,
            end_ts=self.end_ts,
            data_insight_chart_nane=DataInsightChartType.PercentageOfEntitiesWithDescriptionByType.value,
            data_report_index="entity_report_data_index",
        )

        assert isinstance(resp, DataInsightChartResult)
        assert resp.data
        assert isinstance(resp.data[0], PercentageOfEntitiesWithDescriptionByType)

        resp = self.metadata.get_aggregated_data_insight_results(
            start_ts=self.start_ts,
            end_ts=self.end_ts,
            data_insight_chart_nane=DataInsightChartType.PercentageOfEntitiesWithOwnerByType.value,
            data_report_index="entity_report_data_index",
        )

        assert resp.data
        assert isinstance(resp.data[0], PercentageOfEntitiesWithOwnerByType)

        resp = self.metadata.get_aggregated_data_insight_results(
            start_ts=self.start_ts,
            end_ts=self.end_ts,
            data_insight_chart_nane=DataInsightChartType.DailyActiveUsers.value,
            data_report_index="web_analytic_user_activity_report_data_index",
        )

        assert resp.data
        assert isinstance(resp.data[0], DailyActiveUsers)

        resp = self.metadata.get_aggregated_data_insight_results(
            start_ts=self.start_ts,
            end_ts=self.end_ts,
            data_insight_chart_nane=DataInsightChartType.PageViewsByEntities.value,
            data_report_index="web_analytic_entity_view_report_data_index",
        )

        assert resp.data
        assert isinstance(resp.data[0], PageViewsByEntities)

        # test data insight KPIs have been computed and can be retrieved
        # --------------------------------------------------------------
        kpi_result = self.metadata.get_kpi_result(
            "CompletedDescription__test_execute_method", self.start_ts, self.end_ts
        )
        assert kpi_result

    def test_get_kpis(self):
        """test Kpis are returned as expected"""
        # TO DO: Add KPI creation step and deletion (setUp + tearDown)

        kpi_runner = KpiRunner(self.metadata)
        kpis = kpi_runner.get_kpis()
        assert kpis

    def test_write_kpi_result(self):
        """test write kpi result"""
        fqn = "CompletedDescription__test_write_kpi_result"
        self.metadata.add_kpi_result(
            fqn,
            KpiResult(
                timestamp=int(datetime.utcnow().timestamp() * 1000),
                kpiFqn="CompletedDescription__test_write_kpi_result",
                targetResult=[
                    KpiTarget(
                        name="completedDescriptionFraction",
                        value="0.56",
                        targetMet=False,
                    )
                ],
            ),
        )

        kpi_result = self.metadata.get_kpi_result(fqn, self.start_ts, self.end_ts)

        assert kpi_result

    def test_multiple_execution(self) -> None:
        """test multiple execution of the workflow is not yielding duplicate entries"""
        data = {}

        workflow: DataInsightWorkflow = DataInsightWorkflow.create(data_insight_config)
        workflow.execute()
        workflow.stop()
        sleep(2)  # we'll wait for 2 seconds
        new_workflow: DataInsightWorkflow = DataInsightWorkflow.create(
            data_insight_config
        )
        new_workflow.execute()
        new_workflow.stop()

        for report_data_type in ReportDataType:
            data[report_data_type] = self.metadata.get_data_insight_report_data(
                self.start_ts,
                self.end_ts,
                report_data_type.value,
            )

        for _, values in data.items():
            timestamp = [value.get("timestamp") for value in values.get("data")]
            # we'll check we only have 1 execution timestamp
            assert len(set(timestamp)) == 1

    def tearDown(self) -> None:
        """teardown class"""
        self.metadata.delete(
            entity=Kpi,
            entity_id=str(self.kpi.id.__root__),
            hard_delete=True,
            recursive=True,
        )
