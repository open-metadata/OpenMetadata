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
Test that SQASampler truncates oversized cell values during fetch_sample_data.
"""
import os
from unittest.mock import patch
from uuid import uuid4

from sqlalchemy import TEXT, Column, Integer, String
from sqlalchemy.orm import declarative_base

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
    SQLiteScheme,
)
from metadata.sampler.models import SampleConfig
from metadata.sampler.sqlalchemy.sampler import SQASampler
from metadata.utils.constants import SAMPLE_DATA_MAX_CELL_LENGTH

Base = declarative_base()


class HugeTextTable(Base):
    __tablename__ = "huge_text"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    body = Column(TEXT)


class TestSQASamplerTruncation:
    """Verify that fetch_sample_data truncates values that exceed SAMPLE_DATA_MAX_CELL_LENGTH."""

    db_path = os.path.join(
        os.path.dirname(__file__), f"{os.path.splitext(__file__)[0]}.db"
    )
    sqlite_conn = SQLiteConnection(
        scheme=SQLiteScheme.sqlite_pysqlite,
        databaseMode=db_path + "?check_same_thread=False",
    )

    table_entity = Table(
        id=uuid4(),
        name="huge_text",
        columns=[
            EntityColumn(name=ColumnName("id"), dataType=DataType.INT),
            EntityColumn(name=ColumnName("name"), dataType=DataType.STRING),
            EntityColumn(name=ColumnName("body"), dataType=DataType.STRING),
        ],
    )

    @classmethod
    def setup_class(cls):
        with patch.object(SQASampler, "build_table_orm", return_value=HugeTextTable):
            cls.sampler = SQASampler(
                service_connection_config=cls.sqlite_conn,
                ometa_client=None,
                entity=None,
            )
        engine = cls.sampler.session_factory().get_bind()
        HugeTextTable.__table__.create(bind=engine)

        oversized = "x" * (SAMPLE_DATA_MAX_CELL_LENGTH + 50_000)
        at_limit = "y" * SAMPLE_DATA_MAX_CELL_LENGTH
        small = "z" * 100

        with cls.sampler.session_factory() as session:
            session.add_all(
                [
                    HugeTextTable(name="oversized", body=oversized),
                    HugeTextTable(name="at_limit", body=at_limit),
                    HugeTextTable(name="small", body=small),
                    HugeTextTable(name="null_body", body=None),
                ]
            )
            session.commit()

    @classmethod
    def teardown_class(cls):
        cls.sampler.close()
        if os.path.exists(cls.db_path):
            os.remove(cls.db_path)

    def test_fetch_sample_data_truncates_oversized_cells(self):
        sample_data = self.sampler.fetch_sample_data()

        for row in sample_data.rows:
            for cell in row:
                if isinstance(cell, str):
                    assert len(cell) <= SAMPLE_DATA_MAX_CELL_LENGTH

    def test_oversized_body_is_truncated_to_limit(self):
        sample_data = self.sampler.fetch_sample_data()

        body_idx = next(
            i
            for i, col in enumerate(sample_data.columns)
            if str(col.root) == "body"
        )
        oversized_row = next(
            row
            for row in sample_data.rows
            if row[1] == "oversized"
        )
        assert len(oversized_row[body_idx]) == SAMPLE_DATA_MAX_CELL_LENGTH

    def test_value_at_limit_is_not_truncated(self):
        sample_data = self.sampler.fetch_sample_data()

        body_idx = next(
            i
            for i, col in enumerate(sample_data.columns)
            if str(col.root) == "body"
        )
        at_limit_row = next(
            row for row in sample_data.rows if row[1] == "at_limit"
        )
        assert len(at_limit_row[body_idx]) == SAMPLE_DATA_MAX_CELL_LENGTH

    def test_small_value_is_unchanged(self):
        sample_data = self.sampler.fetch_sample_data()

        body_idx = next(
            i
            for i, col in enumerate(sample_data.columns)
            if str(col.root) == "body"
        )
        small_row = next(
            row for row in sample_data.rows if row[1] == "small"
        )
        assert small_row[body_idx] == "z" * 100

    def test_null_value_is_preserved(self):
        sample_data = self.sampler.fetch_sample_data()

        body_idx = next(
            i
            for i, col in enumerate(sample_data.columns)
            if str(col.root) == "body"
        )
        null_row = next(
            row for row in sample_data.rows if row[1] == "null_body"
        )
        assert null_row[body_idx] is None

    def test_user_query_truncates_oversized_cells(self):
        with patch.object(SQASampler, "build_table_orm", return_value=HugeTextTable):
            sampler = SQASampler(
                service_connection_config=self.sqlite_conn,
                ometa_client=None,
                entity=None,
                sample_query="SELECT id, name, body FROM huge_text",
            )
        sample_data = sampler.fetch_sample_data()

        for row in sample_data.rows:
            for cell in row:
                if isinstance(cell, str):
                    assert len(cell) <= SAMPLE_DATA_MAX_CELL_LENGTH
