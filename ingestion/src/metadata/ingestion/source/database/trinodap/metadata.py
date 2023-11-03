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
Trino source implementation.
"""

import traceback

from typing import Iterable

from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema

from metadata.ingestion.source.database.trino.metadata import TrinoSource
from metadata.generated.schema.entity.services.connections.database.trinoDapConnection import (
    TrinoDapConnection,
)
from metadata.generated.schema.entity.services.connections.database.trinodapGenesisDatabasesTypes import (
    GenesisDatabaseType,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)

from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException

from metadata.utils import fqn

from metadata.utils.logger import ingestion_logger

from oauthlib.oauth2 import LegacyApplicationClient
from requests_oauthlib import OAuth2Session
from requests.adapters import HTTPAdapter, Retry

from metadata.utils.filters import filter_by_schema

logger = ingestion_logger()
ROW_DATA_TYPE = "row"
ARRAY_DATA_TYPE = "array"


class TrinodapSource(TrinoSource):
    """
    Trino does not support querying by table type: Getting views is not supported.
    """
    _genesis_allowed_dbs = []

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: TrinoDapConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, TrinoDapConnection):
            raise InvalidSourceException(
                f"Expected TrinoDapConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_oauth_session(self) -> OAuth2Session:

        oauth = OAuth2Session(client=LegacyApplicationClient(client_id=self.service_connection.oidcClientId))
        oauth.fetch_token(token_url=self.service_connection.oidcTokenEndpoint,
                          username=self.service_connection.genesisNpaUser,
                          password=self.service_connection.genesisNpaPassword.get_secret_value(),
                          client_id=self.service_connection.oidcClientId,
                          client_secret=self.service_connection.oidcClientSecret.get_secret_value()
                          )
        logger.info('OIDC session successfully established')

        # ToDo: confirm retry codes with genesis team
        # 429 Too Many Requests.
        # 500 Internal Server Error.
        # 502 Bad Gateway.
        # 503 Service Unavailable.
        # 504 Gateway Timeout.

        retries = Retry(total=5,
                        backoff_factor=1,
                        status_forcelist=[429, 500, 502, 503, 504])
        oauth.mount('http://', HTTPAdapter(max_retries=retries))
        oauth.mount('https://', HTTPAdapter(max_retries=retries))
        logger.info('OIDC session: Retry policy applied')

        return oauth

    def pull_genesis_entities(self, entity_type, limit=20):
        entity_type = entity_type.lower()
        oauth = self.get_oauth_session()

        i = 0
        while True:
            offset = limit * i
            params = {
                'matchString': None,
                'offset': offset,
                'limit': limit,
                'filterDeleted': True
            }

            url = f'{self.service_connection.genesisUrl}/{entity_type}'

            resp = oauth.get(url, params=params)
            resp_json = resp.json()
            logger.debug(f'genesis url : {url}')
            logger.debug(f'genesis response : {resp_json}')
            if not resp_json:
                oauth.close()
                break
            for entity in resp.json():
                logger.info(f'Adding genesis {entity_type[:-1]} {entity["name"]} to allow list ')
                self._genesis_allowed_dbs.append(entity['name'])
            i += 1

    def _generate_genesis_allowed_dbs(self):
        dbtype = self.service_connection.genesisDatabaseType
        if dbtype in (GenesisDatabaseType.DATASOURCES, GenesisDatabaseType.PROJECTS):
            self.pull_genesis_entities(dbtype.value)
        elif dbtype == GenesisDatabaseType.ALL:
            self.pull_genesis_entities(GenesisDatabaseType.DATASOURCES.value)
            self.pull_genesis_entities(GenesisDatabaseType.PROJECTS.value)
        else:
            raise Exception(f'Unsupported genesisDatabaseType: {dbtype}')

    def get_database_schema_names(self) -> Iterable[str]:

        self._generate_genesis_allowed_dbs()

        for schema in super().get_database_schema_names():
            try:
                schema_fqn = fqn.build(
                        self.metadata,
                        entity_type=DatabaseSchema,
                        service_name=self.context.database_service.name.__root__,
                        database_name=self.context.database.name.__root__,
                        schema_name=schema,
                    )
                if schema not in self._genesis_allowed_dbs:
                    logger.info(f'Filtered out : {schema_fqn}')
                    self.status.filter(schema_fqn, "Schema filtered out")
                    continue

                logger.info(f'Queued for metadata ingestion : {schema_fqn}')
                yield schema

            except Exception as exc:
                error = f"Unexpected exception to get database schema [{schema}]: {exc}"
                logger.debug(traceback.format_exc())
                logger.warning(error)
                self.status.failed(schema, error, traceback.format_exc())
