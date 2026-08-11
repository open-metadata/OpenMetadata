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
QlikSense Models
"""

from typing import List, Optional, Union  # noqa: UP035

from pydantic import BaseModel

# dashboard models


class QlikDashboardMeta(BaseModel):
    description: Optional[str] = None  # noqa: UP045
    published: Optional[bool] = None  # noqa: UP045


class QlikDashboard(BaseModel):
    qDocName: str  # noqa: N815
    qDocId: str  # noqa: N815
    qTitle: str  # noqa: N815
    qMeta: Optional[QlikDashboardMeta] = QlikDashboardMeta()  # noqa: N815, UP045


class QlikDashboardList(BaseModel):
    qDocList: Optional[List[QlikDashboard]] = []  # noqa: N815, UP006, UP045


class QlikDashboardResult(BaseModel):
    result: Optional[QlikDashboardList] = QlikDashboardList()  # noqa: UP045


# sheet models
class QlikSheetInfo(BaseModel):
    qId: str  # noqa: N815


class QlikSheetMeta(BaseModel):
    title: Optional[str] = None  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045


class QlikSheet(BaseModel):
    qInfo: QlikSheetInfo  # noqa: N815
    qMeta: Optional[QlikSheetMeta] = QlikSheetMeta()  # noqa: N815, UP045


class QlikSheetItems(BaseModel):
    qItems: Optional[List[QlikSheet]] = []  # noqa: N815, UP006, UP045


class QlikSheetAppObject(BaseModel):
    qAppObjectList: Optional[QlikSheetItems] = QlikSheetItems()  # noqa: N815, UP045


class QlikSheetLayout(BaseModel):
    qLayout: Optional[QlikSheetAppObject] = QlikSheetAppObject()  # noqa: N815, UP045


class QlikSheetResult(BaseModel):
    result: Optional[QlikSheetLayout] = QlikSheetLayout()  # noqa: UP045


# datamodel models
class QlikFields(BaseModel):
    name: Optional[str] = None  # noqa: UP045
    id: Optional[str] = None  # noqa: UP045


class QlikTableConnectionProp(BaseModel):
    tableQualifiers: Optional[List[str]] = []  # noqa: N815, UP006, UP045


class QlikTable(BaseModel):
    tableName: Optional[str] = None  # noqa: N815, UP045
    id: Optional[str] = None  # noqa: UP045
    connectorProperties: Optional[QlikTableConnectionProp] = QlikTableConnectionProp()  # noqa: N815, UP045
    fields: Optional[List[QlikFields]] = []  # noqa: UP006, UP045


class QlikTablesList(BaseModel):
    tables: Optional[List[QlikTable]] = []  # noqa: UP006, UP045


class QlikDataModelValue(BaseModel):
    value: Optional[QlikTablesList] = QlikTablesList()  # noqa: UP045


class QlikDataModelLayout(BaseModel):
    qLayout: Optional[Union[QlikTablesList, List[QlikDataModelValue]]] = QlikTablesList()  # noqa: N815, UP006, UP007, UP045


class QlikDataModelResult(BaseModel):
    result: Optional[QlikDataModelLayout] = QlikDataModelLayout()  # noqa: UP045


# GetTablesAndKeys response models
class QlikTablesAndKeysField(BaseModel):
    qName: Optional[str] = None  # noqa: N815, UP045
    qOriginalFieldName: Optional[str] = None  # noqa: N815, UP045


class QlikTablesAndKeysTable(BaseModel):
    qName: Optional[str] = None  # noqa: N815, UP045
    qFields: Optional[List[QlikTablesAndKeysField]] = []  # noqa: N815, UP006, UP045
    qConnectorProperties: Optional[QlikTableConnectionProp] = QlikTableConnectionProp()  # noqa: N815, UP045


class QlikTablesAndKeysResult(BaseModel):
    qtr: Optional[List[QlikTablesAndKeysTable]] = []  # noqa: UP006, UP045


class QlikTablesAndKeysResponse(BaseModel):
    result: Optional[QlikTablesAndKeysResult] = QlikTablesAndKeysResult()  # noqa: UP045


# script models
class QlikScript(BaseModel):
    qScript: Optional[str] = None  # noqa: N815, UP045


class QlikScriptResult(BaseModel):
    result: Optional[QlikScript] = QlikScript()  # noqa: UP045


class QlikLayoutHandle(BaseModel):
    qHandle: Optional[int] = 2  # noqa: N815, UP045


class QlikLayoutValue(BaseModel):
    value: Optional[QlikLayoutHandle] = QlikLayoutHandle()  # noqa: UP045


class QlikQReturn(BaseModel):
    qReturn: Optional[Union[QlikLayoutHandle, List[QlikLayoutValue]]] = []  # noqa: N815, UP006, UP007, UP045


class QlikLayoutResult(BaseModel):
    result: Optional[QlikQReturn] = QlikQReturn()  # noqa: UP045
