UPDATE dbservice_entity
SET json = JSON_REMOVE(json, '$.connection.config.username', '$.connection.config.password')
WHERE serviceType in ('Databricks');