-- The built-in OpenMetadata metadata service stores only non-sensitive server-connection metadata.
-- Scrub the Elasticsearch sink and the ingestion-bot JWT from any existing row: ingestion builds its
-- own securityConfig on the fly and reindexing reads the ES config from the application config, so
-- nothing reads these.
UPDATE metadata_service_entity
SET json = (json #- '{connection,config,elasticsSearch}') #- '{connection,config,securityConfig}'
WHERE name = 'OpenMetadata'
  AND (json #> '{connection,config,elasticsSearch}' IS NOT NULL
       OR json #> '{connection,config,securityConfig}' IS NOT NULL);

-- Also scrub the service's version history: older versions stored in entity_extension still carry
-- the full connection (the Elasticsearch sink and the ingestion-bot JWT), reachable via the
-- versions API and in DB backups.
UPDATE entity_extension
SET json = (json #- '{connection,config,elasticsSearch}') #- '{connection,config,securityConfig}'
WHERE id = (SELECT id FROM metadata_service_entity WHERE name = 'OpenMetadata')
  AND extension LIKE 'metadataService.version.%';
