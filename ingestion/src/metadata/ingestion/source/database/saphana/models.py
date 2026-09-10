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
SAP Hana lineage module
"""

from enum import Enum
from typing import Annotated

from pydantic import Field, computed_field

from metadata.generated.schema.entity.data.storedProcedure import StoredProcedureType
from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn

SYS_BIC_SCHEMA_NAME = "_SYS_BIC"


class ViewType(Enum):
    """Supported SAP Hana Views"""

    CALCULATION_VIEW = "calculationview"
    ANALYTIC_VIEW = "analyticview"
    ATTRIBUTE_VIEW = "attributeview"
    # Artificially set to define calculationView internal models. This won't come from the ACTIVE_OBJECT table
    LOGICAL = "logical"
    DATA_BASE_TABLE = "table"
    TABLE_FUNCTION = "TABLE_FUNCTION"


class SapHanaLineageModel(BaseModel):
    """SAP Hana Lineage model from _SYS_REPO.ACTIVE_OBJECT"""

    package_id: Annotated[str, Field(..., description="Package ID that hosts the model code")]
    object_name: Annotated[str, Field(..., description="View Name")]
    object_suffix: Annotated[ViewType, Field(..., description="View Type")]
    cdata: Annotated[str, Field(..., description="XML representation of the model")]

    @computed_field
    @property
    def name(self) -> str:
        """
        Actual name representation of the view in _SYS_BIC.VIEWS.
        This is the name in OpenMetadata
        """
        return f"{self.package_id}/{self.object_name}"

    def get_fqn(self, metadata: OpenMetadata, service_name: str) -> str:
        """Build OM's FQN with the static schema name from _SYS_BIC"""
        return fqn.build(
            metadata,
            entity_type=Table,
            service_name=service_name,
            database_name=None,
            schema_name=SYS_BIC_SCHEMA_NAME,
            table_name=self.name,
        )


class SapHanaStoredProcedure(BaseModel):
    """SAP HANA stored procedure list query results"""

    name: str = Field(..., alias="function_name")
    schema_name: str = Field(...)
    definition: str | None = Field(None)
    procedure_type: str = Field(default=StoredProcedureType.Function.value)


class SapHanaObjectDependency(BaseModel):
    """One direct dependency row from SYS.OBJECT_DEPENDENCIES.

    Unlike SapHanaLineageModel, which describes a repository artifact parsed out of
    CDATA XML, this is a plain object-to-object edge that HANA itself recorded. Both
    endpoints are TABLE or VIEW, which map to the same OpenMetadata Table entity.
    """

    base_schema_name: Annotated[str, Field(..., description="Schema of the upstream object")]
    base_object_name: Annotated[str, Field(..., description="Name of the upstream object")]
    base_object_type: Annotated[str, Field(..., description="TABLE or VIEW")]
    dependent_schema_name: Annotated[str, Field(..., description="Schema of the downstream object")]
    dependent_object_name: Annotated[str, Field(..., description="Name of the downstream object")]
    dependent_object_type: Annotated[str, Field(..., description="TABLE or VIEW")]

    def get_base_fqn(self, metadata: OpenMetadata, service_name: str) -> str | None:
        """FQN of the upstream object"""
        return self._build_fqn(metadata, service_name, self.base_schema_name, self.base_object_name)

    def get_dependent_fqn(self, metadata: OpenMetadata, service_name: str) -> str | None:
        """FQN of the downstream object"""
        return self._build_fqn(metadata, service_name, self.dependent_schema_name, self.dependent_object_name)

    @staticmethod
    def _build_fqn(metadata: OpenMetadata, service_name: str, schema_name: str, object_name: str) -> str | None:
        """Resolve the database via ES, since OBJECT_DEPENDENCIES only reports schema and name"""
        return fqn.build(
            metadata,
            entity_type=Table,
            service_name=service_name,
            database_name=None,
            schema_name=schema_name,
            table_name=object_name,
        )
