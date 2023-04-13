---
title: Latest Release
slug: /overview/latest-release
---

# [0.13.3 Release](https://github.com/open-metadata/OpenMetadata/releases/tag/0.13.3-release) - March 30th 2023 🎉

## Ingestion Framework
- Datalake Avro & Json, JsonZip support
- BigQuery Profiler Ingestion for all regions
- Support for Snowflake Geometry Type
- Add support Nifi client certificate Auth 
- Update sqllineage-openmetadata + add timeout for parsing queries
- Fixes issue in Snowflake Join Table query parsing
- Optimize Memory Usage for Usage data ingestion
- Fetch vertica schema comments as description 
- Improve snowflake system metrics 
- Add Database & Schema descsription from Snowflake
- Add support XLets in Airflow Lineage Runner
- Add support for AssumeRole in AWS
- Add support for pyimpala
- Fixed issues in DBT oracle
- Support for Tableau Owner
- Support for DBT manifest V8

## Roles & Policies 
- A Non-Privileged user can add new 'Roles' to Teams
- Fix Permissions API to consider the leaf nodes tags as well, example: table's column tags

## Search
- Improve Search Relevancy, by adding functional scoring and add ngram analyzer; 
- Enable search for entities using both name and displayName

## Security
- Enable LDAP configuration to be configured via environment variable 
- LDAP-s support connection without MTLS 

## EntityName
- Relax data asset name restrictions to allow the special characters except "::" 
- Allow unicode character and digits in Entity

## Data Quality
- Fix column values between test

