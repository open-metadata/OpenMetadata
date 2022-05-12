---
description: This guide helps you enable security in OpenMetadata with Docker
---

# Enable Security

By default, security is not enabled when bringing up a cluster with the `metadata docker --start` command. To enable authentication and authorization, follow the below-mentioned steps:

1. Create an env file like the following in your machine and update the values as required. Refer to the [Enable Security](broken-reference) documentation to set up your preferred authentication provider. The variables `AIRFLOW_AUTH_PROVIDER` and `OM_AUTH_AIRFLOW_GOOGLE_SECRET_KEY_PATH` are required for UI based metadata ingestion. The path configured in `OM_AUTH_AIRFLOW_GOOGLE_SECRET_KEY_PATH` must be present in the `local-metadata_ingestion` container with a valid secret.

```
# ~/env_open_metadata
AUTHORIZER_CLASS_NAME=org.openmetadata.catalog.security.DefaultAuthorizer
AUTHORIZER_REQUEST_FILTER=org.openmetadata.catalog.security.JwtFilter
AUTHORIZER_ADMIN_PRINCIPALS=[admin]
AUTHORIZER_INGESTION_PRINCIPALS=[ingestion-bot]
AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org
AUTHENTICATION_PROVIDER=google
AUTHENTICATION_PUBLIC_KEY=[https://www.googleapis.com/oauth2/v3/certs]
AUTHENTICATION_AUTHORITY=https://accounts.google.com
AUTHENTICATION_CLIENT_ID=709849217090-n7s8oc4cvpffubraoi5vbr1s0qfboqvv.apps.googleusercontent.com
AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
AIRFLOW_AUTH_PROVIDER=google
OM_AUTH_AIRFLOW_GOOGLE_SECRET_KEY_PATH=/tmp/secret.json
```

2\. Start the Docker containers from metadata CLI with the above env file.

```
docker compose --env-file ~/env_open_metadata up -d
```

3\. Verify all the containers are up and running

```
docker ps
```

After running the above command, you should see an output similar to the following.

```
CONTAINER ID   IMAGE                                                  COMMAND                  CREATED             STATUS                       PORTS                                                  NAMES
7f031f096966   local-metadata_openmetadata-server                     "./openmetadata-star…"   About an hour ago   Up About an hour             3306/tcp, 9200/tcp, 9300/tcp, 0.0.0.0:8585->8585/tcp   openmetadata_server
6f7992e02314   local-metadata_ingestion                               "./ingestion_depende…"   About an hour ago   Up About an hour             0.0.0.0:8080->8080/tcp                                 openmetadata_ingestion
ca8e590de33f   local-metadata_mysql                                   "/entrypoint.sh mysq…"   About an hour ago   Up About an hour (healthy)   0.0.0.0:3306->3306/tcp, 33060-33061/tcp                openmetadata_mysql
1f037580731e   docker.elastic.co/elasticsearch/elasticsearch:7.10.2   "/tini -- /usr/local…"   About an hour ago   Up About an hour             0.0.0.0:9200->9200/tcp, 0.0.0.0:9300->9300/tcp         openmetadata_elasticsearch
```

4\. Visit [http://localhost:8585](http://localhost:8585) to start exploring OpenMetadata in a secure mode :tada:
