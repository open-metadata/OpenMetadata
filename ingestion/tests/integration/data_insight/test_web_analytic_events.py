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
Test web analytics events
"""

from __future__ import annotations

import unittest
import uuid
from datetime import datetime, timedelta

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
        "sourceConfig": {"config": {"type": "dataInsight"}},
    },
    "processor": {"type": "data-insight-processor", "config": {}},
    "sink": {
        "type": "elasticsearch",
        "config": {},
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


class WebAnalyticsEndpointsTests(unittest.TestCase):
    """Test class for data insight workflow validation"""

    @classmethod
    def setUpClass(cls) -> None:
        """Set up om client for the test class"""

        cls.metadata = OpenMetadata(
            OpenMetadataConnection.parse_obj(
                data_insight_config["workflowConfig"]["openMetadataServerConfig"]
            )
        )

        cls.start_ts = get_beginning_of_day_timestamp_mill(days=1)
        cls.end_ts = get_end_of_day_timestamp_mill(days=1)
        cls.yesterday = int((datetime.utcnow() - timedelta(days=1)).timestamp() * 1000)

    def test_web_analytic_events(self):
        """Test web analytic get function"""
        user_id = uuid.uuid4()
        session_id = uuid.uuid4()

        event_data = WebAnalyticEventData(
            eventId=None,
            timestamp=self.yesterday,
            eventType=WebAnalyticEventType.PageView,
            eventData=PageViewData(
                fullUrl="http://localhost:8585/table/sample_data.ecommerce_db.shopify.%22dim.shop%22",
                url="/table/sample_data.ecommerce_db.shopify.dim.foo",
                hostname="localhost",
                language="en-US",
                screenSize="1280x720",
                userId=user_id,
                sessionId=session_id,
                pageLoadTime=0.0,
                referrer="",
            ),
        )
        self.metadata.add_web_analytic_events(
            event_data,
        )

        web_events = self.metadata.get_web_analytic_events(
            WebAnalyticEventType.PageView, self.start_ts, self.end_ts
        )

        test_event = next(
            (
                web_event
                for web_event in web_events
                if web_event.eventData.userId.__root__ == user_id
            ),
            None,
        )

        assert test_event

    def test_delete_web_analytic_event(self):
        """Test web analytic event deletion"""

        for delta in range(7):
            tmsp = get_beginning_of_day_timestamp_mill(days=delta)

            user_id = uuid.uuid4()
            session_id = uuid.uuid4()

            event_data = WebAnalyticEventData(
                eventId=None,
                timestamp=tmsp,
                eventType=WebAnalyticEventType.PageView,
                eventData=PageViewData(
                    fullUrl="http://localhost:8585/table/sample_data.ecommerce_db.shopify.%22dim.shop%22",
                    url="/table/sample_data.ecommerce_db.shopify.dim.foo",
                    hostname="localhost",
                    language="en-US",
                    screenSize="1280x720",
                    userId=user_id,
                    sessionId=session_id,
                    pageLoadTime=0.0,
                    referrer="",
                ),
            )
            self.metadata.add_web_analytic_events(
                event_data,
            )

        self.metadata.delete_web_analytic_event_before_ts_exclusive(
            WebAnalyticEventType.PageView,
            int((datetime.utcnow() - timedelta(days=3)).timestamp() * 1000),
        )

        event = self.metadata.get_web_analytic_events(
            WebAnalyticEventType.PageView,
            int((datetime.utcnow() - timedelta(days=2)).timestamp() * 1000),
            int((datetime.utcnow() - timedelta(days=1)).timestamp() * 1000),
        )

        assert event

        empty_event = self.metadata.get_web_analytic_events(
            WebAnalyticEventType.PageView,
            int((datetime.utcnow() - timedelta(days=7)).timestamp() * 1000),
            int((datetime.utcnow() - timedelta(days=6)).timestamp() * 1000),
        )

        assert not empty_event
