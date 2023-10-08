---
title: Configuring DAG Lineage
slug: /connectors/pipeline/airflow/configuring-lineage
---

# Configuring DAG Lineage

Regardless of the Airflow ingestion process you follow ([Workflow](/connectors/pipeline/airflow),
[Lineage Backend](/connectors/pipeline/airflow/lineage-backend) or [Lineage Operator](/connectors/pipeline/airflow/lineage-operator)),
OpenMetadata will try to extract the lineage information based on the tasks `inlets` and `outlets`.

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
    description="An example DAG which runs a a task group lineage test",
    start_date=days_ago(1),
    is_paused_upon_creation=False,
    catchup=False,
) as dag:
    

    t0 = DummyOperator(
        task_id='task0',
        inlets={
            "tables": ["Table A"],
            "more_tables": ["Table X"]
        }
    )
    
    t1 = DummyOperator(
        task_id='task10',
        outlets={
            "tables": ["Table B"],
            "more_tables": ["Table Y"]
        }
    )

    t0 >> t1
```

Note how we have two tasks:
- `t0`: Informing the `inlets`, with keys `tables` and `more_tables`.
- `t1`: Informing the `outlets` with keys `tables` and `more_tables`.

{% note %}

Make sure to add the table Fully Qualified Name (FQN), which is the unique name of the table in OpenMetadata.

This name is composed as `serviceName.databaseName.schemaName.tableName`.

{% /note %}

What it's important to consider here is that when we are ingesting Airflow lineage, we are actually building a graph:

```
Table A (node) -> DAG (edge) -> Table B (node)
```

Where tables are nodes and DAGs (Pipelines) are considered edges. This means that the correct way of setting these
parameters is by making sure that we are informing both `inlets` and `outlets`, so that we have the nodes to build
the relationship.

## Keys

We can inform the lineage dependencies among different groups of tables. In the example above, we are not building the
lineage from all inlets to all outlets, but rather grouping the tables by the dictionary key (`tables` and `more_tables`).
This means that after this lineage is processed, the relationship will be:

```
Table A (node) -> DAG (edge) -> Table B (node)
```

and

```
Table X (node) -> DAG (edge) -> Table Y (node)
```

It does not matter in which task of the DAG these inlets and outlets information is specified. During the ingestion process we
group all these details at the DAG level.
