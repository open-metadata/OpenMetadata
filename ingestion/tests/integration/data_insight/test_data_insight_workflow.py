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

import unittest
import uuid
from copy import deepcopy
from datetime import datetime, time, timedelta
from time import sleep

import pytest
import requests

from metadata.data_insight.api.workflow import DataInsightWorkflow
from metadata.data_insight.helper.data_insight_es_index import DataInsightEsIndex
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
        timestamp=int((datetime.utcnow() - timedelta(days=1)).timestamp() * 1000),
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
        timestamp=int((datetime.utcnow() - timedelta(days=1)).timestamp() * 1000),
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
        """Set up om client for the test class"""

        cls.metadata = OpenMetadata(
            OpenMetadataConnection.parse_obj(
                data_insight_config["workflowConfig"]["openMetadataServerConfig"]
            )
        )

        cls.start_ts = int(
            datetime.combine(datetime.utcnow(), time.min).timestamp() * 1000
        )
        cls.end_ts = int(
            datetime.combine(datetime.utcnow(), time.max).timestamp() * 1000
        )

        completed_description_chart = cls.metadata.get_by_name(
            DataInsightChart, "PercentageOfEntitiesWithDescriptionByType", fields="*"
        )
        create = CreateKpiRequest(
            name="CompletedDescription",
            dataInsightChart=completed_description_chart.fullyQualifiedName,
            description="foo",
            startDate=cls.start_ts,
            endDate=cls.end_ts,
            targetDefinition=[
                KpiTarget(name="completedDescriptionFraction", value="0.63")
            ],
            metricType="PERCENTAGE",
        )

        cls.metadata.create_kpi(create)

        table: Table = cls.metadata.get_by_name(
            Table, 'sample_data.ecommerce_db.shopify."dim.shop"'
        )
        user: User = cls.metadata.get_by_name(User, "aaron_johnson0")
        cls.metadata.patch_owner(
            Table,
            table.id,
            EntityReference(
                id=user.id,
                type="user",
            ),
            True,
        )

        for event in WEB_EVENT_DATA:
            cls.metadata.add_web_analytic_events(event)

        cls.metadata.add_web_analytic_events(
            WebAnalyticEventData(
                eventId=None,
                timestamp=int(
                    (datetime.utcnow() - timedelta(days=1)).timestamp() * 1000
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
        """test method excution"""
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
            data_report_index=DataInsightEsIndex.EntityReportData.value,
        )

        assert isinstance(resp, DataInsightChartResult)
        assert resp.data
        assert isinstance(resp.data[0], PercentageOfEntitiesWithDescriptionByType)

        resp = self.metadata.get_aggregated_data_insight_results(
            start_ts=self.start_ts,
            end_ts=self.end_ts,
            data_insight_chart_nane=DataInsightChartType.PercentageOfEntitiesWithOwnerByType.value,
            data_report_index=DataInsightEsIndex.EntityReportData.value,
        )

        assert resp.data
        assert isinstance(resp.data[0], PercentageOfEntitiesWithOwnerByType)

        resp = self.metadata.get_aggregated_data_insight_results(
            start_ts=self.start_ts,
            end_ts=self.end_ts,
            data_insight_chart_nane=DataInsightChartType.DailyActiveUsers.value,
            data_report_index=DataInsightEsIndex.WebAnalyticUserActivityReportData.value,
        )

        assert resp.data
        assert isinstance(resp.data[0], DailyActiveUsers)

        resp = self.metadata.get_aggregated_data_insight_results(
            start_ts=self.start_ts,
            end_ts=self.end_ts,
            data_insight_chart_nane=DataInsightChartType.PageViewsByEntities.value,
            data_report_index=DataInsightEsIndex.WebAnalyticEntityViewReportData.value,
        )

        assert resp.data
        assert isinstance(resp.data[0], PageViewsByEntities)

    def test_get_kpis(self):
        """test Kpis are returned as expected"""
        # TO DO: Add KPI creation step and deletion (setUp + tearDown)

        workflow: DataInsightWorkflow = DataInsightWorkflow.create(data_insight_config)

        kpis = workflow._get_kpis()

        assert kpis

    def test_write_kpi_result(self):
        """test write kpi result"""
        fqn = "CompletedDescription"
        self.metadata.add_kpi_result(
            fqn,
            KpiResult(
                timestamp=int(datetime.utcnow().timestamp() * 1000),
                kpiFqn="CompletedDescription",
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

    @classmethod
    def tearDownClass(cls) -> None:
        kpis: list[Kpi] = cls.metadata.list_entities(
            entity=Kpi, fields="*"  # type: ignore
        ).entities

        for kpi in kpis:
            cls.metadata.delete(
                entity=Kpi,
                entity_id=kpi.id,
                hard_delete=True,
                recursive=True,
            )
