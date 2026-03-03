-- Migrate Redshift connection: move password into authType.password (basicAuth)
UPDATE dbservice_entity
SET json = jsonb_set(
    json #- '{connection,config,password}',
    '{connection,config,authType}',
    jsonb_build_object('password', json #> '{connection,config,password}')
)
WHERE serviceType = 'Redshift'
  AND json #> '{connection,config,password}' IS NOT NULL
  AND NOT jsonb_exists(json #> '{connection,config}', 'authType');
