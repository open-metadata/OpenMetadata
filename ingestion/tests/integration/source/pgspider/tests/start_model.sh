#!/bin/bash

export LANGUAGE="en_US.UTF-8"
export LANG="en_US.UTF-8"
export LC_ALL="en_US.UTF-8"

###build fdws

CONTRIB_DIR=/home/pgspider/PGSpider/contrib

cd $CONTRIB_DIR/file_fdw
make clean && make && make install

cd $CONTRIB_DIR/postgres_fdw
make clean && make && make install

cd $CONTRIB_DIR/pgspider_keepalive
make && make install

cd $CONTRIB_DIR/pgspider_fdw
make clean && make && make install

cd $CONTRIB_DIR/pgspider_core_fdw
make clean && make && make install

cd $CONTRIB_DIR/setup_cluster
make clean && make

cd /home/pgspider/postgresql-15.0/install/bin
pkill -9 postgres || true
sleep 2
rm -rf ../databases || true
./initdb ../databases
./pg_ctl -D ../databases start
./createdb pgtest1
./createdb pgtest2

./psql -d pgtest1 -c "CREATE TABLE test1_1 (i int);"
./psql -d pgtest1 -c "CREATE TABLE test1_2 (i int);"
./psql -d pgtest2 -c "CREATE TABLE test2 (a int, b text, c int);"

cd /home/pgspider/PGSpider/install/bin
pkill -9 pgspider || true
sleep 2
rm -rf ../databases || true
./initdb ../databases
sed -i "s~.*listen_addresses = .*~listen_addresses = '*'~g" ../databases/postgresql.conf
echo "host    all             all             172.39.0.1/16           trust" >> ../databases/pg_hba.conf
./pg_ctl -D ../databases start
./createdb pgspider

./psql -d pgspider -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pgspider;"
./psql -d pgspider -c "CREATE EXTENSION pgspider_core_fdw;"
./psql -d pgspider -c "CREATE SERVER pgspider_svr FOREIGN DATA WRAPPER pgspider_core_fdw OPTIONS (host '127.0.0.1', port '50849');"
./psql -d pgspider -c "CREATE USER MAPPING FOR public SERVER pgspider_svr;"
./psql -d pgspider -c "CREATE EXTENSION postgres_fdw;"
./psql -d pgspider -c "CREATE SERVER post_svr FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host '127.0.0.1', port '5432', dbname 'pgtest1');"
./psql -d pgspider -c "CREATE USER MAPPING FOR public SERVER post_svr OPTIONS (user 'pgspider', password '1');"
./psql -d pgspider -c "CREATE FOREIGN TABLE test1 (i int, __spd_url text) SERVER pgspider_svr;"
./psql -d pgspider -c "CREATE FOREIGN TABLE test1__post_svr__0 (i int) SERVER post_svr OPTIONS (table_name 'test1_1');"
./psql -d pgspider -c "CREATE FOREIGN TABLE test1__post_svr__1 (i int) SERVER post_svr OPTIONS (table_name 'test1_2');"
./psql -d pgspider -c "CREATE FOREIGN TABLE test2 (a int, b text, c int, __spd_url text) SERVER pgspider_svr;"
./psql -d pgspider -c "CREATE FOREIGN TABLE test2__post_svr__0 (a int, b text, c int) SERVER post_svr OPTIONS (table_name 'test2');"

