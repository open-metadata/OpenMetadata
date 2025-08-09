---
title: Configure Data Quality | Official Documentation
description: Set up and tune quality tests across datasets using custom rules, metrics, and alerting logic.
slug: /how-to-guides/data-quality-observability/quality/configure
---

# Configure Data Quality

Learn how you can use OpenMetadata to define Data Quality tests and measure your data reliability.

## Requirements

### OpenMetadata

You must have a running deployment of OpenMetadata to use this guide. OpenMetadata includes the following services:

* OpenMetadata server supporting the metadata APIs and user interface
* Elasticsearch for metadata search and discovery
* MySQL as the backing store for all metadata
* Airflow for metadata ingestion workflows

To deploy OpenMetadata checkout the [deployment guide](/deployment)

### Python (version 3.9.0 or later)

Please use the following command to check the version of Python you have.

```
python3 --version
```

## Building Trust with Data Quality

OpenMetadata is where all users share and collaborate around data. It is where you make your assets discoverable; with data quality you make these assets **trustable**.

This section will show you how to configure and run Data Quality pipelines with the OpenMetadata built-in tests.

## Main Concepts
### Test Suite
Test Suites are logical container allowing you to group related Test Cases together from different tables. This is a great approach to group test case alerts and reduce alerting overload.

## Logical Test Suite
A Logical Test Suite is a collection of various test cases, which may pertain to different tables, grouped together under a single framework. Unlike Executable Test Suites, Logical Test Suites do not have an associated pipeline to execute the tests. Their primary purpose is to provide a consolidated view of related test cases, facilitating easier management and visualization without the need to run them as a single unit.

## Executable Test Suite
An Executable Test Suite is specifically associated with a single table, ensuring that all test cases within this suite are relevant to that particular table. The term "executable entity reference" refers to the specific table that the test suite is connected to, signifying that the tests can be run directly on this table. This suite is designed for execution, allowing for direct testing of the table's data integrity and functionality.

### Test Definition
Test Definitions are generic tests definition elements specific to a test such as:
- test name
- column name
- data type

### Test Cases
Test Cases specify a Test Definition. It will define what condition a test must meet to be successful (e.g. `max=n`, etc.). One Test Definition can be linked to multiple Test Cases.
