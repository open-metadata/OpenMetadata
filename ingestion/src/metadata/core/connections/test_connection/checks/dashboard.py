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
"""
Dashboard service step identity.

Dashboard connectors reach their source over a REST API (with OAuth or token
auth), not a SQLAlchemy engine, so their check helpers are the protocol-generic
ones in ``checks.rest``; only the step names are specific to the category.
"""

from __future__ import annotations

from metadata.core.connections.test_connection.check import StepName


class DashboardStep(StepName):
    """The steps a dashboard connector can be asked to verify."""

    CheckAccess = "CheckAccess"
    GetDashboards = "GetDashboards"
    ServerInfo = "ServerInfo"
    ValidateApiVersion = "ValidateApiVersion"
    ValidateVersion = "ValidateVersion"
    ValidateSiteUrl = "ValidateSiteUrl"
    GetWorkbooks = "GetWorkbooks"
    GetViews = "GetViews"
    GetOwners = "GetOwners"
    GetDataModels = "GetDataModels"
    ListDashboards = "ListDashboards"
    ListLookMLModels = "ListLookMLModels"
