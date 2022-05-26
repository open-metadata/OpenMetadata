## openmetadata-ingestion[great-epxectations]
### How to use this OM module with Great Expectations
1. install open-metadata great expectations subpackage
```
pip install openmetadata-ingestion[great-expectations]
```

2. In your `checkpoints` add the following to your checkpoint file

```yml
    action:
      module_name: metadata.great_expectations.action
      class_name: OpenMetadataValidationAction
      config_file_path: path/to/ometa/config/file/confg.yml
      ometa_service_name: my_service_name
```
`ometa_service_name` is optional. If you don't specify it, when looking for the table entity it will look for the service name where the table entity name exist. If the same table entity name exists in more than 1 service name it will raise an error.


The `config.yml` file holds connection details to your Open Metadata instance, e.g.

```yml
hostPort: http://localhost:8585
authProvider: azure
apiVersion: v1
securityConfig:
  clientSecret: {{ env('CLIENT_SECRET') }}
  authority: my
  clientId: 123
  scopes:
    - a
    - b
```

If you are using a specific security config for your open metadata server you can check [this page](https://docs.open-metadata.org/deploy/secure-openmetadata) for the implementation details and what parameters to add to your config file.