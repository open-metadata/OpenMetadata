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

"""Validate data insight producer class for entitites."""

import random
import uuid
from unittest import TestCase

import pytest

from metadata.data_insight.producer.entity_producer import EntityProducer
from metadata.data_insight.producer.web_analytics_producer import (
    CACHED_EVENTS,
    WebAnalyticsProducer,
)
from metadata.generated.schema.analytics.basic import WebAnalyticEventType
from metadata.generated.schema.analytics.webAnalyticEventData import (
    WebAnalyticEventData,
)
from metadata.generated.schema.analytics.webAnalyticEventType.pageViewEvent import (
    PageViewData,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.time_utils import (
    get_beginning_of_day_timestamp_mill,
    get_end_of_day_timestamp_mill,
)

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


class TestEntityProducer(TestCase):
    """test entity producer"""

    @classmethod
    def setUpClass(cls):
        """test init"""
        cls.metadata = OpenMetadata(
            OpenMetadataConnection.parse_obj(
                data_insight_config["workflowConfig"]["openMetadataServerConfig"]
            )
        )
        cls.producer = EntityProducer(cls.metadata)

    def test_fetch_data(self):
        """test fetch data"""
        data = []
        for datum in self.producer.fetch_data(limit=10):
            data.append(datum)

        entity_type = list({d.__class__.__name__ for d in data})
        expected_entity_type = [
            "Dashboard",
            "Table",
            "Topic",
            "Pipeline",
            "Container",
            "Database",
            "Chart",
            "MlModel",
            "SearchIndex",
            "StoredProcedure",
            "DatabaseSchema",
        ]
        self.assertGreater(len(data), 10)
        self.assertListEqual(sorted(entity_type), sorted(expected_entity_type))


class TestWebAnalyticProducer(TestCase):
    """test web analytic producer"""

    @classmethod
    def setUpClass(cls):
        """test init"""
        cls.event_ids = []
        cls.metadata = OpenMetadata(
            OpenMetadataConnection.parse_obj(
                data_insight_config["workflowConfig"]["openMetadataServerConfig"]
            )
        )

        start_ts = get_beginning_of_day_timestamp_mill(days=1)
        end_ts = get_end_of_day_timestamp_mill(days=1)
        entity_urls = [
            "/table/sample_data.ecommerce_db.shopify.%22dim.product%22",
            '/table/sample_data.ecommerce_db.shopify."dim.shop"',
            "/dashboard/sample_superset.forecast_sales_performance",
            "/container/s3_storage_sample.deep_nested_container_1.deep_nested_container_2.deep_nested_container_3.deep_nested_container_4",
            "/mlmodel/mlflow_svc.forecast_sales",
            "/pipeline/sample_airflow.trino_etl",
            "/pipeline/sample_airflow.dim_address_etl",
        ]

        for _ in range(50):
            url = random.choice(entity_urls)
            create_event = WebAnalyticEventData(
                eventId=None,
                timestamp=random.choice(range(start_ts, end_ts)),
                eventType=WebAnalyticEventType.PageView,
                eventData=PageViewData(
                    fullUrl=f"http://localhost:8585{url}",
                    url=url,
                    hostname="localhost",
                    language="en-US",
                    screenSize="1280x720",
                    userId=uuid.uuid4(),
                    sessionId=uuid.uuid4(),
                    pageLoadTime=0.0,
                    referrer="",
                ),
            )
            event = cls.metadata.add_web_analytic_events(create_event)
            event = WebAnalyticEventData.parse_obj(event)
            cls.event_ids.append(event.eventId.__root__)

        cls.producer = WebAnalyticsProducer(cls.metadata)

    @pytest.mark.order(10000)
    def test_fetch_data_from_producer(self):
        """fetch data"""
        data = []
        for datum in self.producer.fetch_data():
            data.append(datum)

        self.assertGreaterEqual(len(data), 50)

    @pytest.mark.order(10001)
    def test_check_data_cached(self):
        """fetch data. Should have it cached"""
        new_producer = WebAnalyticsProducer(self.metadata)
        assert CACHED_EVENTS
