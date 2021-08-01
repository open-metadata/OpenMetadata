from datetime import datetime, timedelta

from metadata.generated.schema.api.services.createDatabaseService import CreateDatabaseServiceEntityRequest
from metadata.generated.schema.entity.services.databaseService import DatabaseServiceEntity
from metadata.ingestion.ometa.client import REST


def get_start_and_end(duration):
    today = datetime.utcnow()
    start = (today + timedelta(0-duration)).replace(hour=0, minute=0, second=0, microsecond=0)
    end = (today + timedelta(3)).replace(hour=0, minute=0, second=0, microsecond=0)
    return start, end


def snake_to_camel(s):
    a = s.split('_')
    a[0] = a[0].capitalize()
    if len(a) > 1:
        a[1:] = [u.title() for u in a[1:]]
    return ''.join(a)


def get_service_or_create(config, metadata_config) -> DatabaseServiceEntity:
    client = REST(metadata_config)
    service = client.get_database_service(config.service_name)
    if service is not None:
        return service
    else:
        service = {'jdbc': {'connectionUrl': config.get_sql_alchemy_url(), 'driverClass': 'jdbc'},
                   'name': config.service_name, 'description': '', 'serviceType': config.get_service_type()}
        created_service = client.create_database_service(CreateDatabaseServiceEntityRequest(**service))
        return created_service
