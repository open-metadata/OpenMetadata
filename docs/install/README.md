# Catalog

## Docker
### Steps to run catalog using docker
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

mysql> CREATE USER 'catalog_user'@'%' IDENTIFIED WITH mysql_native_password BY 'catalog_password';
mysql> CREATE DATABASE catalog_db;
mysql> GRANT ALL PRIVILEGES ON catalog_db.* TO 'catalog_user'@'%' IDENTIFIED BY 'catalog_password';
mysql> FLUSH PRIVILEGES;
```

### Build OpenMetdata project and run it
Make sure MySQL is running with credentials user 'catalog_user' with password 'catalog_password'.
Connect to MySQL following steps mentioned [here](#steps-to-connect-mysql).


```shells
mvn -DskipTests clean package
cd dist/target
unzip catalog-1.0.0-SNAPSHOT.zip
cd catalog-1.0.0-SNAPSHOT/bootstrap
./bootstrap_storage.sh migrate
cd ../
```
If authorizer is configured, run:
```
./bin/catalog-server-start.sh conf/catalog-security.yaml
```
otherwise run
```
./bin/catalog-server-start.sh conf/catalog.yaml
```
Open browser http://localhost:8585/api/swagger to look at API documentation.

## Setup Authorizer Configuration
Enter following information in ***/conf/catalog-security.yaml*** file:
```
authorizerConfiguration:
  className: <authorizer_classname>
  containerRequestFilter: <JWT-filter>
  publicKeyUri: <sign-on_provider_public-key>
  clientAuthorizer:
    authority: <sign-on_issuer-url>
    client_id: <sign-on_client_id>
```
