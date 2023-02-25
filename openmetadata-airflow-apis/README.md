# OpenMetadata Airflow Managed DAGS Api

This is a plugin for Apache Airflow >= 1.10 and Airflow >=2.x that exposes REST APIs to deploy an
OpenMetadata workflow definition and manage DAGS and tasks.

## Development

You can run `make branch=issue-3659-v2 test_up` and specify any branch from OpenMetadata that you'd
need to test the changes in the APIs. This will prepare a separated airflow container.

The command will build the image by downloading the branch changes inside the container. This helps us
test the REST APIs using some ongoing changes on OpenMetadata as well.

## Requirements

First, make sure that Airflow is properly installed with the latest version `2.3.3`. From
the [docs](https://airflow.apache.org/docs/apache-airflow/stable/installation/installing-from-pypi.html):

Then, install following packages in your scheduler and webserver python env.

```
pip install openmetadata-airflow-managed-apis       
```

## Configuration

Add the following section to airflow.cfg

```
[openmetadata_airflow_apis]
dag_generated_configs = {AIRFLOW_HOME}/dag_generated_configs
```

substitute AIRFLOW_HOME with your airflow installation home

## Deploy


```
pip install "apache-airflow==2.3.3" --constraint "https://raw.githubusercontent.com/apache/airflow/constraints-2.3.3/constraints-3.9.txt"
```

1. Install the package
2. `mkdir -p {AIRFLOW_HOME}/dag_generated_configs`
3. (re)start the airflow webserver and scheduler

    ```
    airflow webserver
    airflow scheduler
    ```

## Validate

You can check that the plugin is correctly loaded by going to `http://{AIRFLOW_HOST}:{AIRFLOW_PORT}/restapi`,
or accessing the REST_API_PLUGIN view through the Admin dropdown.

## APIs

#### Enable JWT Auth tokens
Plugin enables JWT Token based authentication for Airflow versions 1.10.4 or higher when RBAC support is enabled.

##### Generating the JWT access token

```bash
curl -XPOST http://localhost:8080/api/v1/security/login -H "Content-Type: application/json" -d '{"username":"admin", "password":"admin", "refresh":true, "provider": "db"}'
```
##### Examples:

```bash
curl -X POST http://localhost:8080/api/v1/security/login -H "Content-Type: application/json" -d '{"username":"admin", "password":"admin", "refresh":true, "provider": "db"}'
```

##### Sample response which includes access_token and refresh_token.
```json
{
 "access_token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE2MDQyMTc4MzgsIm5iZiI6MTYwNDIxNzgzOCwianRpIjoiMTI4ZDE2OGQtMTZiOC00NzU0LWJiY2EtMTEyN2E2ZTNmZWRlIiwiZXhwIjoxNjA0MjE4NzM4LCJpZGVudGl0eSI6MSwiZnJlc2giOnRydWUsInR5cGUiOiJhY2Nlc3MifQ.xSWIE4lR-_0Qcu58OiSy-X0XBxuCd_59ic-9TB7cP9Y",
 "refresh_token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE2MDQyMTc4MzgsIm5iZiI6MTYwNDIxNzgzOCwianRpIjoiZjA5NTNkODEtNWY4Ni00YjY0LThkMzAtYzg5NTYzMmFkMTkyIiwiZXhwIjoxNjA2ODA5ODM4LCJpZGVudGl0eSI6MSwidHlwZSI6InJlZnJlc2gifQ.VsiRr8_ulCoQ-3eAbcFz4dQm-y6732QR6OmYXsy4HLk"
}
```
By default, JWT access token is valid for 15 mins and refresh token is valid for 30 days. You can renew the access token with the help of refresh token as shown below.

##### Renewing the Access Token
```bash
curl -X POST "http://{AIRFLOW_HOST}:{AIRFLOW_PORT}/api/v1/security/refresh" -H 'Authorization: Bearer <refresh_token>'
```
##### Examples:
```bash
curl -X POST "http://localhost:8080/api/v1/security/refresh" -H 'Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE2MDQyMTc4MzgsIm5iZiI6MTYwNDIxNzgzOCwianRpIjoiZjA5NTNkODEtNWY4Ni00YjY0LThkMzAtYzg5NTYzMmFkMTkyIiwiZXhwIjoxNjA2ODA5ODM4LCJpZGVudGl0eSI6MSwidHlwZSI6InJlZnJlc2gifQ.VsiRr8_ulCoQ-3eAbcFz4dQm-y6732QR6OmYXsy4HLk'
```
##### sample response returns the renewed access token as shown below.
```json
{
 "access_token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE2MDQyODQ2OTksIm5iZiI6MTYwNDI4NDY5OSwianRpIjoiZDhhN2IzMmYtMWE5Zi00Y2E5LWFhM2ItNDEwMmU3ZmMyMzliIiwiZXhwIjoxNjA0Mjg1NTk5LCJpZGVudGl0eSI6MSwiZnJlc2giOmZhbHNlLCJ0eXBlIjoiYWNjZXNzIn0.qY2e-bNSgOY-YboinOoGqLfKX9aQkdRjo025mZwBadA"
}
```

#### Enable API requests with JWT
##### If the Authorization header is not added in the api request，response error:
```json
{"msg":"Missing Authorization Header"}
```
##### Pass the additional Authorization:Bearer <access_token> header in the rest API request.
Examples:
```bash
curl -X GET -H 'Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE2MDQyODQ2OTksIm5iZiI6MTYwNDI4NDY5OSwianRpIjoiZDhhN2IzMmYtMWE5Zi00Y2E5LWFhM2ItNDEwMmU3ZmMyMzliIiwiZXhwIjoxNjA0Mjg1NTk5LCJpZGVudGl0eSI6MSwiZnJlc2giOmZhbHNlLCJ0eXBlIjoiYWNjZXNzIn0.qY2e-bNSgOY-YboinOoGqLfKX9aQkdRjo025mZwBadA' http://localhost:8080/rest_api/api\?api\=dag_state\&dag_id\=dag_test\&run_id\=manual__2020-10-28T17%3A36%3A28.838356%2B00%3A00
```

## Using the API
Once you deploy the plugin and restart the webserver, you can start to use the REST API. Bellow you will see the endpoints that are supported. 

**Note:** If enable RBAC, `http://{AIRFLOW_HOST}:{AIRFLOW_PORT}/rest_api/`<br>
This web page will show the Endpoints supported and provide a form for you to test submitting to them.

- [deploy_dag](#deploy_dag)
- [delete_dag](#delete_dag)

### ***<span id="deploy_dag">deploy_dag</span>***
##### Description:
- Deploy a new dag, and refresh dag to session.
##### Endpoint:
```text
http://{AIRFLOW_HOST}:{AIRFLOW_PORT}/rest_api/api?api=deploy_dag
```
##### Method:
- POST
##### POST request Arguments:
```json
{
	"workflow": {
		"name": "test_ingestion_x_35",
		"force": "true",
		"pause": "false",
		"unpause": "true",
		"dag_config": {
			"test_ingestion_x_35": {
				"default_args": {
					"owner": "harsha",
					"start_date": "2021-10-29T00:00:00.000Z",
					"end_date": "2021-11-05T00:00:00.000Z",
					"retries": 1,
					"retry_delay_sec": 300
				},
				"schedule_interval": "0 3 * * *",
				"concurrency": 1,
				"max_active_runs": 1,
				"dagrun_timeout_sec": 60,
				"default_view": "tree",
				"orientation": "LR",
				"description": "this is an example dag!",
				"tasks": {
					"task_1": {
						"operator": "airflow.operators.python_operator.PythonOperator",
						"python_callable_name": "metadata_ingestion_workflow",
						"python_callable_file": "metadata_ingestion.py",
						"op_kwargs": {
							"workflow_config": {
								"metadata_server": {
									"config": {
										"api_endpoint": "http://localhost:8585/api",
										"auth_provider_type": "no-auth"
									},
									"type": "metadata-server"
								},
								"sink": {
									"config": {
										"es_host": "localhost",
										"es_port": 9200,
										"index_dashboards": "true",
										"index_tables": "true",
										"index_topics": "true"
									},
									"type": "elasticsearch"
								},
								"source": {
									"config": {
										"include_dashboards": "true",
										"include_tables": "true",
										"include_topics": "true",
										"limit_records": 10
									},
									"type": "metadata"
								}
							}
						}
					}
				}
			}
		}
	}
}
```

##### Examples:
```bash
curl -H  'Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE2MzU2NTE1MDAsIm5iZiI6MTYzNTY1MTUwMCwianRpIjoiNWQyZTM3ZDYtNjdiYS00NGZmLThjOWYtMDM0ZTQyNGE3MTZiIiwiZXhwIjoxNjM1NjUyNDAwLCJpZGVudGl0eSI6MSwiZnJlc2giOnRydWUsInR5cGUiOiJhY2Nlc3MifQ.DRUYCAiMh5h2pk1MZZJ4asyVFC20pu35DuAANQ5GxGw' -H 'Content-Type: application/json' -d "@test_ingestion_config.json" -X POST http://localhost:8080/rest_api/api\?api\=deploy_dag```
##### response:
```json
{"message": "Workflow [test_ingestion_x_35] has been created", "status": "success"}
```

### ***<span id="delete_dag">delete_dag</span>***
##### Description:
- Delete dag based on dag_id.
##### Endpoint:
```text
http://{AIRFLOW_HOST}:{AIRFLOW_PORT}/rest_api/api?api=delete_dag&dag_id=value
```
##### Method:
- GET
##### GET request Arguments:
- dag_id - string - The id of dag.
##### Examples:
```bash
curl -X GET http://localhost:8080/rest_api/api?api=delete_dag&dag_id=dag_test
```
##### response:
```json
{
  "message": "DAG [dag_test] deleted",
  "status": "success"
}
```
