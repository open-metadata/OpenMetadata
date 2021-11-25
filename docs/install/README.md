# OpenMetadata

## Docker
### Steps to run openmetadata using docker
```shell
cd docker/metadata/
docker-compose build
docker-compose up
```
Open in browser http://localhost:8585/api/swagger

## Command line
### Set up MySQL database used as OpenMetadata backend
```shell
mysql -u username -p (Enter password when prompted)

mysql> CREATE USER 'openmetadata_user'@'%' IDENTIFIED WITH mysql_native_password BY 'openmetadata_password';
mysql> CREATE DATABASE openmetadata_db;
mysql> GRANT ALL PRIVILEGES ON openmetadata_db.* TO 'openmetadata_user'@'%';
mysql> FLUSH PRIVILEGES;
```

### Build OpenMetdata project and run it
Make sure MySQL is running with credentials user 'openmetadata_user' with password 'openmetadata_password'.
Connect to MySQL following steps mentioned [here](#steps-to-connect-mysql).


```shells
mvn -DskipTests clean package
cd openmetadata-dist/target
unzip openmetadata-1.0.0-SNAPSHOT.zip
cd openmetadata-1.0.0-SNAPSHOT/bootstrap
./bootstrap_storage.sh migrate
cd ../
```
If authorizer is configured, run:
```
./bin/openmetadata-server-start.sh conf/openmetadata-security.yaml
```
otherwise run
```
./bin/openmetadata-server-start.sh conf/openmetadata.yaml
```
Open browser http://localhost:8585/api/swagger to look at API documentation.

## Setup Authorizer Configuration
Enter following information in ***/conf/openmetadata-security.yaml*** file:
```
authorizerConfiguration:
  className: <authorizer_classname>
  containerRequestFilter: <JWT-filter>
  publicKeyUri: <sign-on_provider_public-key>
  clientAuthorizer:
    authority: <sign-on_issuer-url>
    client_id: <sign-on_client_id>
```
