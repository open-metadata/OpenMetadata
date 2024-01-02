
-- fixed Query for updating viewParsingTimeoutLimit
UPDATE ingestion_pipeline_entity
SET json = jsonb_set(
  json::jsonb #- '{sourceConfig,config,viewParsingTimeoutLimit}',
  '{sourceConfig,config,queryParsingTimeoutLimit}',
  (json #> '{sourceConfig,config,viewParsingTimeoutLimit}')::jsonb,
  true
)
WHERE json #>> '{pipelineType}' = 'metadata'
AND json #>> '{sourceConfig,config,type}' = 'DatabaseMetadata'
AND json #>> '{sourceConfig,config,viewParsingTimeoutLimit}' is not null;



-- update service type to UnityCatalog - update database entity
UPDATE database_entity de
SET json = jsonb_set(
    json #- '{serviceType}',
    '{serviceType}',
    '"UnityCatalog"',
    true
 )
where id in (
select toId from entity_relationship er 
where 
  fromEntity = 'databaseService'
  and toEntity = 'database'
  and fromId in (
    select id from dbservice_entity dbe 
    where 
      serviceType = 'Databricks' 
      and (dbe.json #>> '{connection,config,useUnityCatalog}')::bool = true
  ));
 

-- update service type to UnityCatalog - update database schema entity
UPDATE database_schema_entity dse
SET json = jsonb_set(
    json #- '{serviceType}',
    '{serviceType}',
    '"UnityCatalog"',
    true
 )
where json #>> '{database,id}' in (
select toId from entity_relationship er 
where 
  fromEntity = 'databaseService'
  and toEntity = 'database'
  and fromId in (
    select id from dbservice_entity dbe 
    where 
      serviceType = 'Databricks' 
      and (dbe.json #>> '{connection,config,useUnityCatalog}')::bool = true
  ));

-- update service type to UnityCatalog - update table entity
UPDATE table_entity te
SET json = jsonb_set(
    json #- '{serviceType}',
    '{serviceType}',
    '"UnityCatalog"',
    true
 )
where json #>> '{database,id}' in (
select toId from entity_relationship er 
where 
  fromEntity = 'databaseService'
  and toEntity = 'database'
  and fromId in (
    select id from dbservice_entity dbe 
    where 
      serviceType = 'Databricks' 
      and (dbe.json #>> '{connection,config,useUnityCatalog}')::bool = true
  ));


-- update service type to UnityCatalog - update db service entity
UPDATE dbservice_entity de
SET json = jsonb_set(
    jsonb_set(
    de.json #- '{serviceType}',
    '{serviceType}',
    '"UnityCatalog"'
 ) #- '{connection,config,type}',
    '{connection,config,type}',
    '"UnityCatalog"'
 )
WHERE de.serviceType = 'Databricks'
  AND (de.json #>> '{connection,config,useUnityCatalog}')::bool = True
;

-- remove `useUnityCatalog` flag from service connection details of databricks
UPDATE dbservice_entity de 
SET json = json #- '{connection,config,useUnityCatalog}'
WHERE de.serviceType IN ('Databricks','UnityCatalog');
