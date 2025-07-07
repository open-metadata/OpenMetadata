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
SAP ERP API models
"""

from typing import List, Optional

from pydantic import BaseModel, Field

from metadata.generated.schema.entity.data.table import Column, TableConstraint


class SapErpTable(BaseModel):
    """
    SAP ERP Table model
    """

    tabname: str
    tabclass: Optional[str] = None
    ddtext: Optional[str] = None


class SapErpColumn(BaseModel):
    """
    SAP ERP Column model
    """

    tabname: str
    fieldname: Optional[str] = None
    precfield: Optional[str] = None
    datatype: Optional[str] = None
    POS: Optional[int] = None
    notnull: Optional[str] = None
    keyflag: Optional[bool] = None
    scrtext_l: Optional[str] = None
    i_ddtext: Optional[str] = None
    dd_text: Optional[str] = None
    leng: Optional[str] = None
    decimals: Optional[str] = None


class SapErpTableList(BaseModel):
    """
    SAP ERP Table List model
    """

    count: Optional[int] = Field(alias="__count")
    results: Optional[List[SapErpTable]] = None


class SapErpTableResponse(BaseModel):
    """
    SAP ERP Tables Response model
    """

    d: Optional[SapErpTableList] = None


class SapErpColumnList(BaseModel):
    """
    SAP ERP Column List model
    """

    count: Optional[int] = Field(alias="__count")
    results: Optional[List[SapErpColumn]] = None


class SapErpColumnResponse(BaseModel):
    """
    SAP ERP Columns Response model
    """

    d: Optional[SapErpColumnList] = None


class ColumnsAndConstraints(BaseModel):
    """
    Wrapper Model for columns and constraints
    """

    columns: Optional[List[Column]]
    table_constraints: Optional[List[TableConstraint]]


class TableConstraintsModel(BaseModel):
    """
    Wrapper Model for table constraints and primary key columns list
    """

    table_constraints: Optional[List[TableConstraint]] = None
    pk_columns: List[str] = []
