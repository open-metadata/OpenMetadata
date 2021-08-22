#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import logging
import os
from typing import List
import requests
from requests.exceptions import HTTPError
import time
from enum import Enum

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseEntityRequest
from metadata.generated.schema.api.data.createTable import CreateTableEntityRequest
from metadata.generated.schema.api.data.createTopic import CreateTopic

from metadata.generated.schema.api.services.createDatabaseService import CreateDatabaseServiceEntityRequest
from metadata.generated.schema.api.services.createMessagingService import CreateMessagingServiceEntityRequest
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.tags.tagCategory import Tag
from metadata.ingestion.models.table_queries import TableUsageRequest, ColumnJoinsList
from metadata.ingestion.ometa.auth_provider import MetadataServerConfig, AuthenticationProvider, \
    GoogleAuthenticationProvider, NoOpAuthenticationProvider, OktaAuthenticationProvider
from metadata.ingestion.ometa.credentials import URL, get_api_version
from metadata.generated.schema.entity.data.table import Table, TableJoins, TableData
from metadata.generated.schema.entity.data.database import Database

logger = logging.getLogger(__name__)
DatabaseServiceEntities = List[DatabaseService]
DatabaseEntities = List[Database]
TableEntities = List[Table]
Tags = List[Tag]
Topics = List[Topic]


class RetryException(Exception):
    pass


class APIError(Exception):
    """
    Represent API related error.
    error.status_code will have http status code.
    """

    def __init__(self, error, http_error=None):
        super().__init__(error['message'])
        self._error = error
        self._http_error = http_error

    @property
    def code(self):
        return self._error['code']

    @property
    def status_code(self):
        http_error = self._http_error
        if http_error is not None and hasattr(http_error, 'response'):
            return http_error.response.status_code

    @property
    def request(self):
        if self._http_error is not None:
            return self._http_error.request

    @property
    def response(self):
        if self._http_error is not None:
            return self._http_error.response


class TimeFrame(Enum):
    Day = "1Day"
    Hour = "1Hour"
    Minute = "1Min"
    Sec = "1Sec"


class REST(object):
    def __init__(self,
                 config: MetadataServerConfig,
                 raw_data: bool = False
                 ):
        """
        :param raw_data: should we return api response raw or wrap it with
                         Entity objects.
        """
        self.config = config
        self._base_url: URL = URL(self.config.api_endpoint)
        self._api_version = get_api_version(self.config.api_version)
        self._session = requests.Session()
        self._use_raw_data = raw_data
        self._retry = self.config.retry
        self._retry_wait = self.config.retry_wait
        self._retry_codes = [int(o) for o in os.environ.get(
            'OMETA_RETRY_CODES', '429,504').split(',')]
        auth_provider_type = self.config.auth_provider_type
        if self.config.auth_provider_type == "google":
            self._auth_provider: AuthenticationProvider = GoogleAuthenticationProvider.create(self.config)
        elif self.config.auth_provider_type == "okta":
            self._auth_provider: AuthenticationProvider = OktaAuthenticationProvider.create(self.config)
        else:
            self._auth_provider: AuthenticationProvider = NoOpAuthenticationProvider.create(self.config)

    def _request(self,
                 method,
                 path,
                 data=None,
                 base_url: URL = None,
                 api_version: str = None
                 ):
        base_url = base_url or self._base_url
        version = api_version if api_version else self._api_version
        url: URL = URL(base_url + '/' + version + path)
        headers = {'Content-type': 'application/json'}
        if self._auth_provider:
            headers[self.config.auth_header] = self._auth_provider.auth_token()

        opts = {
            'headers': headers,
            # Since we allow users to set endpoint URL via env var,
            # human error to put non-SSL endpoint could exploit
            # uncanny issues in non-GET request redirecting http->https.
            # It's better to fail early if the URL isn't right.
            'allow_redirects': False,
        }
        if method.upper() == 'GET':
            opts['params'] = data
        else:
            opts['data'] = data

        retry = self._retry
        if retry < 0:
            retry = 0
        while retry >= 0:
            try:
                logger.debug('URL {}, method {}'.format(url, method))
                logger.debug('Data {}'.format(opts))
                return self._one_request(method, url, opts, retry)
            except RetryException:
                retry_wait = self._retry_wait
                logger.warning(
                    'sleep {} seconds and retrying {} '
                    '{} more time(s)...'.format(
                        retry_wait, url, retry))
                time.sleep(retry_wait)
                retry -= 1
                continue

    def _one_request(self, method: str, url: URL, opts: dict, retry: int):
        """
        Perform one request, possibly raising RetryException in the case
        the response is 429. Otherwise, if error text contain "code" string,
        then it decodes to json object and returns APIError.
        Returns the body json in the 200 status.
        """
        retry_codes = self._retry_codes
        resp = self._session.request(method, url, **opts)
        try:
            resp.raise_for_status()
        except HTTPError as http_error:
            # retry if we hit Rate Limit
            if resp.status_code in retry_codes and retry > 0:
                raise RetryException()
            if 'code' in resp.text:
                error = resp.json()
                if 'code' in error:
                    raise APIError(error, http_error)
            else:
                raise
        if resp.text != '':
            return resp.json()
        return None

    def get(self, path, data=None):
        return self._request('GET', path, data)

    def post(self, path, data=None):
        return self._request('POST', path, data)

    def put(self, path, data=None):
        return self._request('PUT', path, data)

    def patch(self, path, data=None):
        return self._request('PATCH', path, data)

    def delete(self, path, data=None):
        return self._request('DELETE', path, data)

    def get_database_service(self, service_name: str) -> DatabaseService:
        """Get the Database service"""
        resp = self.get('/services/databaseServices?name={}'.format(service_name))
        return DatabaseService(**resp['data'][0]) if len(resp['data']) > 0 else None

    def get_database_service_by_id(self, service_id: str) -> DatabaseService:
        """Get the Database Service by ID"""
        resp = self.get('/services/databaseServices/{}'.format(service_id))
        return DatabaseService(**resp)

    def list_database_services(self) -> DatabaseServiceEntities:
        """Get a list of mysql services"""
        resp = self.get('/services/databaseServices')
        if self._use_raw_data:
            return resp
        else:
            return [DatabaseService(**p) for p in resp['data']]

    def create_database_service(self,
                                database_service: CreateDatabaseServiceEntityRequest) -> DatabaseService:
        """Create a new Database Service"""
        resp = self.post('/services/databaseServices', data=database_service.json())
        return DatabaseService(**resp)

    def delete_database_service(self, service_id: str) -> None:
        """Delete a Database service"""
        self.delete('/services/databaseServices/{}'.format(service_id))

    def get_database_by_name(self, database_name: str, fields: [] = ['service']) -> Database:
        """Get the Database"""
        params = {}
        params['fields'] = ",".join(fields)
        resp = self.get('/databases/name/{}'.format(database_name), data=params)
        return Database(**resp)

    def list_databases(self, fields: [] = ['service']) -> DatabaseEntities:
        """ List all databases"""
        url = '/databases'
        params = {}
        params['fields'] = ",".join(fields)
        resp = self.get('/databases', data=params)
        if self._use_raw_data:
            return resp
        else:
            return [Database(**d) for d in resp['data']]

    def get_database_by_id(self, database_id: str,
                           fields: [] = ['owner,service,tables,usageSummary']) -> Database:
        """ Get Database By ID """
        params = {}
        params['fields'] = ",".join(fields)
        resp = self.get('/databases/{}'.format(database_id), data=params)
        return Database(**resp)

    def create_database(self, create_database_request: CreateDatabaseEntityRequest) -> Database:
        """ Create a Database """
        resp = self.put('/databases', data=create_database_request.json())
        return Database(**resp)

    def delete_database(self, database_id: str):
        """ Delete Database using ID """
        self.delete('/databases/{}'.format(database_id))

    def list_tables(self, fields: str = None, offset: int = 0, limit: int = 1000000) -> TableEntities:
        """ List all tables"""

        if fields is None:
            resp = self.get('/tables')
        else:
            resp = self.get('/tables?fields={}&offset={}&limit={}'.format(fields, offset, limit))
        if self._use_raw_data:
            return resp
        else:
            return [Table(**t) for t in resp['data']]

    def ingest_sample_data(self, id, sample_data):
        resp = self.put('/tables/{}/sampleData'.format(id.__root__), data=sample_data.json())
        return TableData(**resp['sampleData'])

    def get_table_by_id(self, table_id: str, fields: [] = ['columns']) -> Table:
        """Get Table By ID"""
        params = {}
        params['fields'] = ",".join(fields)
        resp = self.get('/tables/{}'.format(table_id), data=params)
        return Table(**resp)

    def create_or_update_table(self, create_table_request: CreateTableEntityRequest) -> Table:
        """Create or Update a Table """
        resp = self.put('/tables', data=create_table_request.json())
        resp.pop("database", None)
        return Table(**resp)

    def get_table_by_name(self, table_name: str, fields: [] = ['columns']) -> Table:
        """Get Table By Name"""
        params = {}
        params['fields'] = ",".join(fields)
        resp = self.get('/tables/name/{}'.format(table_name), data=params)
        return Table(**resp)

    def publish_usage_for_a_table(self, table: Table, table_usage_request: TableUsageRequest) -> None:
        """publish usage details for a table"""
        resp = self.post('/usage/table/{}'.format(table.id.__root__), data=table_usage_request.json())
        logger.debug("published table usage {}".format(resp))

    def publish_frequently_joined_with(self, table: Table, table_join_request: TableJoins) -> None:
        """publish frequently joined with for a table"""
        logger.debug(table_join_request.json())
        logger.info("table join request {}".format(table_join_request.json()))
        resp = self.put('/tables/{}/joins'.format(table.id.__root__), data=table_join_request.json())
        logger.debug("published frequently joined with {}".format(resp))

    def list_tags_by_category(self, category: str) -> {}:
        """List all tags"""
        resp = self.get('/tags/{}'.format(category))
        return [Tag(**d) for d in resp['children']]

    def compute_percentile(self, entity_type: str, date: str):
        resp = self.post('/usage/compute.percentile/{}/{}'.format(entity_type, date))
        logger.debug("published compute percentile {}".format(resp))

    def get_messaging_service(self, service_name: str) -> MessagingService:
        """Get the Messaging service"""
        resp = self.get('/services/messagingServices?name={}'.format(service_name))
        return MessagingService(**resp['data'][0]) if len(resp['data']) > 0 else None

    def get_messaging_service_by_id(self, service_id: str) -> MessagingService:
        """Get the Messaging Service by ID"""
        resp = self.get('/services/messagingServices/{}'.format(service_id))
        return MessagingService(**resp)

    def create_messaging_service(self,
                                 messaging_service: CreateMessagingServiceEntityRequest) -> MessagingService:
        """Create a new Database Service"""
        resp = self.post('/services/messagingServices', data=messaging_service.json())
        return MessagingService(**resp)

    def create_or_update_topic(self, create_topic_request: CreateTopic) -> Topic:
        """Create or Update a Table """
        resp = self.put('/topics', data=create_topic_request.json())
        return Topic(**resp)

    def list_topics(self, fields: str = None, offset: int = 0, limit: int = 1000000) -> Topics:
        """ List all topics"""

        if fields is None:
            resp = self.get('/topics')
        else:
            resp = self.get('/topics?fields={}&offset={}&limit={}'.format(fields, offset, limit))
        if self._use_raw_data:
            return resp
        else:
            return [Topic(**t) for t in resp['data']]

    def __enter__(self):
        return self

    def close(self):
        self._session.close()

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
