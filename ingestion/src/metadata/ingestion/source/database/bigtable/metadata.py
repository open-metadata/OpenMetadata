#  Copyright 2024 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
import traceback
from typing import Dict, List, Optional, Union, Iterable, Tuple

from google.cloud.bigtable import row_filters
from google.cloud.bigtable.instance import Instance
from google.cloud.bigtable.table import Table

from metadata.generated.schema.entity.data.table import (
    TableType,
    TableConstraint,
    ConstraintType,
)
from metadata.generated.schema.entity.services.connections.database.bigTableConnection import (
    BigTableConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.bigtable.client import MultiProjectClient
from metadata.ingestion.source.database.bigtable.models import Row
from metadata.ingestion.source.database.common_nosql_source import (
    CommonNoSQLSource,
    SAMPLE_SIZE as GLOBAL_SAMPLE_SIZE,
)
from metadata.ingestion.source.database.multi_db_source import MultiDBSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

MAX_COLUMN_FAMILIES = 100
TABLE_SAMPLE_SIZE = 100


class BigtableSource(CommonNoSQLSource, MultiDBSource):
    """
    Implements the necessary methods to extract database metadata from Google BigTable Source.
    BigTable is a NoSQL database service for handling large amounts of data. Tha mapping is as follows:
      project -> instance -> table -> column_family.column
      (database) (schema)
    For more infor about BigTable: https://cloud.google.com/bigtable/?hl=en
    All data types are registered as bytes.
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.client: MultiProjectClient = self.connection_obj

        # ths instances and tables are cached to avoid making redundant requests to the API.
        self.instances: Dict[str, Tuple[Instance]] = {}
        self.tables: Dict[str, Dict[str, Tuple[Table]]] = {}

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: BigTableConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, BigTableConnection):
            raise InvalidSourceException(
                f"Expected BigTableConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_configured_database(self) -> Optional[str]:
        return None

    def get_database_names(self) -> Iterable[str]:
        return self.get_database_names_raw()

    def get_database_names_raw(self) -> Iterable[str]:
        yield from self.client.project_ids()

    def get_schema_name_list(self) -> List[str]:
        project_id = self.context.database
        try:
            # the first element is a list of instances
            # the second element is another collection (seems empty) and I do not know what is its purpose
            instances, _ = self.client.list_instances(project_id=project_id)
            self.instances[project_id] = tuple(instances)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Failed to list BigTable instances in project {project_id}: {err}"
            )
            raise
        return [instance.instance_id for instance in self.instances[project_id]]

    def get_table_name_list(self, schema_name: str) -> List[str]:
        project_id = self.context.database
        try:
            instance = [
                i for i in self.instances[project_id] if i.instance_id == schema_name
            ][0]
            tables = instance.list_tables()
            self._set_nested(self.tables, [project_id, instance.instance_id], tables)
            return [t.table_id for t in self.tables[project_id][instance.instance_id]]
        except Exception as err:
            logger.debug(traceback.format_exc())
            # add context to the error message
            logger.error(
                f"Failed to list BigTable table names in {project_id}.{schema_name}: {err}"
            )
        return []

    def get_table_constraints(
        self, db_name: str, schema_name: str, table_name: str
    ) -> List[TableConstraint]:
        return [
            TableConstraint(
                constraintType=ConstraintType.PRIMARY_KEY, columns=["row_key"]
            )
        ]

    def get_table_columns_dict(
        self, schema_name: str, table_name: str
    ) -> Union[List[Dict], Dict]:
        project_id = self.context.database
        try:
            table = self._find_table(project_id, schema_name, table_name)
            if table is None:
                raise RuntimeError(
                    f"Table {project_id}/{schema_name}/{table_name} not found."
                )
            column_families = table.list_column_families()
            records = [{"row_key": b"row_key"}]
            for cf in list(column_families.keys())[:MAX_COLUMN_FAMILIES]:
                records.extend(
                    self._get_records_for_column_family(table, cf, TABLE_SAMPLE_SIZE)
                )
                if len(records) >= GLOBAL_SAMPLE_SIZE:
                    break
            return records
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to read BigTable rows for [{schema_name}.{table_name}]: {err}"
            )
        return []

    def get_source_url(
        self,
        database_name: Optional[str] = None,
        schema_name: Optional[str] = None,
        table_name: Optional[str] = None,
        table_type: Optional[TableType] = None,
    ) -> Optional[str]:
        """
        Method to get the source url for a BigTable table
        """
        try:
            if schema_name and table_name:
                return f"https://console.cloud.google.com/bigtable/instances/{schema_name}/tables/{table_name}/overview?project={database_name}"
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get source url: {exc}")
        return None

    @staticmethod
    def _set_nested(dct: dict, keys: List[str], value: any) -> None:
        for key in keys[:-1]:
            dct = dct.setdefault(key, {})
        dct[keys[-1]] = value

    @staticmethod
    def _get_records_for_column_family(
        table: Table, column_family: str, limit: int
    ) -> List[Dict]:
        filter_ = row_filters.ColumnRangeFilter(column_family_id=column_family)
        rows = table.read_rows(limit=limit, filter_=filter_)
        return [Row.from_partial_row(row).to_record() for row in rows]

    def _find_table(
        self, project_id: str, schema_name: str, table_name: str
    ) -> Optional[Table]:
        try:
            return [
                t
                for t in self.tables[project_id][schema_name]
                if t.table_id == table_name
            ][0]
        except IndexError:
            return None
