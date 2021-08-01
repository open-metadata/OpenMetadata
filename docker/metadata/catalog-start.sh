#!/bin/bash

cd /

while ! curl -o - 172.16.239.10:3306; do sleep 1; done

unzip -o catalog*.zip
cp /catalog.yaml /catalog-1.0.0-SNAPSHOT/conf/

cd /catalog-1.0.0-SNAPSHOT
./bootstrap/bootstrap_storage.sh migrate

./bin/catalog-server-start.sh conf/catalog.yaml
