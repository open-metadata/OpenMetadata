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
QlikSense Models
"""
from typing import List, Optional, Union

from pydantic import BaseModel

# dashboard models


class QlikDashboardMeta(BaseModel):
    description: Optional[str] = None
    published: Optional[bool] = None


class QlikDashboard(BaseModel):
    qDocName: str
    qDocId: str
    qTitle: str
    qMeta: Optional[QlikDashboardMeta] = QlikDashboardMeta()


class QlikDashboardList(BaseModel):
    qDocList: Optional[List[QlikDashboard]] = []


class QlikDashboardResult(BaseModel):
    result: Optional[QlikDashboardList] = QlikDashboardList()


# sheet models
class QlikSheetInfo(BaseModel):
    qId: str


class QlikSheetMeta(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class QlikSheet(BaseModel):
    qInfo: QlikSheetInfo
    qMeta: Optional[QlikSheetMeta] = QlikSheetMeta()


class QlikSheetItems(BaseModel):
    qItems: Optional[List[QlikSheet]] = []


class QlikSheetAppObject(BaseModel):
    qAppObjectList: Optional[QlikSheetItems] = QlikSheetItems()


class QlikSheetLayout(BaseModel):
    qLayout: Optional[QlikSheetAppObject] = QlikSheetAppObject()


class QlikSheetResult(BaseModel):
    result: Optional[QlikSheetLayout] = QlikSheetLayout()


# datamodel models
class QlikFields(BaseModel):
    name: Optional[str] = None
    id: Optional[str] = None


class QlikTableConnectionProp(BaseModel):
    tableQualifiers: Optional[List[str]] = []


class QlikTable(BaseModel):
    tableName: Optional[str] = None
    id: Optional[str] = None
    connectorProperties: Optional[QlikTableConnectionProp] = QlikTableConnectionProp()
    fields: Optional[List[QlikFields]] = []


class QlikTablesList(BaseModel):
    tables: Optional[List[QlikTable]] = []


class QlikDataModelValue(BaseModel):
    value: Optional[QlikTablesList] = QlikTablesList()


class QlikDataModelLayout(BaseModel):
    qLayout: Optional[
        Union[QlikTablesList, List[QlikDataModelValue]]
    ] = QlikTablesList()


class QlikDataModelResult(BaseModel):
    result: Optional[QlikDataModelLayout] = QlikDataModelLayout()


class QlikLayoutHandle(BaseModel):
    qHandle: Optional[int] = 2


class QlikLayoutValue(BaseModel):
    value: Optional[QlikLayoutHandle] = QlikLayoutHandle()


class QlikQReturn(BaseModel):
    qReturn: Optional[Union[QlikLayoutHandle, List[QlikLayoutValue]]] = []


class QlikLayoutResult(BaseModel):
    result: Optional[QlikQReturn] = QlikQReturn()
