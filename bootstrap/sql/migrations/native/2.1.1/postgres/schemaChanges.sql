UPDATE dbservice_entity
SET json = jsonb_set(json::jsonb, '{connection,config,scheme}', '"oracle+oracledb"')
WHERE serviceType = 'Oracle'
  AND json #>> '{connection,config,scheme}' = 'oracle+cx_oracle';
