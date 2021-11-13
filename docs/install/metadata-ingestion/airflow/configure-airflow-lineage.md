# Configure Airflow Lineage

### Install from PyPI

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
