# Configure Airflow Lineage

### Install the Python Module

Prior to installing the Python module, ensure that you have a virtual environment set up and activated. Run the following command to install the Python module for Airflow.

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[airflow]'
```
{% endtab %}
{% endtabs %}

### Adding Lineage Config

{% code title="airflow.cfg" %}
```
[lineage]
backend = airflow_provider_openmetadata.lineage.openmetadata.OpenMetadataLineageBackend
airflow_service_name = local_airflow_3
openmetadata_api_endpoint = http://localhost:8585/api
auth_provider_type = no-auth
```
{% endcode %}
