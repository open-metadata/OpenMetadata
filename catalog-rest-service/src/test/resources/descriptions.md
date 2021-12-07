# Catalog

## Build

* Run mvn -DskipTests clean package
* cd openmetadata-dist/target
* unzip catalog-command-center-1.0.0-SNAPSHOT.zip
* cd catalog-command-center-1.0.0-SNAPSHOT
* make sure you have mysql running with following creds
* user 'catalog_user' with the password 'catalog_password' 
* privileges on 'catalog_db'
* cd bootstrap
* ./bootstrap-storage.sh migrate
* if the above command fails run again
* cd ../
* ./bin/catalog-server-start.sh conf/catalog.yaml
* open browser localhost:8585/api/swagger

## json2pojo
This project uses JSON schema to generate java classes using json2pojo. For details see [json2pojo maven plugin](https://github.com/joelittlejohn/jsonschema2pojo/wiki/Getting-Started#the-maven-plugin).
