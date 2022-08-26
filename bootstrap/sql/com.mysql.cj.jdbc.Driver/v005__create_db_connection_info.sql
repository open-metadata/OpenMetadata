UPDATE dbservice_entity
SET json = JSON_REMOVE(json, '$.connection.config.username', '$.connection.config.password')
WHERE serviceType in ('Databricks');

CREATE TABLE IF NOT EXISTS openmetadata_settings (
     id MEDIUMINT NOT NULL AUTO_INCREMENT,
     configType VARCHAR(36) NOT NULL,
     json JSON NOT NULL,
     PRIMARY KEY (id, configType),
     UNIQUE(configType)
 );
