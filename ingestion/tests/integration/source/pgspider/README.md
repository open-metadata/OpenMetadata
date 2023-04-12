# PGSpider Integration Test

A dockerfile has been prepared to execute the integration test for PGSpider connector.

## Starting docker
Please do the following steps to start the docker.
If this is the 1st time that you use this docker, you need to build the docker image first.
```
cd tests
docker build -t pgspider_server .
```
After that, from next time, you only need to start the docker and execute the script.
```
docker-compose up -d
docker exec pgspider_server_for_openmetadata /bin/bash -c 'su -c "/home/test/start_model.sh" pgspider'
```
If you want to remote into docker to verify if PGSpider is started, you can use the following command:
```
docker exec -it pgspider_server_for_openmetadata /bin/bash
```
