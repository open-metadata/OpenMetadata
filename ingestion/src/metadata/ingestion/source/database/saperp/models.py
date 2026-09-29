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

from pydantic import BaseModel, Field

from metadata.generated.schema.entity.data.table import Column, TableConstraint


class SapErpTable(BaseModel):
    """
    SAP ERP Table model
    """

    tabname: str
    tabclass: str | None = None
    ddtext: str | None = None


class SapErpColumn(BaseModel):
    """
    SAP ERP Column model
    """

    tabname: str
    fieldname: str | None = None
    precfield: str | None = None
    datatype: str | None = None
    POS: int | None = None
    notnull: str | None = None
    keyflag: bool | None = None
    scrtext_l: str | None = None
    i_ddtext: str | None = None
    dd_text: str | None = None
    leng: str | None = None
    decimals: str | None = None


class SapErpTableList(BaseModel):
    """
    SAP ERP Table List model
    """

    count: int | None = Field(alias="__count")
    results: list[SapErpTable] | None = None


class SapErpTableResponse(BaseModel):
    """
    SAP ERP Tables Response model
    """

    d: SapErpTableList | None = None


class SapErpColumnList(BaseModel):
    """
    SAP ERP Column List model
    """

    count: int | None = Field(alias="__count")
    results: list[SapErpColumn] | None = None


class SapErpColumnResponse(BaseModel):
    """
    SAP ERP Columns Response model
    """

    d: SapErpColumnList | None = None


class ColumnsAndConstraints(BaseModel):
    """
    Wrapper Model for columns and constraints
    """

    columns: list[Column] | None
    table_constraints: list[TableConstraint] | None


class TableConstraintsModel(BaseModel):
    """
    Wrapper Model for table constraints and primary key columns list
    """

    table_constraints: list[TableConstraint] | None = None
    pk_columns: list[str] = []
