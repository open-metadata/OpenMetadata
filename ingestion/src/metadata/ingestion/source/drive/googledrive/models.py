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
Google Drive API response models
"""

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class GoogleDriveOwner(BaseModel):
    """
    Google Drive file/folder owner information
    """

    model_config = ConfigDict(extra="ignore")

    displayName: str | None = Field(None, description="Owner display name")  # noqa: N815

    emailAddress: str | None = Field(None, description="Owner email address")  # noqa: N815

    photoLink: str | None = Field(None, description="Owner photo link")  # noqa: N815


class GoogleDriveFile(BaseModel):
    """
    Google Drive file/folder information
    """

    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., description="File/folder ID")
    name: str = Field(..., description="File/folder name")
    parents: list[str] | None = Field(None, description="Parent folder IDs")
    createdTime: str | None = Field(None, description="Creation time")  # noqa: N815
    modifiedTime: str | None = Field(None, description="Last modified time")  # noqa: N815
    size: str | None = Field(None, description="File size in bytes")
    mimeType: str | None = Field(None, description="MIME type")  # noqa: N815
    shared: bool | None = Field(None, description="Whether the file is shared")
    webViewLink: str | None = Field(None, description="Web view link")  # noqa: N815
    description: str | None = Field(None, description="File description")
    owners: list[GoogleDriveOwner] | None = Field(None, description="File owners")


class GoogleDriveDirectoryInfo(BaseModel):
    """
    Processed directory information with calculated path
    """

    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., description="Directory ID")
    name: str = Field(..., description="Directory name")
    parents: list[str] = Field(default_factory=list, description="Parent directory IDs")
    created_time: str | None = Field(None, description="Creation time")
    modified_time: str | None = Field(None, description="Last modified time")
    is_shared: bool = Field(False, description="Whether the directory is shared")
    web_view_link: str | None = Field(None, description="Web view link")
    description: str = Field("", description="Directory description")
    owners: list[GoogleDriveOwner] = Field(default_factory=list, description="Directory owners")
    path: list[str] | None = Field(None, description="Calculated directory path as list of components")


class GoogleDriveListResponse(BaseModel):
    """
    Google Drive API list response
    """

    model_config = ConfigDict(extra="ignore")

    files: list[GoogleDriveFile] = Field(default_factory=list, description="List of files/folders")
    nextPageToken: str | None = Field(None, description="Next page token")  # noqa: N815


class GoogleSheetsProperties(BaseModel):
    """
    Google Sheets properties
    """

    model_config = ConfigDict(extra="ignore")

    title: str | None = Field(None, description="Sheet title")
    sheetId: int | None = Field(None, description="Sheet ID")  # noqa: N815
    index: int | None = Field(None, description="Sheet index position")
    gridProperties: Optional["GoogleSheetsGridProperties"] = Field(  # noqa: N815
        None, description="Grid properties (rowCount, columnCount)"
    )


class GoogleSheetsGridProperties(BaseModel):
    """
    Google Sheets grid properties
    """

    model_config = ConfigDict(extra="ignore")

    rowCount: int | None = Field(None, description="Row Count")  # noqa: N815
    columnCount: int | None = Field(None, description="Column Count")  # noqa: N815


class GoogleSheetsSheet(BaseModel):
    """
    Google Sheets sheet information
    """

    model_config = ConfigDict(extra="ignore")

    properties: GoogleSheetsProperties | None = Field(None, description="Sheet properties")
    gridProperties: GoogleSheetsGridProperties | None = Field(None, description="Sheet grid properties")  # noqa: N815
    name: str | None = Field(None, description="Sheet name")


class GoogleSheetsSpreadsheetProperties(BaseModel):
    """
    Google Sheets spreadsheet properties
    """

    model_config = ConfigDict(extra="ignore")

    title: str | None = Field(None, description="Spreadsheet title")


class GoogleSheetsSpreadsheetDetails(BaseModel):
    """
    Google Sheets spreadsheet details
    """

    model_config = ConfigDict(extra="ignore")

    spreadsheetId: str = Field(..., description="Spreadsheet ID")  # noqa: N815
    properties: GoogleSheetsSpreadsheetProperties | None = Field(None, description="Spreadsheet properties")
    sheets: list[GoogleSheetsSheet] = Field(default_factory=list, description="List of sheets")
    description: str = Field("", description="Spreadsheet description")
    spreadsheetUrl: str = Field("", description="Spreadsheet URL")  # noqa: N815
    parents: list[str] | None = Field(default_factory=list, description="Parent directory IDs")
    createdTime: str | None = Field(None, description="Creation time")  # noqa: N815
    modifiedTime: str | None = Field(None, description="Last modified time")  # noqa: N815
    mimeType: str | None = Field(None, description="MIME type of the spreadsheet")  # noqa: N815
