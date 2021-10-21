#!/bin/bash
path="/Users/parthpanchal/Documents/CodeBase/OpenMetadata"
cd $path
mvn -DskipTests clean package

cd docker/local-metadata/
docker-compose up -d
while ! wget -O /dev/null -o /dev/null localhost:8585/api/v1/teams/name/Finance; do sleep 5; done