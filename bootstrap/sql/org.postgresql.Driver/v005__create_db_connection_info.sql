UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,username}' #- '{connection,config,password}'
WHERE serviceType in ('Databricks');

CREATE TABLE IF NOT EXISTS openmetadata_settings (
     id SERIAL NOT NULL ,
     configType VARCHAR(36) NOT NULL,
     json JSONB NOT NULL,
     PRIMARY KEY (id, configType),
     UNIQUE(configType)
 );