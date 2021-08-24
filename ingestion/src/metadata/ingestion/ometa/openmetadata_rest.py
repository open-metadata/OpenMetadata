import logging
from typing import List

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseEntityRequest
from metadata.generated.schema.api.data.createTable import CreateTableEntityRequest
from metadata.generated.schema.api.data.createTopic import CreateTopic
from metadata.generated.schema.api.services.createDatabaseService import CreateDatabaseServiceEntityRequest
from metadata.generated.schema.api.services.createMessagingService import CreateMessagingServiceEntityRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Table, TableData, TableJoins
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.tags.tagCategory import Tag
from metadata.ingestion.models.table_queries import TableUsageRequest
from metadata.ingestion.ometa.auth_provider import MetadataServerConfig, AuthenticationProvider, \
    GoogleAuthenticationProvider, OktaAuthenticationProvider, NoOpAuthenticationProvider
from metadata.ingestion.ometa.client import REST

logger = logging.getLogger(__name__)
DatabaseServiceEntities = List[DatabaseService]
DatabaseEntities = List[Database]
TableEntities = List[Table]
Tags = List[Tag]
Topics = List[Topic]


class OpenMetadataAPIClient(object):
    client: REST

    def __init__(self,
                 config: MetadataServerConfig,
                 raw_data: bool = False
                 ):
        self.config = config
        if self.config.auth_provider_type == "google":
            self._auth_provider: AuthenticationProvider = GoogleAuthenticationProvider.create(self.config)
        elif self.config.auth_provider_type == "okta":
            self._auth_provider: AuthenticationProvider = OktaAuthenticationProvider.create(self.config)
        else:
            self._auth_provider: AuthenticationProvider = NoOpAuthenticationProvider.create(self.config)
        self.client = REST(config, raw_data, self._auth_provider.auth_token())
        self._use_raw_data = raw_data

    def get_database_service(self, service_name: str) -> DatabaseService:
        """Get the Database service"""
        resp = self.client.get('/services/databaseServices?name={}'.format(service_name))
        return DatabaseService(**resp['data'][0]) if len(resp['data']) > 0 else None

    def get_database_service_by_id(self, service_id: str) -> DatabaseService:
        """Get the Database Service by ID"""
        resp = self.client.get('/services/databaseServices/{}'.format(service_id))
        return DatabaseService(**resp)

    def list_database_services(self) -> DatabaseServiceEntities:
        """Get a list of mysql services"""
        resp = self.client.get('/services/databaseServices')
        if self._use_raw_data:
            return resp
        else:
            return [DatabaseService(**p) for p in resp['data']]

    def create_database_service(self,
                                database_service: CreateDatabaseServiceEntityRequest) -> DatabaseService:
        """Create a new Database Service"""
        resp = self.client.post('/services/databaseServices', data=database_service.json())
        return DatabaseService(**resp)

    def delete_database_service(self, service_id: str) -> None:
        """Delete a Database service"""
        self.client.delete('/services/databaseServices/{}'.format(service_id))

    def get_database_by_name(self, database_name: str, fields: [] = ['service']) -> Database:
        """Get the Database"""
        params = {'fields': ",".join(fields)}
        resp = self.client.get('/databases/name/{}'.format(database_name), data=params)
        return Database(**resp)

    def list_databases(self, fields: [] = ['service']) -> DatabaseEntities:
        """ List all databases"""
        params = {'fields': ",".join(fields)}
        resp = self.client.get('/databases', data=params)
        if self._use_raw_data:
            return resp
        else:
            return [Database(**d) for d in resp['data']]

    def get_database_by_id(self, database_id: str,
                           fields: [] = ['owner,service,tables,usageSummary']) -> Database:
        """ Get Database By ID """
        params = {'fields': ",".join(fields)}
        resp = self.client.get('/databases/{}'.format(database_id), data=params)
        return Database(**resp)

    def create_database(self, create_database_request: CreateDatabaseEntityRequest) -> Database:
        """ Create a Database """
        resp = self.client.put('/databases', data=create_database_request.json())
        return Database(**resp)

    def delete_database(self, database_id: str):
        """ Delete Database using ID """
        self.client.delete('/databases/{}'.format(database_id))

    def list_tables(self, fields: str = None, offset: int = 0, limit: int = 1000000) -> TableEntities:
        """ List all tables"""

        if fields is None:
            resp = self.client.get('/tables')
        else:
            resp = self.client.get('/tables?fields={}&offset={}&limit={}'.format(fields, offset, limit))
        if self._use_raw_data:
            return resp
        else:
            return [Table(**t) for t in resp['data']]

    def ingest_sample_data(self, id, sample_data):
        resp = self.client.put('/tables/{}/sampleData'.format(id.__root__), data=sample_data.json())
        return TableData(**resp['sampleData'])

    def get_table_by_id(self, table_id: str, fields: [] = ['columns']) -> Table:
        """Get Table By ID"""
        params = {'fields': ",".join(fields)}
        resp = self.client.get('/tables/{}'.format(table_id), data=params)
        return Table(**resp)

    def create_or_update_table(self, create_table_request: CreateTableEntityRequest) -> Table:
        """Create or Update a Table """
        resp = self.client.put('/tables', data=create_table_request.json())
        resp.pop("database", None)
        return Table(**resp)

    def get_table_by_name(self, table_name: str, fields: [] = ['columns']) -> Table:
        """Get Table By Name"""
        params = {'fields': ",".join(fields)}
        resp = self.client.get('/tables/name/{}'.format(table_name), data=params)
        return Table(**resp)

    def publish_usage_for_a_table(self, table: Table, table_usage_request: TableUsageRequest) -> None:
        """publish usage details for a table"""
        resp = self.client.post('/usage/table/{}'.format(table.id.__root__), data=table_usage_request.json())
        logger.debug("published table usage {}".format(resp))

    def publish_frequently_joined_with(self, table: Table, table_join_request: TableJoins) -> None:
        """publish frequently joined with for a table"""
        logger.debug(table_join_request.json())
        logger.info("table join request {}".format(table_join_request.json()))
        resp = self.client.put('/tables/{}/joins'.format(table.id.__root__), data=table_join_request.json())
        logger.debug("published frequently joined with {}".format(resp))

    def list_tags_by_category(self, category: str) -> {}:
        """List all tags"""
        resp = self.client.get('/tags/{}'.format(category))
        return [Tag(**d) for d in resp['children']]

    def compute_percentile(self, entity_type: str, date: str):
        resp = self.client.post('/usage/compute.percentile/{}/{}'.format(entity_type, date))
        logger.debug("published compute percentile {}".format(resp))

    def get_messaging_service(self, service_name: str) -> MessagingService:
        """Get the Messaging service"""
        resp = self.client.get('/services/messagingServices?name={}'.format(service_name))
        return MessagingService(**resp['data'][0]) if len(resp['data']) > 0 else None

    def get_messaging_service_by_id(self, service_id: str) -> MessagingService:
        """Get the Messaging Service by ID"""
        resp = self.client.get('/services/messagingServices/{}'.format(service_id))
        return MessagingService(**resp)

    def create_messaging_service(self,
                                 messaging_service: CreateMessagingServiceEntityRequest) -> MessagingService:
        """Create a new Database Service"""
        resp = self.client.post('/services/messagingServices', data=messaging_service.json())
        return MessagingService(**resp)

    def create_or_update_topic(self, create_topic_request: CreateTopic) -> Topic:
        """Create or Update a Table """
        resp = self.client.put('/topics', data=create_topic_request.json())
        return Topic(**resp)

    def list_topics(self, fields: str = None, offset: int = 0, limit: int = 1000000) -> Topics:
        """ List all topics"""

        if fields is None:
            resp = self.client.get('/topics')
        else:
            resp = self.client.get('/topics?fields={}&offset={}&limit={}'.format(fields, offset, limit))
        if self._use_raw_data:
            return resp
        else:
            return [Topic(**t) for t in resp['data']]

    def close(self):
        self.client.close()
