UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,username}' #- '{connection,config,password}'
WHERE serviceType in ('Databricks');