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

"""A MySQL foreign key whose referenced column differs in case from the parent column
(`REFERENCES parent (id)` while the column is `Id`) must not get the table rejected."""

import pytest
from sqlalchemy import create_engine, text

from metadata.generated.schema.entity.data.table import (
    ConstraintType,
    RelationshipType,
    Table,
)
from metadata.ingestion.ometa.utils import model_str
from metadata.workflow.metadata import MetadataWorkflow


@pytest.fixture(scope="module")
def mysql_engine(mysql_container):
    engine = create_engine(mysql_container.get_connection_url())
    yield engine
    engine.dispose()


@pytest.fixture()
def child_with_lowercase_referred_column(mysql_engine):
    # MySQL rewrites the referenced column to the parent's casing when the parent exists.
    # Created before the parent with FK checks off, the FK keeps `id` as written.
    with mysql_engine.connect() as conn:
        conn.execute(text("SET foreign_key_checks = 0"))
        conn.execute(
            text(
                "CREATE TABLE employees.fk_case_child ("
                "  Id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,"
                "  Reason TINYINT NOT NULL,"
                "  KEY fk_reason (Reason),"
                "  CONSTRAINT fk_case_child_ibfk_1 FOREIGN KEY (Reason) REFERENCES fk_case_parent (id)"
                ")"
            )
        )
        conn.execute(text("CREATE TABLE employees.fk_case_parent (Id TINYINT NOT NULL PRIMARY KEY, Name VARCHAR(100))"))
        conn.execute(text("SET foreign_key_checks = 1"))
        child_ddl = conn.execute(text("SHOW CREATE TABLE employees.fk_case_child")).one()[1]
        conn.commit()
    assert "REFERENCES `fk_case_parent` (`id`)" in child_ddl
    yield
    with mysql_engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS employees.fk_case_child, employees.fk_case_parent"))
        conn.commit()


def test_foreign_key_uses_stored_casing_of_referred_column(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    metadata,
    db_service,
    child_with_lowercase_referred_column,
):
    # On a new service the parent may not be in OpenMetadata yet when the child is processed,
    # which defers the FK to the end of the run. The second run sends it inline with the child
    # table: the request the server used to reject with `Invalid column name id`.
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(MetadataWorkflow, ingestion_config)

    schema_fqn = f"{db_service.fullyQualifiedName.root}.default.employees"
    child = metadata.get_by_name(entity=Table, fqn=f"{schema_fqn}.fk_case_child", fields=["tableConstraints"])
    foreign_keys = [c for c in child.tableConstraints or [] if c.constraintType == ConstraintType.FOREIGN_KEY]
    assert [[model_str(column) for column in fk.referredColumns] for fk in foreign_keys] == [
        [f"{schema_fqn}.fk_case_parent.Id"]
    ]
    assert foreign_keys[0].relationshipType == RelationshipType.MANY_TO_ONE
