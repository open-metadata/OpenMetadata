#### dbt Prefix Configuration

{% codeInfo srNumber=121 %}

**dbtPrefixConfig**: Optional config to specify the bucket name and directory path where the dbt files are stored. If config is not provided ingestion will scan all the buckets for dbt files.

**dbtBucketName**: Name of the bucket where the dbt files are stored.

**dbtObjectPrefix**: Path of the folder where the dbt files are stored.

Follow the documentation [here](/connectors/ingestion/workflows/dbt/setup-multiple-dbt-projects) to configure multiple dbt projects

{% /codeInfo %}