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
from typing import Type

from metadata.config.common import FQDN_SEPARATOR
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import DataModel, Table
from metadata.generated.schema.entity.tags.tagCategory import Tag

from .fqdn_registry import T, fqdn_build_registry


def replace_none(*args):
    for arg in args:
        if arg is None:
            yield ""
        else:
            yield arg


def get_fqdn(entity_type: Type[T], *args, **kwargs):
    fn = fqdn_build_registry.registry.get(entity_type.__name__)
    if not fn:
        raise ValueError("Invalid Type")
    return fn(*args, **kwargs)


@fqdn_build_registry.add(Table)
def _(service_name="", database_name="", schema_name="", table_name=""):
    return FQDN_SEPARATOR.join(
        replace_none(service_name, database_name, schema_name, table_name)
    )


@fqdn_build_registry.add(DatabaseSchema)
def _(service_name="", database_name="", schema_name=""):
    return FQDN_SEPARATOR.join(replace_none(service_name, database_name, schema_name))


@fqdn_build_registry.add(Database)
def _(service_name="", database_name=""):
    return FQDN_SEPARATOR.join(replace_none(service_name, database_name))


@fqdn_build_registry.add(Dashboard)
def _(service_name="", dashboard_name=""):
    return FQDN_SEPARATOR.join(replace_none(service_name, dashboard_name))


@fqdn_build_registry.add(Tag)
def _(tag_category="", tag_name=""):
    return FQDN_SEPARATOR.join(replace_none(tag_category, tag_name))


@fqdn_build_registry.add(DataModel)
def _(schema_name="", model_name=""):
    return FQDN_SEPARATOR.join(replace_none(schema_name, model_name))


@fqdn_build_registry.add(AddLineageRequest)
def _(service_name="", database_name="", schema_and_table_name=""):
    return FQDN_SEPARATOR.join(
        replace_none(service_name, database_name, schema_and_table_name)
    )
