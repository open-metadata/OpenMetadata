from airflow import DAG
from openmetadata.workflows import workflow_factory

workflow = workflow_factory.WorkflowFactory.create(
    "/Users/harsha/Code/openmetadata-airflow-apis/examples/test.json"
)
workflow.generate_dag(globals())
dag = workflow.get_dag()
print(dag)
