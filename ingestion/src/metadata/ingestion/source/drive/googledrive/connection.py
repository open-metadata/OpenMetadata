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
Google Drive connection and helpers
"""
import traceback
from functools import partial
from typing import Optional

from google.auth import default
from googleapiclient.discovery import Resource, build

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.drive.googleDriveConnection import (
    GoogleDriveConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN
from metadata.utils.credentials import set_google_credentials
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class GoogleDriveClient:
    """
    Wrapper around Google Sheets and Drive API clients
    """

    def __init__(self, sheets_service: Resource, drive_service: Resource):
        self.sheets_service = sheets_service
        self.drive_service = drive_service


def get_connection(connection: GoogleDriveConnection) -> GoogleDriveClient:
    """
    Create connection to Google Drive
    """
    scopes = (
        connection.scopes
        if hasattr(connection, "scopes") and connection.scopes
        else [
            "https://www.googleapis.com/auth/spreadsheets.readonly",
            "https://www.googleapis.com/auth/drive.readonly",
            "https://www.googleapis.com/auth/drive.metadata.readonly",
        ]
    )

    # Set Google credentials using the utility function
    set_google_credentials(gcp_credentials=connection.credentials)

    # Get default credentials - this will use the credentials set by set_google_credentials
    credentials, _ = default(scopes=scopes)

    # Handle impersonation if configured
    if (
        connection.credentials.gcpImpersonateServiceAccount
        and connection.credentials.gcpImpersonateServiceAccount.impersonateServiceAccount
    ):
        from google.auth import (  # pylint: disable=import-outside-toplevel
            impersonated_credentials,
        )

        credentials = impersonated_credentials.Credentials(
            source_credentials=credentials,
            target_principal=connection.credentials.gcpImpersonateServiceAccount.impersonateServiceAccount,
            target_scopes=scopes,
            lifetime=connection.credentials.gcpImpersonateServiceAccount.lifetime,
        )

    # Build the services
    sheets_service = build("sheets", "v4", credentials=credentials)
    drive_service = build("drive", "v3", credentials=credentials)

    return GoogleDriveClient(sheets_service, drive_service)


def test_connection(
    metadata: OpenMetadata,
    client: GoogleDriveClient,
    service_connection: GoogleDriveConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection to Google Drive
    """
    logger.info("Starting Google Drive test connection")

    def check_access():
        """
        Check if we can access Google Drive API
        """
        try:
            # Try to get user info - this will fail if credentials are invalid
            about = client.drive_service.about().get(fields="user").execute()
            user_email = about.get("user", {}).get("emailAddress", "Unknown")
            logger.info(f"Successfully authenticated as: {user_email}")
        except Exception as exc:
            logger.debug(f"Access check error traceback: {traceback.format_exc()}")
            raise SourceConnectionException(f"Failed to access Google Drive API: {exc}")

    def get_drive_files():
        """
        Test listing drive files
        """
        try:
            logger.info("Testing Google Drive file listing")

            # Query for a small number of files to test access
            query = "trashed=false"

            results = (
                client.drive_service.files()
                .list(
                    q=query,
                    pageSize=5,
                    fields="files(id, name, mimeType)",
                    supportsAllDrives=True,
                    includeItemsFromAllDrives=True,
                )
                .execute()
            )

            files = results.get("files", [])
            logger.info(f"Found {len(files)} files in Drive (sample)")

            # Also test for shared drives
            logger.info("Testing shared drive access")
            try:
                shared_results = (
                    client.drive_service.drives()
                    .list(pageSize=5, fields="drives(id, name)")
                    .execute()
                )
                shared_drives = shared_results.get("drives", [])
                logger.info(f"Found {len(shared_drives)} shared drives")
                for drive in shared_drives:
                    logger.info(
                        f"Shared drive: {drive.get('name')} (ID: {drive.get('id')})"
                    )
            except Exception as shared_exc:
                logger.warning(f"Could not access shared drives: {shared_exc}")

        except Exception as exc:
            logger.debug(f"Drive files test error traceback: {traceback.format_exc()}")
            raise SourceConnectionException(f"Failed to list drive files: {exc}")

    def get_spreadsheets(include_sheets: bool = False):
        """
        Test listing spreadsheets if Google Sheets is included
        """
        if not include_sheets:
            return

        try:
            logger.info("Testing Google Sheets spreadsheet listing")

            # Query for Google Sheets files
            query = (
                "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
            )

            results = (
                client.drive_service.files()
                .list(q=query, pageSize=5, fields="files(id, name)")
                .execute()
            )

            files = results.get("files", [])
            logger.info(f"Found {len(files)} spreadsheets")

        except Exception as exc:
            logger.debug(f"Spreadsheet test error traceback: {traceback.format_exc()}")
            raise SourceConnectionException(f"Failed to list spreadsheets: {exc}")

    test_fn = {
        "CheckAccess": check_access,
        "GetDriveFiles": get_drive_files,
        "GetSpreadsheets": partial(
            get_spreadsheets, include_sheets=service_connection.includeGoogleSheets
        ),
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
