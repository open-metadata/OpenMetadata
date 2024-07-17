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
import uuid
from unittest.mock import patch
from uuid import UUID

from metadata.data_insight.processor.reports.data_processor import DataProcessor
from metadata.data_insight.processor.reports.web_analytic_report_data_processor import (
    WebAnalyticUserActivityReportDataProcessor,
)
from metadata.generated.schema.analytics.basic import WebAnalyticEventType
from metadata.generated.schema.analytics.reportData import ReportDataType
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
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.basic import Email, EntityName, Uuid
from metadata.ingestion.ometa.ometa_api import OpenMetadata

WEB_ANALYTIC_EVENTS = [
    WebAnalyticEventData(
        eventId=UUID("233e2076-086c-4e2e-b713-77e990c63c97"),
        timestamp=1667475458757,
        eventType=WebAnalyticEventType.PageView.value,
        eventData=PageViewData(
            fullUrl="http://localhost:8585/table/sample_data.ecommerce_db.shopify.dim(address)",
            url="/table/sample_data.ecommerce_db.shopify.dim(address)",
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
            fullUrl="http://localhost:8585/table/sample_data.ecommerce_db.shopify.dim(address)",
            url="/table/sample_data.ecommerce_db.shopify.dim(address)",
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

OMETA = OpenMetadata(
    OpenMetadataConnection.model_validate(
        {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
            "enableVersionValidation": "false",
        }
    )
)

USER_DETAILS = {"name": "aaron_johnson0", "team": "sales"}
MOCK_OWNER = User(
    id=Uuid(uuid.uuid4()),
    name=EntityName("aaron_johnson0"),
    email=Email("aaron_johnson0@test.com"),
)


class WebAnalyticEntityViewReportDataProcessorTest(unittest.TestCase):
    @patch.object(
        OpenMetadata,
        "get_by_name",
        return_value=MOCK_OWNER,
    )
    def test_refine(self, mocked_ometa):
        """Check fetch owner returns the expected value"""
        web_analytic_entity_report_data = {}
        processor = DataProcessor.create(
            ReportDataType.webAnalyticEntityViewReportData.value, OMETA
        )
        processor._pre_hook_fn()
        for event in WEB_ANALYTIC_EVENTS:
            processor.refine(event)

        data = processor._refined_data
        assert isinstance(data, dict)

        for datum in processor.yield_refined_data():
            assert isinstance(datum.data, WebAnalyticEntityViewReportData)
            web_analytic_entity_report_data[datum.data.entityFqn.root] = datum.data

        assert (
            web_analytic_entity_report_data[
                "sample_data.ecommerce_db.shopify.dim(address)"
            ].views
            == 2
        )


class WebAnalyticUserActivityReportDataProcessorTest(unittest.TestCase):
    @patch.object(
        WebAnalyticUserActivityReportDataProcessor,
        "_get_user_details",
        return_value=USER_DETAILS,
    )
    def test_refine(self, mocked_user_details):
        """Check fetch owner returns the expected value"""
        processor = DataProcessor.create(
            ReportDataType.webAnalyticUserActivityReportData.value, OMETA
        )
        processor._pre_hook_fn()
        for event in WEB_ANALYTIC_EVENTS:
            processor.refine(event)
        processor._post_hook_fn()

        data = processor._refined_data
        assert isinstance(data, dict)

        for datum in processor.yield_refined_data():
            assert isinstance(datum.data, WebAnalyticUserActivityReportData)
            data = datum.data

        assert isinstance(data, WebAnalyticUserActivityReportData)
        assert data.totalSessions == 2
        assert data.totalPageView == 3
