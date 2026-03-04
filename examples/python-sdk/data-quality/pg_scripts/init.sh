#!/usr/bin/env bash

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE tutorial_user LOGIN PASSWORD 'password';
  CREATE DATABASE raw;
  CREATE DATABASE stg;
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname raw <<-EOSQL
  -- Grant CONNECT so the user can access the database
  GRANT CONNECT ON DATABASE raw TO tutorial_user;
  
  -- Grant USAGE on the schema (required to access tables)
  GRANT USAGE ON SCHEMA public TO tutorial_user;
  
  -- Grant SELECT on all existing tables
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO tutorial_user;
  
  -- Ensure future tables are also readable
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO tutorial_user;

  CREATE TABLE IF NOT EXISTS taxi_yellow (
    VendorID int,
    tpep_pickup_datetime timestamp,
    tpep_dropoff_datetime timestamp,
    passenger_count int,
    trip_distance float,
    RatecodeID int,
    store_and_fwd_flag varchar,
    PULocationID int,
    PUZone varchar(16),
    DOZone varchar(16),
    DOLocationID int,
    payment_type int,
    fare_amount float,
    extra float,
    mta_tax float,
    tip_amount float,
    tolls_amount float,
    improvement_surcharge float,
    total_amount float,
    congestion_surcharge float,
    Airport_fee float,
    cbd_congestion_fee float
  );
EOSQL


psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname stg <<-EOSQL
  -- Grant CONNECT so the user can access the database
  GRANT CONNECT ON DATABASE stg TO tutorial_user;

  -- Grant USAGE on the schema (required to access tables)
  GRANT USAGE ON SCHEMA public TO tutorial_user;

  -- Grant SELECT on all existing tables
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO tutorial_user;

  -- Ensure future tables are also readable
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO tutorial_user;

  CREATE TABLE IF NOT EXISTS dw_taxi_trips (
    vendor_id INT,
    pickup_datetime TIMESTAMP,
    dropoff_datetime TIMESTAMP,
    passenger_count INT,
    trip_distance FLOAT,
    pu_location_id INT,
    do_location_id INT,
    payment_type INT,
    fare_amount FLOAT,
    tip_amount FLOAT,
    total_amount FLOAT,
    congestion_surcharge FLOAT,
    pickup_hour SMALLINT,
    pickup_dayofweek SMALLINT,
    trip_duration_min FLOAT,
    avg_speed_mph FLOAT,
    trip_category VARCHAR(16)
  );
EOSQL
