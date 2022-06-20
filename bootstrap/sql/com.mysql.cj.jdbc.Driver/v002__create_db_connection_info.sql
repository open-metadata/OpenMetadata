CREATE TABLE IF NOT EXISTS type_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    category VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.category') NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (name)
);

ALTER TABLE webhook_entity
ADD status VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.status') NOT NULL,
DROP COLUMN deleted;

ALTER TABLE entity_relationship
DROP INDEX edge_index;

CREATE TABLE IF NOT EXISTS openmetadata_config_resource (
    id MEDIUMINT NOT NULL AUTO_INCREMENT,
    config_type VARCHAR(36) NOT NULL,
    json JSON NOT NULL,
    PRIMARY KEY (id, config_type)
);

INSERT INTO openmetadata_config_resource (config_type, json)
VALUES ("authorizerConfiguration",'{
        "className": "org.openmetadata.catalog.security.NoopAuthorizer",
        "containerRequestFilter": "org.openmetadata.catalog.security.NoopFilter",
        "adminPrincipals": [
            "admin"
        ],
        "botPrincipals": [
            "ingestion-bot"
        ],
        "principalDomain": "openmetadata.org",
        "enforcePrincipalDomain": false,
        "enableSecureSocketConnection": false
}');

INSERT INTO openmetadata_config_resource (config_type, json)
VALUES ("authenticationConfiguration",'{
        "provider": "no-auth",
        "providerName": "",
        "publicKeyUrls": [
             "https://www.googleapis.com/oauth2/v3/certs"
        ],
        "authority": "https://accounts.google.com",
        "clientId": "",
        "callbackUrl": "",
        "jwtPrincipalClaims": [
             "email",
             "preferred_username",
             "sub"
        ]
}');

INSERT INTO openmetadata_config_resource (config_type, json)
VALUES ("jwtTokenConfiguration",'{
       "rsapublicKeyFilePath": "",
       "rsaprivateKeyFilePath": "",
       "jwtissuer": "open-metadata.org",
       "keyId": "Gb389a-9f76-gdjs-a92j-0242bk94356"
}');

INSERT INTO openmetadata_config_resource (config_type, json)
VALUES ("elasticsearch",'{
       "host": "localhost",
       "port": 9200,
       "scheme": "http",
       "username": "",
       "password": "",
       "truststorePath": "",
       "truststorePassword": "",
       "connectionTimeoutSecs": 5,
       "socketTimeoutSecs": 60,
       "batchSize": 10
}');

INSERT INTO openmetadata_config_resource (config_type, json)
VALUES ("eventHandlerConfiguration",'{
       "eventHandlerClassNames": [
            "org.openmetadata.catalog.events.AuditEventHandler",
            "org.openmetadata.catalog.events.ChangeEventHandler"
       ]
}');

INSERT INTO openmetadata_config_resource (config_type, json)
VALUES ("airflowConfiguration",'{
        "apiEndpoint": "http://localhost:8080",
        "username": "admin",
        "password": "admin",
        "metadataApiEndpoint": "http://localhost:8585/api",
        "authProvider": "no-auth",
        "authConfig": {
           "azure": {
              "clientSecret": "",
              "authority": "",
              "scopes": [],
              "clientId": ""
           },
           "google": {
              "secretKey": "",
              "audience": "https://www.googleapis.com/oauth2/v4/token"
           },
           "okta": {
              "clientId": "",
              "orgURL": "",
              "privateKey": "",
              "email": "",
              "scopes": []
           },
           "auth0": {
              "clientId": "",
              "secretKey": "",
              "domain": ""
           },
           "customOidc": {
              "clientId": "",
              "secretKey": "",
              "tokenEndpoint": ""
           },
           "openmetadata": {
              "jwtToken": ""
           }
        }
}');


INSERT INTO openmetadata_config_resource (config_type, json)
VALUES ("fernetConfiguration",'{
        "fernetKey": "no_encryption_at_rest"
}');

INSERT INTO openmetadata_config_resource (config_type, json)
VALUES ("slackEventPublishers",'[
        {
            "name": "slack events",
            "webhookUrl": "",
            "openMetadataUrl": "",
            "filters": [
            {
               "eventType": "entityCreated",
               "entities": [
                  "*"
               ]
            },
            {
               "eventType": "entityUpdated",
               "entities": [
                  "*"
               ]
            },
            {
               "eventType": "entitySoftDeleted",
               "entities": [
                  "*"
               ]
            },
            {
               "eventType": "entityDeleted",
               "entities": [
                  "*"
               ]
            }
            ]
        }
]');







