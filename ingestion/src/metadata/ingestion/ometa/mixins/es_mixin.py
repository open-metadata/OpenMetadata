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
Mixin class containing Lineage specific methods

To be used by OpenMetadata class
"""
from logging.config import DictConfigurator
from typing import Generic, TypeVar

from pydantic import BaseModel

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import ometa_logger

logger = ometa_logger()


# Prevent sqllineage from modifying the logger config
def configure(self):
    pass


DictConfigurator.configure = configure

T = TypeVar("T", bound=BaseModel)  # pylint: disable=invalid-name


class ESMixin(Generic[T]):
    client: REST

    es_url: str = "/search/query?q=service:{} AND {}&from={}&size={}&index={}"

    def search_entities_using_es(
        self, service_name, table_obj, search_index, from_count: int = 0, size: int = 10
    ):
        generate_es_string = " AND ".join(
            [
                "%s:%s" % (key, value)
                for (key, value) in table_obj.items()
                if value is not None
            ]
        )
        multiple_entities = []
        try:
            resp_es = self.client.get(
                self.es_url.format(
                    service_name, generate_es_string, from_count, size, search_index
                )
            )

            if resp_es:
                for table_hit in resp_es["hits"]["hits"]:
                    multiple_entities.append(
                        self.get_by_name(
                            entity=Table, fqdn=table_hit["_source"]["fqdn"]
                        )
                    )
        except Exception as err:
            logger.warning(f"Elasticsearch failed for query: {generate_es_string}")
        return multiple_entities
