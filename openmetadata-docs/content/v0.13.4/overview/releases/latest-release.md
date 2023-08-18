---
title: Latest Release
slug: /overview/latest-release
---

# [0.13.3 Release](https://github.com/open-metadata/OpenMetadata/releases/tag/0.13.3-release) - March 30th 2023 🎉

### Optimize Memory for Usage Workflow
Implemented better memory management when processing usage data for database connectors

### Bug Fixes
- Fix partition logic when profiling BigQuery table witg `_PARTITIONTIME`
- Handle Snowflake overflow error
- Set catalog for Databrick profiler connector
