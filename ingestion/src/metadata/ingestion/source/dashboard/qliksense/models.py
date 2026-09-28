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

from pydantic import BaseModel

# dashboard models


class QlikDashboardMeta(BaseModel):
    description: str | None = None
    published: bool | None = None


class QlikDashboard(BaseModel):
    qDocName: str  # noqa: N815
    qDocId: str  # noqa: N815
    qTitle: str  # noqa: N815
    qMeta: QlikDashboardMeta | None = QlikDashboardMeta()  # noqa: N815


class QlikDashboardList(BaseModel):
    qDocList: list[QlikDashboard] | None = []  # noqa: N815


class QlikDashboardResult(BaseModel):
    result: QlikDashboardList | None = QlikDashboardList()


# sheet models
class QlikSheetInfo(BaseModel):
    qId: str  # noqa: N815


class QlikSheetMeta(BaseModel):
    title: str | None = None
    description: str | None = None


class QlikSheet(BaseModel):
    qInfo: QlikSheetInfo  # noqa: N815
    qMeta: QlikSheetMeta | None = QlikSheetMeta()  # noqa: N815


class QlikSheetItems(BaseModel):
    qItems: list[QlikSheet] | None = []  # noqa: N815


class QlikSheetAppObject(BaseModel):
    qAppObjectList: QlikSheetItems | None = QlikSheetItems()  # noqa: N815


class QlikSheetLayout(BaseModel):
    qLayout: QlikSheetAppObject | None = QlikSheetAppObject()  # noqa: N815


class QlikSheetResult(BaseModel):
    result: QlikSheetLayout | None = QlikSheetLayout()


# datamodel models
class QlikFields(BaseModel):
    name: str | None = None
    id: str | None = None


class QlikTableConnectionProp(BaseModel):
    tableQualifiers: list[str] | None = []  # noqa: N815


class QlikTable(BaseModel):
    tableName: str | None = None  # noqa: N815
    id: str | None = None
    connectorProperties: QlikTableConnectionProp | None = QlikTableConnectionProp()  # noqa: N815
    fields: list[QlikFields] | None = []


class QlikTablesList(BaseModel):
    tables: list[QlikTable] | None = []


class QlikDataModelValue(BaseModel):
    value: QlikTablesList | None = QlikTablesList()


class QlikDataModelLayout(BaseModel):
    qLayout: QlikTablesList | list[QlikDataModelValue] | None = QlikTablesList()  # noqa: N815


class QlikDataModelResult(BaseModel):
    result: QlikDataModelLayout | None = QlikDataModelLayout()


# GetTablesAndKeys response models
class QlikTablesAndKeysField(BaseModel):
    qName: str | None = None  # noqa: N815
    qOriginalFieldName: str | None = None  # noqa: N815


class QlikTablesAndKeysTable(BaseModel):
    qName: str | None = None  # noqa: N815
    qFields: list[QlikTablesAndKeysField] | None = []  # noqa: N815
    qConnectorProperties: QlikTableConnectionProp | None = QlikTableConnectionProp()  # noqa: N815


class QlikTablesAndKeysResult(BaseModel):
    qtr: list[QlikTablesAndKeysTable] | None = []


class QlikTablesAndKeysResponse(BaseModel):
    result: QlikTablesAndKeysResult | None = QlikTablesAndKeysResult()


# script models
class QlikScript(BaseModel):
    qScript: str | None = None  # noqa: N815


class QlikScriptResult(BaseModel):
    result: QlikScript | None = QlikScript()


class QlikLayoutHandle(BaseModel):
    qHandle: int | None = 2  # noqa: N815


class QlikLayoutValue(BaseModel):
    value: QlikLayoutHandle | None = QlikLayoutHandle()


class QlikQReturn(BaseModel):
    qReturn: QlikLayoutHandle | list[QlikLayoutValue] | None = []  # noqa: N815


class QlikLayoutResult(BaseModel):
    result: QlikQReturn | None = QlikQReturn()
