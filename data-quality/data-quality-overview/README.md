---
description: >-
  Learn how you can use OpenMetadata to define Data Quality tests and measure
  your data reliability.
---

# Data Quality Overview

## Requirements

### OpenMetadata (version 0.10 or later)

You must have a running deployment of OpenMetadata to use this guide. OpenMetadata includes the following services:

* OpenMetadata server supporting the metadata APIs and user interface
* Elasticsearch for metadata search and discovery
* MySQL as the backing store for all metadata
* Airflow for metadata ingestion workflows

### Python (version 3.8.0 or later)

Please use the following command to check the version of Python you have.

```
python3 --version
```

## Building Trust

OpenMetadata aims to be where all users share and collaborate around data. One of the main benefits of ingesting metadata into OpenMetadata is to make assets discoverable.

However, we need to ask ourselves: What happens after a user stumbles upon our assets? Then, we can help other teams use the data by adding proper descriptions with up-to-date information or even examples on how to extract information properly.

What is imperative to do, though, is to build **trust**. For example, users might find a Table that looks useful for their use case, but how can they be sure it correctly follows the SLAs? What issues has this source undergone in the past? Data Quality & tests play a significant role in making any asset trustworthy. Being able to show together the Entity information and its reliability will help our users think, "This is safe to use".

This section will show you how to configure and run Data Profiling and Quality pipelines with the supported tests.

## Data Profiling

### Workflows

The **Ingestion Framework** currently supports two types of workflows:

* **Ingestion:** Captures metadata from the sources and updates the Entities' instances. This is a lightweight process that can be scheduled to have fast feedback on metadata changes in our sources. This workflow handles both the metadata ingestion as well as the usage and lineage information from the sources, when available.
* **Profiling:** Extracts metrics from SQL sources and sets up and runs Data Quality tests. It requires previous executions of the Ingestion Pipeline. This is a more time-consuming workflow that will run metrics and compare their result to the configured tests of both Tables and Columns.

{% hint style="info" %}
Note that you can configure the ingestion pipelines with `source.config.data_profiler_enabled` as `"true"` or `"false"` to run the profiler as well during the metadata ingestion. This, however, **does not support** Quality Tests.
{% endhint %}

### Profiling Overview

#### Requirements

The source layer of the Profiling workflow is the OpenMetadata API. Based on the source configuration, this process lists the tables to be executed.

#### Description

The steps of the **Profiling** pipeline are the following:

1. First, use the source configuration to create a connection.
2. Next, iterate over the selected tables and schemas that the Ingestion has previously recorded in OpenMetadata.
3. Run a default set of metrics to all the table's columns. (We will add more customization in the future releases).
4. Finally, compare the metrics' results against the configured Data Quality tests.

{% hint style="info" %}
Note that all the results are published to the OpenMetadata API, both the Profiling and the tests executions. This will allow users to visit the evolution of the data and its reliability directly in the UI.
{% endhint %}

You can take a look at the supported metrics and tests here:

{% content-ref url="metrics.md" %}
[metrics.md](metrics.md)
{% endcontent-ref %}

{% content-ref url="tests.md" %}
[tests.md](tests.md)
{% endcontent-ref %}

## How to Add Tests

Tests are part of the Table Entity. We can add new tests to a Table from the UI or directly use the JSON configuration of the workflows.

{% hint style="info" %}
Note that in order to add tests and run the Profiler workflow, the metadata should have already been ingested.
{% endhint %}

### Add Tests in the UI

To create a new test, we can go to the _Table_ page under the _Data Quality_ tab:

![Data Quality Tab in the Table Page](<../../docs/.gitbook/assets/image (5) (1) (1).png>)

Clicking on _Add Test_ will allow us two options: **Table Test** or **Column Test**. A Table Test will be run on metrics from the whole table, such as the number of rows or columns, while Column Tests are specific to each column's values.

#### Add Table Tests

Adding a Table Test will show us the following view:

![Add a Table Test](<../../docs/.gitbook/assets/image (1).png>)

* **Test Type**: It allows us to specify the test we want to configure.
* **Description**: To explain why the test is necessary and what scenarios we want to validate.
* **Value**: Different tests will show different values here. For example, the `tableColumnCountToEqual` requires us to specify the number of columns we expect. Other tests will have other forms when we need to add values such as `min` and `max`, while other tests require no value at all, such as tests validating that there are no nulls in a column.

#### Add Column Tests

Adding a Column Test will have a similar view:

![Add Column Test](<../../docs/.gitbook/assets/image (52) (2).png>)

The Column Test form will be similar to the Table Test one. The only difference is the **Column Name** field, where we need to select the column we will be targeting for the test.

{% hint style="info" %}
You can review the supported tests [here](tests.md). We will keep expanding the support for new tests in the upcoming releases.
{% endhint %}

Once tests are added, we will be able to see them in the _Data Quality_ tab:

![Freshly created tests](<../../docs/.gitbook/assets/image (42) (1) (1) (1).png>)

Note how the tests are grouped in Table and Column tests. All tests from the same column will also be grouped together. From this view, we can both edit and delete the tests if needed.

In the global Table information at the top, we will also be able to see how many Table Tests have been configured.

### Add Tests with the JSON Config

In the [connectors](../../docs/integrations/connectors/) documentation for each source, we showcase how to run the Profiler Workflow using the Airflow SDK or the `metadata` CLI. When configuring the JSON configuration for the workflow, we can add tests as well.

Any tests added to the JSON configuration will also be reflected in the Data Quality tab. This JSON configuration can be used for both the Airflow SDK and to run the workflow with the CLI.

You can find further information on how to prepare the JSON configuration for each of the sources. However, adding any number of tests is a matter of updating the `processor` configuration as follows:

```json
 "processor": {
    "type": "orm-profiler",
    "config": {
        "test_suite": {
            "name": "<Test Suite name>",
            "tests": [
                {
                    "table": "<Table FQN>",
                    "table_tests": [
                        {
                            "testCase": {
                                "config": {
                                    "value": 100
                                },
                                "tableTestType": "tableRowCountToEqual"
                            }
                        }
                    ],
                    "column_tests": [
                        {
                            "columnName": "<Column Name>",
                            "testCase": {
                                "config": {
                                    "minValue": 0,
                                    "maxValue": 99
                                },
                                "columnTestType": "columnValuesToBeBetween"
                            }
                        }
                    ]
                }
            ]
        }
     }
  },son
```

`tests` is a list of test definitions that will be applied to the `table`, informed by its FQN. For each table, one can then define a list of `table_tests` and `column_tests`. Review the supported tests and their definitions to learn how to configure the different cases [here](tests.md).

## How to Run Tests

Both the Profiler and Tests are executed in the Profiler Workflow. All the results will be available through the UI in the _Profiler_ and _Data Quality_ tabs.

![Tests results in the Data Quality tab](<../../docs/.gitbook/assets/image (11) (2).png>)

To learn how to prepare and run the Profiler Workflow for a given source, you can take a look at the documentation for that specific [connector](../../docs/integrations/connectors/).

## Where are the Tests stored?

Once you create a Test definition for a Table or any of its Columns, that Test becomes a part of the Table Entity. This means that it does not matter from where you create tests (JSON Configuration vs. UI). As once the test gets registered to OpenMetadata, it will always be executed as part of the Profiler Workflow.

You can check what tests an Entity has configured in the **Data Quality** tab of the UI, or by using the API:

```python
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig

from metadata.generated.schema.entity.data.table import Table


server_config = MetadataServerConfig(api_endpoint="http://localhost:8585/api")
metadata = OpenMetadata(server_config)

table = metadata.get_by_name(entity=Table, fqdn="FQDN", fields=["tests"])
```

You can then check `table.tableTests`, or for each Column `column.columnTests` to get the test information.
