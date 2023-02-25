---
title: Latest Release
slug: /overview/latest-release
---

# [0.13.2 Release](https://github.com/open-metadata/OpenMetadata/releases/tag/0.13.2-release) - Jan 30th 2022 🎉

## Improved SQL Lineage
- We have collaborated with the [sqllineage](https://github.com/reata/sqllineage) and [sqlfluff](https://www.sqlfluff.com/) communities
    to improve the parsing capabilities of `sqllineage`. We'll continue to collaborate to ship further improvements in new releases.

## New Glossary UI
- Moved from a tree view in the left panel to an easy to navigate list of the terms sorted alphabetically.
- The term list shows the tags and descriptions in the cards.

## Glossary Import & Export
- You can now export your Glossary data as a CSV file.
- In the same way, you can now bulk upload terms to a Glossary by adding their details in a CSV file.
- The import utility will validate the file and show you a preview of the elements that are going to be imported to OpenMetadata.

## Unified Tag Category API
- Renamed Tag Categories to Classification, a more widely used term.
- Updated the API to conform with the rest of the specification. More info [here](https://github.com/open-metadata/OpenMetadata/issues/9259).

## Mutually Exclusive Tags
- When creating a Classification or a Glossary term, you can now make the tags to be mutually exclusive.
- If tags are set to be mutually exclusive, you won't be able to set multiple tags from the same category in the same asset.

## EntityName
- Special characters

## Ingestion Framework
- Performance Improvements: We are now getting descriptions in batch, making connectors such as Redshift or Snowflake way faster!
- The Oracle connector now ships with the Thick mode enabled.
- AWS QuickSight fixes
- DB2 constraints and profiler improvements
- Added support for Postgres Foreign Tables
- Added support for Datalake profiler row-based sampling
