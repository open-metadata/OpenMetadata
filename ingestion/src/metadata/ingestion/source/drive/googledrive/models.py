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

from typing import List, Optional  # noqa: UP035

from pydantic import BaseModel, ConfigDict, Field


class GoogleDriveOwner(BaseModel):
    """
    Google Drive file/folder owner information
    """

    model_config = ConfigDict(extra="ignore")

    displayName: Optional[str] = Field(None, description="Owner display name")  # noqa: N815, UP045

    emailAddress: Optional[str] = Field(None, description="Owner email address")  # noqa: N815, UP045

    photoLink: Optional[str] = Field(None, description="Owner photo link")  # noqa: N815, UP045


class GoogleDriveFile(BaseModel):
    """
    Google Drive file/folder information
    """

    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., description="File/folder ID")
    name: str = Field(..., description="File/folder name")
    parents: Optional[List[str]] = Field(None, description="Parent folder IDs")  # noqa: UP006, UP045
    createdTime: Optional[str] = Field(None, description="Creation time")  # noqa: N815, UP045
    modifiedTime: Optional[str] = Field(None, description="Last modified time")  # noqa: N815, UP045
    size: Optional[str] = Field(None, description="File size in bytes")  # noqa: UP045
    mimeType: Optional[str] = Field(None, description="MIME type")  # noqa: N815, UP045
    shared: Optional[bool] = Field(None, description="Whether the file is shared")  # noqa: UP045
    webViewLink: Optional[str] = Field(None, description="Web view link")  # noqa: N815, UP045
    description: Optional[str] = Field(None, description="File description")  # noqa: UP045
    owners: Optional[List[GoogleDriveOwner]] = Field(None, description="File owners")  # noqa: UP006, UP045


class GoogleDriveDirectoryInfo(BaseModel):
    """
    Processed directory information with calculated path
    """

    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., description="Directory ID")
    name: str = Field(..., description="Directory name")
    parents: List[str] = Field(default_factory=list, description="Parent directory IDs")  # noqa: UP006
    created_time: Optional[str] = Field(None, description="Creation time")  # noqa: UP045
    modified_time: Optional[str] = Field(None, description="Last modified time")  # noqa: UP045
    is_shared: bool = Field(False, description="Whether the directory is shared")
    web_view_link: Optional[str] = Field(None, description="Web view link")  # noqa: UP045
    description: str = Field("", description="Directory description")
    owners: List[GoogleDriveOwner] = Field(default_factory=list, description="Directory owners")  # noqa: UP006
    path: Optional[List[str]] = Field(None, description="Calculated directory path as list of components")  # noqa: UP006, UP045


class GoogleDriveListResponse(BaseModel):
    """
    Google Drive API list response
    """

    model_config = ConfigDict(extra="ignore")

    files: List[GoogleDriveFile] = Field(default_factory=list, description="List of files/folders")  # noqa: UP006
    nextPageToken: Optional[str] = Field(None, description="Next page token")  # noqa: N815, UP045


class GoogleSheetsProperties(BaseModel):
    """
    Google Sheets properties
    """

    model_config = ConfigDict(extra="ignore")

    title: Optional[str] = Field(None, description="Sheet title")  # noqa: UP045
    sheetId: Optional[int] = Field(None, description="Sheet ID")  # noqa: N815, UP045
    index: Optional[int] = Field(None, description="Sheet index position")  # noqa: UP045
    gridProperties: Optional["GoogleSheetsGridProperties"] = Field(  # noqa: N815
        None, description="Grid properties (rowCount, columnCount)"
    )


class GoogleSheetsGridProperties(BaseModel):
    """
    Google Sheets grid properties
    """

    model_config = ConfigDict(extra="ignore")

    rowCount: Optional[int] = Field(None, description="Row Count")  # noqa: N815, UP045
    columnCount: Optional[int] = Field(None, description="Column Count")  # noqa: N815, UP045


class GoogleSheetsSheet(BaseModel):
    """
    Google Sheets sheet information
    """

    model_config = ConfigDict(extra="ignore")

    properties: Optional[GoogleSheetsProperties] = Field(None, description="Sheet properties")  # noqa: UP045
    gridProperties: Optional[GoogleSheetsGridProperties] = Field(None, description="Sheet grid properties")  # noqa: N815, UP045
    name: Optional[str] = Field(None, description="Sheet name")  # noqa: UP045


class GoogleSheetsSpreadsheetProperties(BaseModel):
    """
    Google Sheets spreadsheet properties
    """

    model_config = ConfigDict(extra="ignore")

    title: Optional[str] = Field(None, description="Spreadsheet title")  # noqa: UP045


class GoogleSheetsSpreadsheetDetails(BaseModel):
    """
    Google Sheets spreadsheet details
    """

    model_config = ConfigDict(extra="ignore")

    spreadsheetId: str = Field(..., description="Spreadsheet ID")  # noqa: N815
    properties: Optional[GoogleSheetsSpreadsheetProperties] = Field(None, description="Spreadsheet properties")  # noqa: UP045
    sheets: List[GoogleSheetsSheet] = Field(default_factory=list, description="List of sheets")  # noqa: UP006
    description: str = Field("", description="Spreadsheet description")
    spreadsheetUrl: str = Field("", description="Spreadsheet URL")  # noqa: N815
    parents: Optional[List[str]] = Field(default_factory=list, description="Parent directory IDs")  # noqa: UP006, UP045
    createdTime: Optional[str] = Field(None, description="Creation time")  # noqa: N815, UP045
    modifiedTime: Optional[str] = Field(None, description="Last modified time")  # noqa: N815, UP045
    mimeType: Optional[str] = Field(None, description="MIME type of the spreadsheet")  # noqa: N815, UP045
