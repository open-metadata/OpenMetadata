How to Add a New Application

## Create App Config

in `openmetadata-spec/src/main/resources/json/schema/entity/applications/configuration` define the json schema representing your application configuration.
- external: these are applications that will run externaly (e.g. Airflow). If your application has its execution logic defined in Python, this is where the code logic should live
- internal: these will application will be executed through the Qwartz scheduler form the application itself. The code logic for this application will be written in Java.

you can follow this naming convention <yourAppName>AppConfig.json


## Define default app config

in `openmetadata-service/src/main/resources/json/data/app` define the default setting of your application. Create a new json following this naming convention `<youAppName>Application.json`

## Define your app in the Application Marketplace

In `openmetadata-service/src/main/resources/json/data/appMarketPlaceDefinition`, define the elements of your application as they will appear in the app marketplace.

Note that you can specify a `"sourcePythonClass": “path.to.python.class”` if your application code logic is defined in Python

## Add the config to the UI

In `openmetadata-ui/src/main/resources/ui/src/utils/ApplicationSchemas` add the config for your application so it can be rendered from the UI. Follow this naming convention `<yourAppName>Application.json`

## Implement Java class
In `openmetadata-service/src/main/java/org/openmetadata/service/apps/bundles` implement the java class corresponding to your application.

Not that the value of the `className` from step 3 should match the class name / path defined at this stage

## [Optional] Implement Python logic
If you have defined an external application, you need to create the relevant Python class that implements the logic. The path of the class needs to match the value of `sourcePythonClass`. You will need to inherit from the `AppRunner` class and at minimum implement the `def run` method.

e.g. `ingestion/src/metadata/applications/observability_data_exporter/app.py`

## [Optional] Disabling the application
In `openmetadata-service/src/main/resources/applications` you can add private configuration to your application. You also have the possibility to disable the application by default so that a feature flag needs to be used to allow users to install the application. Below is an example of a the feature flag (preview) as well as the private config.

```
preview: false
parameters:
  instance: <instance>
  token: <token?
  omURL: <omURL>
```

Setting `preview: false` will prevent users from being able to install the application. The private configuration parameters can be set at `openmetadata-spec/src/main/resources/json/schema/entity/applications/configuration/private`

