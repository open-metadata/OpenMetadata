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
SFTP API response models
"""

from typing import List, Optional  # noqa: UP035

from pydantic import BaseModel, ConfigDict, Field


class SftpFileInfo(BaseModel):
    """
    SFTP file information
    """

    model_config = ConfigDict(extra="ignore")

    name: str = Field(..., description="File name")
    full_path: str = Field(..., description="Full path to the file")
    size: Optional[int] = Field(None, description="File size in bytes")  # noqa: UP045
    modified_time: Optional[float] = Field(None, description="Last modified time as Unix timestamp")  # noqa: UP045
    mime_type: Optional[str] = Field(None, description="MIME type")  # noqa: UP045


class SftpDirectoryInfo(BaseModel):
    """
    Processed directory information with calculated path
    """

    model_config = ConfigDict(extra="ignore")

    name: str = Field(..., description="Directory name")
    full_path: str = Field(..., description="Full path to directory")
    parents: List[str] = Field(default_factory=list, description="Parent directory paths")  # noqa: UP006
    modified_time: Optional[float] = Field(None, description="Last modified time as Unix timestamp")  # noqa: UP045
    path: Optional[List[str]] = Field(None, description="Calculated directory path as list of components")  # noqa: UP006, UP045
