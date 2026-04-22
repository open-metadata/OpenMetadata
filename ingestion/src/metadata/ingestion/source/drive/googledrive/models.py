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
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class GoogleDriveOwner(BaseModel):
    """
    Google Drive file/folder owner information
    """

    model_config = ConfigDict(extra="ignore")

    displayName: Optional[str] = Field(None, description="Owner display name")

    emailAddress: Optional[str] = Field(None, description="Owner email address")

    photoLink: Optional[str] = Field(None, description="Owner photo link")


class GoogleDriveFile(BaseModel):
    """
    Google Drive file/folder information
    """

    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., description="File/folder ID")
    name: str = Field(..., description="File/folder name")
    parents: Optional[List[str]] = Field(None, description="Parent folder IDs")
    createdTime: Optional[str] = Field(None, description="Creation time")
    modifiedTime: Optional[str] = Field(None, description="Last modified time")
    size: Optional[str] = Field(None, description="File size in bytes")
    mimeType: Optional[str] = Field(None, description="MIME type")
    shared: Optional[bool] = Field(None, description="Whether the file is shared")
    webViewLink: Optional[str] = Field(None, description="Web view link")
    description: Optional[str] = Field(None, description="File description")
    owners: Optional[List[GoogleDriveOwner]] = Field(None, description="File owners")


class GoogleDriveDirectoryInfo(BaseModel):
    """
    Processed directory information with calculated path
    """

    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., description="Directory ID")
    name: str = Field(..., description="Directory name")
    parents: List[str] = Field(default_factory=list, description="Parent directory IDs")
    created_time: Optional[str] = Field(None, description="Creation time")
    modified_time: Optional[str] = Field(None, description="Last modified time")
    is_shared: bool = Field(False, description="Whether the directory is shared")
    web_view_link: Optional[str] = Field(None, description="Web view link")
    description: str = Field("", description="Directory description")
    owners: List[GoogleDriveOwner] = Field(
        default_factory=list, description="Directory owners"
    )
    path: Optional[List[str]] = Field(
        None, description="Calculated directory path as list of components"
    )


class GoogleDriveListResponse(BaseModel):
    """
    Google Drive API list response
    """

    model_config = ConfigDict(extra="ignore")

    files: List[GoogleDriveFile] = Field(
        default_factory=list, description="List of files/folders"
    )
    nextPageToken: Optional[str] = Field(None, description="Next page token")


class GoogleSheetsProperties(BaseModel):
    """
    Google Sheets properties
    """

    model_config = ConfigDict(extra="ignore")

    title: Optional[str] = Field(None, description="Sheet title")
    sheetId: Optional[int] = Field(None, description="Sheet ID")
    index: Optional[int] = Field(None, description="Sheet index position")
    gridProperties: Optional["GoogleSheetsGridProperties"] = Field(
        None, description="Grid properties (rowCount, columnCount)"
    )


class GoogleSheetsGridProperties(BaseModel):
    """
    Google Sheets grid properties
    """

    model_config = ConfigDict(extra="ignore")

    rowCount: Optional[int] = Field(None, description="Row Count")
    columnCount: Optional[int] = Field(None, description="Column Count")


class GoogleSheetsSheet(BaseModel):
    """
    Google Sheets sheet information
    """

    model_config = ConfigDict(extra="ignore")

    properties: Optional[GoogleSheetsProperties] = Field(
        None, description="Sheet properties"
    )
    gridProperties: Optional[GoogleSheetsGridProperties] = Field(
        None, description="Sheet grid properties"
    )
    name: Optional[str] = Field(None, description="Sheet name")


class GoogleSheetsSpreadsheetProperties(BaseModel):
    """
    Google Sheets spreadsheet properties
    """

    model_config = ConfigDict(extra="ignore")

    title: Optional[str] = Field(None, description="Spreadsheet title")


class GoogleSheetsSpreadsheetDetails(BaseModel):
    """
    Google Sheets spreadsheet details
    """

    model_config = ConfigDict(extra="ignore")

    spreadsheetId: str = Field(..., description="Spreadsheet ID")
    properties: Optional[GoogleSheetsSpreadsheetProperties] = Field(
        None, description="Spreadsheet properties"
    )
    sheets: List[GoogleSheetsSheet] = Field(
        default_factory=list, description="List of sheets"
    )
    description: str = Field("", description="Spreadsheet description")
    spreadsheetUrl: str = Field("", description="Spreadsheet URL")
    parents: Optional[List[str]] = Field(
        default_factory=list, description="Parent directory IDs"
    )
    createdTime: Optional[str] = Field(None, description="Creation time")
    modifiedTime: Optional[str] = Field(None, description="Last modified time")
    mimeType: Optional[str] = Field(None, description="MIME type of the spreadsheet")
