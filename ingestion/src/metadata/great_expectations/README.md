## openmetadata-ingestion[great-epxectations]
### How to use this module in Great Expectations
In your `checkpoints` add the following to your checkpoint file

```yml
    action:
      module_name: metadata.great_expectations.action
      class_name: OpenMetadataValidationAction
      ometa_server: http://localhost:8585/api
```

The above parameters are the only required ones. If you are using a specific security config for your open metadata server you can check [this page](https://docs.open-metadata.org/deploy/secure-openmetadata) for the implementation details and what parameters to add to your checkpoint file.