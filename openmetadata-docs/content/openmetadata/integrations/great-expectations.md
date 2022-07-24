---
title: Great Expectations Integration
slug: /openmetadata/integrations/great-expectations
---

# Great Expectations
Configure Great Expectations to integrate with OpenMetadata and ingest your tests results to your table service page.

## Requirements

### OpenMetadata Requirements
You will to have OpenMetadata version 0.10 or later.

To deploy OpenMetadata, follow the procedure [Try OpenMetadata in Docker](quick-start/local-deployment) or follow the [Prefect Integration](/openmetadata/integrations/prefect) guide.

Before ingesting your tests results from Great Expectations you will need to have your table metadata ingested into OpenMetadata. Follow the instruction in the [Connectors](/openmetadata/connectors) section to learn more.

### Python Requirements
You will need to install our Great Expectations submodule

```shell
pip3 install 'openmetadata-ingestion[great-expectations]'
```

## Great Expectations Setup
### Configure your checkpoint file
Great Expectations integration leverage custom actions. To be able to execute custom actions you will need to run a checkpoint file.

```yaml
[...]
action:
  module_name: metadata.great_expectations.action
  class_name: OpenMetadataValidationAction
  config_file_path: path/to/ometa/config/file/
  ometa_service_name: my_service_name
[...]
```

In your checkpoint yaml file, you will need to add the above code block in `action_list` section.

**Properties**:

- `module_name`: this is OpenMetatadata submodule name
- `class_name`: this is the name of the class that will be used to execute the custom action
- `config_file_path`: this is the path to your `config.yaml` file that holds the configuration of your OpenMetadata server
- `ometa_service_name`: [Optional] this is an optional parameter. If not specified and 2 tables have the same name in 2 different OpenMetadata services, the custom action will fail

<Image
src={"/images/openmetadata/integrations/ge-checkpoint-file.gif"}
alt="Great Expectations checkpoint file"
caption=" "
/>

**Note**

If you are using Great Expectation `DataContext` instance in Python to run your tests, you can use the `run_checkpoint` method as follows:

```python
data_context.run_checkpoint(
    checkpoint_name="my_checkpoint",
    batch_request=None,
    run_name=None,
    list_action={
        "name": "my_action_name",
        "action": {
          "module_name": "metadata.great_expectations.action",
          "class_name": "OpenMetadataValidationAction",
          "config_file_path": "path/to/ometa/config/file/",
          "ometa_service_name": "my_service_name",
        },
    ,}
)
```

### Create your `config.yaml` file
To ingest Great Expectations results in OpenMetadata, you will need to specify your OpenMetadata security configuration for the REST endpoint. This configuration file needs to be located inside the `config_file_path` referenced in step 2 and named `config.yaml`.

```yaml
hostPort: http://localhost:8585/api
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

You can use environment variables in your configuration file by simply using `{{ env('<MY_ENV_VAR>') }}`. These will be parsed and rendered at runtime allowing you to securely create your configuration and commit it to your favorite version control tool. As we support multiple security configurations, you can check out the [Enable Security](/deployment/security) section for more details on how to set the `securityConfig` part of the `yaml` file.

<Image
src={"/images/openmetadata/integrations/ge-config-yaml.gif"}
alt="Great Expectations config file"
/>

### Run your Great Expectations Checkpoint File
With everything set up, it is now time to run your checkpoint file.

```shell
great_expectations checkpoint run <my_checkpoint>
```

<Image
src={"/images/openmetadata/integrations/ge-run-checkpoint.gif"}
alt="Run Great Expectations checkpoint"
/>

### List of Great Expectations Supported Test
We currently only support a certain number of Great Expectations tests. The full list can be found in the [Tests](/openmetadata/data-quality/tests) section.

If a test is not supported, there is no need to worry about the execution of your Great Expectations test. We will simply skip the tests that are not supported and continue the execution of your test suite.