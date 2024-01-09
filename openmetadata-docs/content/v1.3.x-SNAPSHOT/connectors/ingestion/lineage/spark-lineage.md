---
title: Spark Lineage Ingestion
slug: /connectors/ingestion/lineage/spark-lineage
---

# Spark Lineage Ingestion

A spark job may involve movement/transfer of data which may result into a data lineage, to capture such lineages you can make use of `OpenMetadata Spark Agent` which you can configure with your spark session and capture these spark lineages into your OpenMetadata instance.

In this guide we will explain how you can make use of the `OpenMetadata Spark Agent` to capture such lineage.


## Requirement

To use the `OpenMetadata Spark Agent`, you will have to download the latest jar from [here](https://github.com/open-metadata/openmetadata-spark-agent/releases).

We support spark version 3.1 and above.


## Configuration

While configuring the spark session, in this guide we will make use of PySpark to demonstrate the use of `OpenMetadata Spark Agent`


{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=1 %}

Once you have downloaded the jar from [here](https://github.com/open-metadata/openmetadata-spark-agent/releases) in your spark configuration you will have to add the path to your `openmetadata-spark-agent.jar` along with other required jars to run your spark job, in this example it is `mysql-connector-java.jar`

{% /codeInfo %}



{% codeInfo srNumber=2 %}

`openmetadata-spark-agent.jar` comes with a custom spark listener i.e. `org.openmetadata.spark.agent.OpenMetadataSparkListener` you will need to add this as `extraListeners` spark configuration.

{% /codeInfo %}


{% codeInfo srNumber=3 %}

`spark.openmetadata.transport.hostPort`: Specify the host & port of the instance where your OpenMetadata is hosted.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

`spark.openmetadata.transport.type` is required configuration with value as `openmetadata`.

{% /codeInfo %}


{% codeInfo srNumber=5 %}

`spark.openmetadata.transport.jwtToken`: Specify your OpenMetadata Jwt token here. Checkout [this](https://docs.open-metadata.org/v1.2.x/deployment/security/enable-jwt-tokens#generate-token) documentation on how you can generate a jwt token in OpenMetadata.

{% /codeInfo %}


{% codeInfo srNumber=6 %}

`spark.openmetadata.transport.pipelineServiceName`: This spark job will be creating a new pipeline service of type `Spark`, use this configuration to customize the pipeline service name.

Note: If the pipeline service with the specified name already exists then we will be updating/using the same pipeline service.

{% /codeInfo %}

{% codeInfo srNumber=7 %}

`spark.openmetadata.transport.pipelineName`: This spark job will also create a new pipeline within the pipeline service defined above. Use this configuration to customize the name of pipeline.

Note: If the pipeline with the specified name already exists then we will be updating/using the same pipeline.

{% /codeInfo %}


{% codeInfo srNumber=8 %}

`spark.openmetadata.transport.pipelineSourceUrl`: You can use this configuration to provide additional context to your pipeline by specifying a url related to the pipeline.

{% /codeInfo %}

{% codeInfo srNumber=9 %}

`spark.openmetadata.transport.pipelineDescription`: Provide pipeline description using this spark configuration.

{% /codeInfo %}

{% codeInfo srNumber=10 %}

`spark.openmetadata.transport.databaseServiceNames`: Provide the comma separated list of database service names which contains the source tables used in this job. If you do not provide this configuration then we will be searching through all the services available in openmetadata.

{% /codeInfo %}


{% codeInfo srNumber=11 %}

`spark.openmetadata.transport.timeout`: Provide the timeout to communicate with OpenMetadata APIs.

{% /codeInfo %}

{% codeInfo srNumber=12 %}

In this job we are reading data from `employee` table and moving it to another table `employee_new` of within same mysql source.

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="pyspark.py" %}


```py
from pyspark.sql import SparkSession

spark = (
    SparkSession.builder.master("local")
    .appName("localTestApp")
```
```py {% srNumber=1 %}
    .config(
        "spark.jars",
        "path/to/openmetadata-spark-agent.jar,path/to/mysql-connector-java-8.0.30.jar",
    )
```
```py {% srNumber=2 %}
    .config(
        "spark.extraListeners",
        "org.openmetadata.spark.agent.OpenMetadataSparkListener",
    )
```
```py {% srNumber=3 %}
    .config("spark.openmetadata.transport.hostPort", "http://localhost:8585")
```
```py {% srNumber=4 %}
    .config("spark.openmetadata.transport.type", "openmetadata")
```
```py {% srNumber=5 %}
    .config("spark.openmetadata.transport.jwtToken", "<openmetadata-jwt-token>")
```
```py {% srNumber=6 %}
    .config(
        "spark.openmetadata.transport.pipelineServiceName", "my_pipeline_service"
    )
```
```py {% srNumber=7 %}
    .config("spark.openmetadata.transport.pipelineName", "my_pipeline_name")
```
```py {% srNumber=8 %}
    .config(
        "spark.openmetadata.transport.pipelineSourceUrl",
        "http://your.org/path/to/pipeline",
    )
```
```py {% srNumber=9 %}
    .config(
        "spark.openmetadata.transport.pipelineDescription", "My ETL Pipeline"
    )
```
```py {% srNumber=10 %}
    .config(
        "spark.openmetadata.transport.databaseServiceNames",
        "random,local_mysql",
    )
```
```py {% srNumber=11 %}
    .config("spark.openmetadata.transport.timeout", "30")
```
```py {% srNumber=12 %}
    .getOrCreate()
)

# Read table using jdbc()

# Read from MySQL Table
employee_df = (
    spark.read.format("jdbc")
    .option("url", "jdbc:mysql://localhost:3306/openmetadata_db")
    .option("driver", "com.mysql.cj.jdbc.Driver")
    .option("dbtable", "employee")
    .option("user", "openmetadata_user")
    .option("password", "openmetadata_password")
    .load()
)

# Write data to the new employee_new table
(
    employee_df.write.format("jdbc")
    .option("url", "jdbc:mysql://localhost:3306/openmetadata_db")
    .option("driver", "com.mysql.cj.jdbc.Driver")
    .option("dbtable", "employee_new")
    .option("user", "openmetadata_user")
    .option("password", "openmetadata_password")
    .mode("overwrite")
    .save()
)

# Stop the Spark session
spark.stop()
```

{% /codeBlock %}

{% /codePreview %}


Once this pyspark job get finished you will see a new pipeline service with name `my_pipeline_service` generated in your openmetadata instance which would contain a pipeline with name `my_pipeline` as per the above example and you should also see lineage between the table `employee` and `employee_new` via `my_pipeline`.


{% image
  src="/images/v1.3/connectors/spark/spark-pipeline-service.png"
  alt="Spark Pipeline Service"
  caption="Spark Pipeline Service"
 /%}


 {% image
  src="/images/v1.3/connectors/spark/spark-pipeline-details.png"
  alt="Spark Pipeline Details"
  caption="Spark Pipeline Details"
 /%}



 {% image
  src="/images/v1.3/connectors/spark/spark-pipeline-lineage.png"
  alt="Spark Pipeline Lineage"
  caption="Spark Pipeline Lineage"
 /%}
