# OpenLineage runs are their own pipelines and steps join their parent's

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** Akash Verma
- **Guard:** `test_openlineage_status.py::test_spark_application_launched_by_an_airflow_task_is_a_run_of_its_own_pipeline`, `test_openlineage_status.py::test_dag_run_triggered_by_another_dags_task_is_a_run_of_its_own_pipeline`, `test_openlineage_status.py::test_dbt_run_started_by_an_airflow_task_is_a_run_of_its_own_pipeline`, `test_openlineage_status.py::test_step_joins_its_parents_run_whatever_its_name`, `test_openlineage_status.py::test_run_started_by_an_airflow_task_is_linked_from_the_dag_pipeline`, `test_openlineage_status.py::test_pipeline_dropped_from_the_task_cache_keeps_all_its_tasks`
- **Related:** #19481, #37990

## Context
An OpenLineage event names its parent run in the `parent` facet. The pull connector named every
event's pipeline after that parent. That fits the steps of one run: Spark SQL jobs, Airflow
tasks and dbt models. It breaks when one system starts another. A Spark application launched by
the Airflow task `nightly.run_spark` became a task of a Spark pipeline called
`nightly.run_spark`. Its SQL jobs went to a second pipeline, named after the application.
Neither pipeline got run status, because the application was never a pipeline run.

Job names cannot tell the two cases apart. Spark and Airflow name a step after its parent
(`orders_app.write`, `nightly.extract`), but dbt names a model after its table
(`shop.public.orders`) under the parent `dbt-run-<project>`.

## Decision
An event is a run of the pipeline named after its own job when it has no parent facet, or when
its `jobType` facet's `jobType` is `APPLICATION` (Spark), `DAG` (Airflow) or `JOB` (dbt). Any
other event with a parent is a step of the parent's run, and its pipeline is named after the
parent job. A Spark application launched by an Airflow task, or a DAG run triggered by another
DAG's task, is therefore its own pipeline with its own runs, and its steps join it. The pipeline
holding the task that started it gets a `pipeline → pipeline` lineage edge to it, with source
`OpenLineage` and the task's job name in its description. That pipeline is the one named after the
parent facet's root job, written by this connector or by a native connector, and it must have the
task; otherwise no edge is written.

Every pipeline PUT replaces its task list and start date, so the connector keeps each pipeline's
tasks and start date between events in an LRU cache. The cache is weighted by task count, because
one pipeline can hold any number of steps, and capped at 50,000 tasks: 1000 pipelines of 50 steps,
at 1 to 2 KB a task, so 50 to 100 MB per ingestion. A pipeline dropped from the cache is read again
from the server, which holds every task; a pipeline bigger than the cap is read on every event.

## Consequences
The application and its SQL jobs share one pipeline with run status, and lineage edges name that
pipeline. The Lineage tab shows the DAG upstream of the application, as DataHub's job-to-job edge
does; which DAG run started which application run is not recorded. A run started from a task that
is not a step of the root job finds no pipeline and gets no edge. Pipelines that earlier
ingestions named after a launching task stay in place, and new events no longer reach them. An
integration whose runs use another `jobType` value, or that sends no `jobType` facet, keeps the
earlier behaviour and needs its value added to the list.
