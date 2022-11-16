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
Test data insight
"""

from playwright.sync_api import Page

from metadata.generated.schema.analytics.basic import WebAnalyticEventType
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.teams.user import User
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.time_utils import (
    get_beginning_of_day_timestamp_mill,
    get_end_of_day_timestamp_mill,
)

OM_CONFIG = {
    "hostPort": "http://localhost:8585/api",
    "authProvider": "openmetadata",
    "securityConfig": {
        "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"  # pylint: disable=line-too-long
    },
}


def test_web_analytics_data_are_sent_correctly(page: Page):
    """Test the web analytics data are correctly sent, mocking the admin user going through the website"""

    metadata = OpenMetadata(OpenMetadataConnection.parse_obj(OM_CONFIG))

    admin: User = metadata.get_by_name(entity=User, fqn="admin", fields="*")

    admin_user_id = admin.id.__root__

    page.goto("http://localhost:8585")
    page.get_by_placeholder("Username or Email").fill("admin")
    page.get_by_placeholder("Password").fill("admin")
    page.get_by_test_id("login").click()
    page.get_by_test_id("closeWhatsNew").click()
    page.get_by_test_id("service").click()
    page.get_by_test_id("service-name-sample_data").click()
    page.get_by_text("ecommerce_db").click()
    page.locator("td >> a").get_by_text("shopify").click()
    page.get_by_text("dim.shop").click()

    web_events = metadata.get_web_analytic_events(
        WebAnalyticEventType.PageView,
        get_beginning_of_day_timestamp_mill(),
        get_end_of_day_timestamp_mill(),
    )

    event = next(
        (
            web_event
            for web_event in web_events
            if (
                web_event.eventData.userId.__root__ == admin_user_id
                and web_event.eventData.url
                == "/table/sample_data.ecommerce_db.shopify.%22dim.shop%22"
            )
        )
    )

    assert event
