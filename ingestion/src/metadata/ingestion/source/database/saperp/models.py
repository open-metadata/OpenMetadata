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

from typing import List, Optional  # noqa: UP035

from pydantic import BaseModel, Field

from metadata.generated.schema.entity.data.table import Column, TableConstraint


class SapErpTable(BaseModel):
    """
    SAP ERP Table model
    """

    tabname: str
    tabclass: Optional[str] = None  # noqa: UP045
    ddtext: Optional[str] = None  # noqa: UP045


class SapErpColumn(BaseModel):
    """
    SAP ERP Column model
    """

    tabname: str
    fieldname: Optional[str] = None  # noqa: UP045
    precfield: Optional[str] = None  # noqa: UP045
    datatype: Optional[str] = None  # noqa: UP045
    POS: Optional[int] = None  # noqa: UP045
    notnull: Optional[str] = None  # noqa: UP045
    keyflag: Optional[bool] = None  # noqa: UP045
    scrtext_l: Optional[str] = None  # noqa: UP045
    i_ddtext: Optional[str] = None  # noqa: UP045
    dd_text: Optional[str] = None  # noqa: UP045
    leng: Optional[str] = None  # noqa: UP045
    decimals: Optional[str] = None  # noqa: UP045


class SapErpTableList(BaseModel):
    """
    SAP ERP Table List model
    """

    count: Optional[int] = Field(alias="__count")  # noqa: UP045
    results: Optional[List[SapErpTable]] = None  # noqa: UP006, UP045


class SapErpTableResponse(BaseModel):
    """
    SAP ERP Tables Response model
    """

    d: Optional[SapErpTableList] = None  # noqa: UP045


class SapErpColumnList(BaseModel):
    """
    SAP ERP Column List model
    """

    count: Optional[int] = Field(alias="__count")  # noqa: UP045
    results: Optional[List[SapErpColumn]] = None  # noqa: UP006, UP045


class SapErpColumnResponse(BaseModel):
    """
    SAP ERP Columns Response model
    """

    d: Optional[SapErpColumnList] = None  # noqa: UP045


class ColumnsAndConstraints(BaseModel):
    """
    Wrapper Model for columns and constraints
    """

    columns: Optional[List[Column]]  # noqa: UP006, UP045
    table_constraints: Optional[List[TableConstraint]]  # noqa: UP006, UP045


class TableConstraintsModel(BaseModel):
    """
    Wrapper Model for table constraints and primary key columns list
    """

    table_constraints: Optional[List[TableConstraint]] = None  # noqa: UP006, UP045
    pk_columns: List[str] = []  # noqa: UP006
