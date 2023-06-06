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
Validate entity data processor class
"""

import unittest
from unittest.mock import MagicMock, patch
from uuid import UUID

from metadata.data_insight.processor.data_processor import DataProcessor
from metadata.data_insight.processor.web_analytic_report_data_processor import (
    WebAnalyticEntityViewReportDataProcessor,
    WebAnalyticUserActivityReportDataProcessor,
)
from metadata.generated.schema.analytics.basic import WebAnalyticEventType
from metadata.generated.schema.analytics.reportDataType.webAnalyticEntityViewReportData import (
    WebAnalyticEntityViewReportData,
)
from metadata.generated.schema.analytics.reportDataType.webAnalyticUserActivityReportData import (
    WebAnalyticUserActivityReportData,
)
from metadata.generated.schema.analytics.webAnalyticEventData import (
    WebAnalyticEventData,
)
from metadata.generated.schema.analytics.webAnalyticEventType.pageViewEvent import (
    PageViewData,
)

WEB_ANALYTIC_EVENTS = [
    WebAnalyticEventData(
        eventId=UUID("233e2076-086c-4e2e-b713-77e990c63c97"),
        timestamp=1667475458757,
        eventType=WebAnalyticEventType.PageView.value,
        eventData=PageViewData(
            fullUrl="http://localhost:8585/table/sample_data.ecommerce_db.shopify.dim_address",
            url="/table/sample_data.ecommerce_db.shopify.dim_address",
            hostname="localhost",
            language="en-US",
            screenSize="2140x1273",
            userId=UUID("6e32b3c8-d408-45a9-9aab-fa2b5b138a14"),
            sessionId=UUID("f3e61516-1410-4713-806b-3ac8a997f66c"),
            pageLoadTime=0.0,
            referrer="",
        ),
    ),
    WebAnalyticEventData(
        eventId=UUID("233e2076-086c-4e2e-b713-77e990c63c97"),
        timestamp=1667475458757,
        eventType=WebAnalyticEventType.PageView.value,
        eventData=PageViewData(
            fullUrl="http://localhost:8585/table/sample_data.ecommerce_db.shopify.dim_address",
            url="/table/sample_data.ecommerce_db.shopify.dim_address",
            hostname="localhost",
            language="en-US",
            screenSize="2140x1273",
            userId=UUID("6e32b3c8-d408-45a9-9aab-fa2b5b138a14"),
            sessionId=UUID("f3e61516-1410-4713-806b-3ac8a997f66d"),
            pageLoadTime=0.0,
            referrer="",
        ),
    ),
    WebAnalyticEventData(
        eventId=UUID("5dec0c8a-a548-4d4b-8773-00b5ed48c855"),
        timestamp=1667475456742,
        eventType=WebAnalyticEventType.PageView.value,
        eventData=PageViewData(
            fullUrl="http://localhost:8585/databaseSchema/sample_data.ecommerce_db.shopify",
            url="/databaseSchema/sample_data.ecommerce_db.shopify",
            hostname="localhost",
            language="en-US",
            screenSize="2140x1273",
            userId=UUID("6e32b3c8-d408-45a9-9aab-fa2b5b138a14"),
            sessionId=UUID("f3e61516-1410-4713-806b-3ac8a997f66c"),
            pageLoadTime=0.0,
            referrer="",
        ),
    ),
]

USER_DETAILS = {"name": "aaron_johnson0", "team": "sales"}


class WebAnalyticEntityViewReportDataProcessorTest(unittest.TestCase):
    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata", return_value=MagicMock())
    @patch.object(
        WebAnalyticEntityViewReportDataProcessor,
        "fetch_data",
        return_value=WEB_ANALYTIC_EVENTS,
    )
    def test_refine(self, mocked_ometa, mocked_fetch_data):
        """Check fecth owner returns the expected value"""
        processor = DataProcessor.create(
            "WebAnalyticEntityViewReportData", mocked_ometa
        )
        data = next(processor.refine()).data

        assert isinstance(data, WebAnalyticEntityViewReportData)
        assert data.views == 2


class WebAnalyticUserActivityReportDataProcessorTest(unittest.TestCase):
    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata", return_value=MagicMock())
    @patch.object(
        WebAnalyticUserActivityReportDataProcessor,
        "fetch_data",
        return_value=WEB_ANALYTIC_EVENTS,
    )
    @patch.object(
        WebAnalyticUserActivityReportDataProcessor,
        "_get_user_details",
        return_value=USER_DETAILS,
    )
    def test_refine(self, mocked_ometa, mocked_fetch_data, mocked_user_details):
        """Check fecth owner returns the expected value"""
        processor = DataProcessor.create(
            "WebAnalyticUserActivityReportData", mocked_ometa
        )
        data = next(processor.refine()).data

        assert isinstance(data, WebAnalyticUserActivityReportData)
        assert data.totalSessions == 2
        assert data.totalPageView == 3
