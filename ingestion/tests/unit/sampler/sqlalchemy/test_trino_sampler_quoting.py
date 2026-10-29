#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""The Trino sampler escapes reflected column names in its is_nan() predicate."""

from sqlalchemy import FLOAT, Column, Integer, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from metadata.sampler.sqlalchemy.trino.sampler import TrinoSampler


class Base(DeclarativeBase):
    pass


class _HostileTable(Base):
    __tablename__ = "t"
    id = Column(Integer, primary_key=True)
    hostile = Column('ev"il', FLOAT)


def test_is_nan_predicate_escapes_double_quotes():
    sampler = TrinoSampler.__new__(TrinoSampler)
    sampler._table = _HostileTable
    sampler.session_factory = sessionmaker(bind=create_engine("trino://user@localhost:8080/catalog"))

    query = sampler._base_sample_query(None, _HostileTable.id)

    # Trino doubles a double quote inside a quoted identifier.
    assert str(query.whereclause) == 'is_nan("ev""il") = False'
