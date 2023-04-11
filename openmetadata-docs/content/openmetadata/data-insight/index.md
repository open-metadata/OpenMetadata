---
title: Data Insights
slug: /openmetadata/data-insight
---

# Data Insights
Platform adoption is an important element for teams implementing OpenMetadata. With the data insights feature organization can drive the adoption of OpenMetadata by monitoring its usage and setting up company wide KPIs.

## Data Insight Reports
OpenMetadata offers a suite of reports providing platform analytics around specific areas.

### Data Assets
The Data Assets reports display important metrics around your data assets in OpenMetadata.

**Total Data Assets**  
This chart represents the total number of data assets present in OpenMetadata. It offers a view of your data assets broken down by asset type (i.e. Database, Table, ML Model, etc.)

<Image
    src="/images/openmetadata/data-insight/total-data-assets.png"
    alt="Total Data Assets Chart"
    caption="Total Data Assets Chart"
/>

**Percentage of Data Assets with Description**  
This chart represents the percentage of data assets present in OpenMetadata with a description. For Table asset type, this condition is true only if the table and column description are filed. It allows you to quickly view the description coverage for your data assets in OpenMetadata.

<Image
    src="/images/openmetadata/data-insight/percentage-description.png"
    alt="Percentage of Assets with Description"
    caption="Percentage of Assets with Description"
/>

**Percentage of Data Assets with Owners**  
This chart represents the percentage of data assets present in OpenMetadata with an owner assigned. Data assets that do not support assigning an owner will not be counted in this percentage. It allows you to quickly view the ownership coverage for your data assets in OpenMetadata.

<Image
    src="/images/openmetadata/data-insight/percentage-owner.png"
    alt="Percentage of Assets with Owner Assigned"
    caption="Percentage of Assets with Owner Assigned"
/>

**Total Data Assets by Tier**  
This chart represents a broken down view of data assets by Tiers. Data Assets with no tiers assigned are not included in this. It allows you to quickly view the breakdown of data assets by tier.

<Image
    src="/images/openmetadata/data-insight/data-assets-by-tier.png"
    alt="Data Asset by Tier"
    caption="Data Asset by Tier"
/>

### App Analytics
The App Analytics report provides important metrics around the usage of OpenMetadata.

**Most Viewed Data Assets**  
This chart shows the top 10 data assets the most viewed in your platform. It offers a quick view to understand what are the data assets with the most interest in your organization.

<Image
    src="/images/openmetadata/data-insight/most-viewed-assets.png"
    alt="Most Viewed Assets"
    caption="Most Viewed Assets"
/>

**Page views by data assets**  
This chart shows the total number of page views by asset type. This allows you to understand which asset familly drives the most interest in your organization

<Image
    src="/images/openmetadata/data-insight/views-by-assets.png"
    alt="Page Views by Assets"
    caption="Page Views by Assets"
/>

**Daily active users on the platform**    
This chart shows the number of daily active users on your platform. Active users are users with at least one session. This report allows to understand the platform usage and see how your organization leverage OpenMetadata.

<Image
    src="/images/openmetadata/data-insight/daily-active-users.png"
    alt="Daily Active Users"
    caption="Daily Active Users"
/>

**Most Active Users**    
This chart shows the top 10 most active users. These users are your power users in your organization. They can be turned into evangelist to promote OpenMetadata inside your company.

<Image
    src="/images/openmetadata/data-insight/most-active-users.png"
    alt="Daily Active Users"
    caption="Daily Active Users"
/>

### Setting up Data Insight Workflow
**Step 1**  
Navigate to `settings > Metadata > OpenMetadata Service`.

<Image
    src="/images/openmetadata/data-insight/metadata-nav.png"
    alt="Metadata Service Page"
    caption="Metadata Service Page"
/>

On the `OpenMetadata Service` click on `Add Ingestion > Add Data Insight Ingestion`

<Image
    src="/images/openmetadata/data-insight/data-insight-add-ingestion.png"
    alt="Add Data Insight Ingestion"
    caption="Add Data Insight Ingestion"
/>

**Step 2**  
Pick a name for your ingestion workflow or leave it as is.

<Image
    src="/images/openmetadata/data-insight/data-insight-ingestion-name.png"
    alt="Data Insight Ingestion Name"
    caption="Data Insight Ingestion Name"
/>

Add any elasticsearch configuration relevant to your setup. Note that if you are deploying OpenMetadata with no custom elasticsearch deployment you can skip this configuration step.

<Image
    src="/images/openmetadata/data-insight/data-insight-ingestion-es-config.png"
    alt="Data Insight Ingestion ES Config"
    caption="Data Insight Ingestion ES Config"
/>

Choose a schedule exection time for your workflow. The schedule time is displayed in UTC. We recommend to run this workflow overnight or when activity on the platform is at its lowest to ensure accurate data.

<Image
    src="/images/openmetadata/data-insight/data-insight-ingestion-schedule.png"
    alt="Data Insight Ingestion Schedule"
    caption="Data Insight Ingestion Schedule"
/>

**Step 3**  
Navigate to the `Insights` page. You should see your data insights reports. Note that if you have just deployed OpenMetadata, `App Analytic` data might not be present. `App Analytic` data are fetched from the previous day (UTC).

## Data Insight KPIs
While data insights reports gives an analytical view of OpenMetadata platform, KPIs are here to drive platform adoption. 

<Image
    src="/images/openmetadata/data-insight/data-insight-kpi.png"
    alt="Data Insight KPI"
    caption="Data Insight KPI"
/>

### KPIs Categories

**Completed Description**  
Available as an absolute or relative (percentage) value, this KPI measures the description coverage of your data assets in OpenMetadata. 

**Completed Ownership**  
Available as an absolute or relative (percentage) value, this KPI measures the ownershi[] coverage of your data assets in OpenMetadata.

### Adding KPIs
On the `Insights` page, click on `Add KPI`. This will open the KPI configuration page where the following required configuration elements need to be set:
- `Name`: name of your KPI
- `Select a chart`: this links the KPI to one of the chart present in the data insight reports
- `Select a metric type`: you can choose between `PERCENTAGE` or `NUMBER`. The former will be a relative value while the latter an absolute value
- `Start date` / `End date`: this will determine the start and end date of your KPI. It sets an objective for your organization

<Image
    src="/images/openmetadata/data-insight/configure-kpi.png"
    alt="KPI Configuration"
    caption="KPI Configuration"
/>

# Run Data Insights using the Airflow SDK 

### 1. Define the YAML Config

This is a sample config for Data Insights:

```yaml
source:
  type: dataInsight
  serviceName: OpenMetadata
  sourceConfig:
    config:
      type: MetadataToElasticSearch
processor:
  type: data-insight-processor
  config: {}
sink:
  type: elasticsearch
  config:
    es_host: localhost
    es_port: 9200
    recreate_indexes: false
workflowConfig:
  loggerLevel: DEBUG
  openMetadataServerConfig:
    hostPort: "<OpenMetadata host and port>"
    authProvider: openmetadata
    securityConfig:
      jwtToken: '{bot_jwt_token}'
```

#### Source Configuration - Source Config

- To send the metadata to OpenMetadata, it needs to be specified as `type: MetadataToElasticSearch`.


#### processor Configuration

- To send the metadata to OpenMetadata, it needs to be specified as `type: data-insight-processor`.

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: openmetadata
    securityConfig:
      jwtToken: '{bot_jwt_token}'
```

We support different security providers. You can find their definitions [here](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-spec/src/main/resources/json/schema/security/client).
You can find the different implementation of the ingestion below.

### 2. Prepare the Data Insights DAG

Create a Python file in your Airflow DAGs directory with the following contents:

```python
import pathlib
import yaml
from datetime import timedelta
from airflow import DAG
from metadata.data_insight.api.workflow import DataInsightWorkflow

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from metadata.config.common import load_config_file
from airflow.utils.dates import days_ago

default_args = {
    "owner": "user_name",
    "email": ["username@org.com"],
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=60)
}

config = """
<your YAML configuration>
"""

def metadata_ingestion_workflow():
    workflow_config = yaml.safe_load(config)
    workflow = DataInsightWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()

with DAG(
    "sample_data",
    default_args=default_args,
    description="An example DAG which runs a OpenMetadata ingestion workflow",
    start_date=days_ago(1),
    is_paused_upon_creation=False,
    schedule_interval='*/5 * * * *',
    catchup=False,
) as dag:
    ingest_task = PythonOperator(
        task_id="ingest_using_recipe",
        python_callable=metadata_ingestion_workflow,
    )
```


# Run Elasticsearch Reindex using the Airflow SDK 

### 1. Define the YAML Config

This is a sample config for Elasticsearch Reindex:

```yaml
source:
source:
  type: metadata_elasticsearch
  serviceName: openMetadata
  serviceConnection:
    config:
      type: MetadataES
  sourceConfig:
    config: {}
sink:
  type: elasticsearch
  config:
    es_host: localhost
    es_port: 9200
    recreate_indexes: true
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
```

### 2. Prepare the Ingestion DAG

Create a Python file in your Airflow DAGs directory with the following contents:

```python
import pathlib
import yaml
from datetime import timedelta
from airflow import DAG

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from metadata.config.common import load_config_file
from metadata.ingestion.api.workflow import Workflow
from airflow.utils.dates import days_ago

default_args = {
    "owner": "user_name",
    "email": ["username@org.com"],
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=60)
}

config = """
<your YAML configuration>
"""

def metadata_ingestion_workflow():
    workflow_config = yaml.safe_load(config)
    workflow = Workflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()

with DAG(
    "sample_data",
    default_args=default_args,
    description="An example DAG which runs a OpenMetadata ingestion workflow",
    start_date=days_ago(1),
    is_paused_upon_creation=False,
    schedule_interval='*/5 * * * *',
    catchup=False,
) as dag:
    ingest_task = PythonOperator(
        task_id="ingest_using_recipe",
        python_callable=metadata_ingestion_workflow,
    )
```
