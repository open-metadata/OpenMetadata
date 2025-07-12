---
title: Configuring DAG Lineage
slug: /connectors/pipeline/airflow/configuring-lineage
---

# Configuring DAG Lineage

Regardless of the Airflow ingestion process you follow ([Workflow](/connectors/pipeline/airflow),
[Lineage Backend](/connectors/pipeline/airflow/lineage-backend) or [Lineage Operator](/connectors/pipeline/airflow/lineage-operator)),
OpenMetadata will try to extract the lineage information based on the tasks `inlets` and `outlets`.

What it's important to consider here is that when we are ingesting Airflow lineage, we are actually building a graph:

```
Table A (node) -> DAG (edge) -> Table B (node)
```

Where tables are nodes and DAGs (Pipelines) are considered edges. This means that the correct way of setting these
parameters is by making sure that we are informing both `inlets` and `outlets`, so that we have the nodes to build
the relationship.

## Configuring Lineage

{% note %}

We support lineage for the following entities: `Table`, `Container`, `Dashboard`, `DashboardDataModel`, `Pipeline`, `Topic`, `SearchIndex`, `REST API`, and `MlModel`.

Moreover, note that this example requires the `openmetadata-ingestion` package to be installed. If you are planning to
ingest the Airflow metadata (and lineage) externally and don't want to install it, please refer to the next section.

{% /note %}

Let's take a look at the following example:

```python
from datetime import timedelta

from airflow import DAG
from airflow.operators.dummy import DummyOperator
from airflow.utils.dates import days_ago

from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.source.pipeline.airflow.lineage_parser import OMEntity


default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email': ['airflow@example.com'],
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(seconds=1),
}


with DAG(
    "test-lineage",
    default_args=default_args,
    description="An example DAG which runs a lineage test",
    start_date=days_ago(1),
    is_paused_upon_creation=False,
    catchup=False,
) as dag:
    

    t0 = DummyOperator(
        task_id='task0',
        inlets=[
            OMEntity(entity=Container, fqn="Container A", key="group_A"),
            OMEntity(entity=Table, fqn="Table X", key="group_B"),
        ]
    )
    
    t1 = DummyOperator(
        task_id='task10',
        outlets=[
            OMEntity(entity=Table, fqn="Table B", key="group_A"),
            OMEntity(entity=Table, fqn="Table Y", key="group_B"),
        ]
    )

    t0 >> t1
```

We are passing inlets and outlets as a list of the `OMEntity` class, that lets us specify:
1. The type of the asset we are using: Table, Container,... following our SDK
2. The FQN of the asset, which is the unique name of each asset in OpenMetadata, e.g., `serviceName.databaseName.schemaName.tableName`.
3. The key to group the lineage if needed.

This `OMEntity` class is defined following the example of Airflow's internal lineage 
[models](https://github.com/apache/airflow/blob/main/airflow/lineage/entities.py).

## Keys

We can inform the lineage dependencies among different groups of tables. In the example above, we are not building the
lineage from all inlets to all outlets, but rather grouping the tables by key (`group_A` and `group_B`).
This means that after this lineage is processed, the relationship will be:

```
Container A (node) -> DAG (edge) -> Table B (node)
```

and

```
Table X (node) -> DAG (edge) -> Table Y (node)
```

It does not matter in which task of the DAG these inlet/outlet information is specified. During the ingestion process we
group all these details at the DAG level.

## Configuring Lineage without the `openmetadata-ingestion` package

We can apply the same example as above but describing the lineage in dictionaries instead, in order to not require
the `openmetadata-ingestion` package to be installed in the environment.

```python
from datetime import timedelta

from airflow import DAG
from airflow.operators.dummy import DummyOperator
from airflow.utils.dates import days_ago

default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email': ['airflow@example.com'],
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(seconds=1),
}


with DAG(
    "test-lineage",
    default_args=default_args,
    description="An example DAG which runs a lineage test",
    start_date=days_ago(1),
    is_paused_upon_creation=False,
    catchup=False,
) as dag:
    

    t0 = DummyOperator(
        task_id='task0',
        inlets=[
            {"entity": "container", "fqn": "Container A", "key": "group_A"},
            {"entity": "table", "fqn": "Table X", "key": "group_B"},
        ]
    )
    
    t1 = DummyOperator(
        task_id='task10',
        outlets=[
            {"entity": "table", "fqn": "Table B", "key": "group_A"},
            {"entity": "table", "fqn": "Table Y", "key": "group_B"},
        ]
    )

    t0 >> t1
```

We are passing inlets and outlets as a list of dictionaries, that lets us specify:
1. The type of the asset we are using: Table, Container,... following the list below.
2. The FQN of the asset, which is the unique name of each asset in OpenMetadata, e.g., `serviceName.databaseName.schemaName.tableName`.
3. The key to group the lineage if needed.

The `entity` key needs to be informed as follows for each of the entity types:

- Table: `table`
- Container: `container`
- Dashboard: `dashboard`
- Dashboard Data Model: `dashboardDataModel`
- Pipeline: `pipeline`
- Topic: `topic`
- SearchIndex: `searchIndex`
- MlModel: `mlmodel`


## Configuring Lineage between Tables

{% note %}

Note that this method only allows lineage between Tables.

We will deprecate it in OpenMetadata 1.4

{% /note %}

Let's take a look at the following example:

```python
from datetime import timedelta

from airflow import DAG
from airflow.operators.dummy import DummyOperator
from airflow.utils.dates import days_ago


default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email': ['airflow@example.com'],
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(seconds=1),
}


with DAG(
    "test-multiple-inlet-keys",
    default_args=default_args,
        description="An example DAG which runs a lineage test",
    start_date=days_ago(1),
    is_paused_upon_creation=False,
    catchup=False,
) as dag:
    

    t0 = DummyOperator(
        task_id='task0',
        inlets={
            "group_A": ["Table A"],
            "group_B": ["Table X"]
        }
    )
    
    t1 = DummyOperator(
        task_id='task10',
        outlets={
            "group_A": ["Table B"],
            "group_B": ["Table Y"]
        }
    )

    t0 >> t1
```


{% note %}

Make sure to add the table Fully Qualified Name (FQN), which is the unique name of the table in OpenMetadata.

This name is composed as `serviceName.databaseName.schemaName.tableName`.

{% /note %}
