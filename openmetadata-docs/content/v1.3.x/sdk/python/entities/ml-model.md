---
title: ML Model
slug: /sdk/python/entities/ml-model
---

# ML Model
Let's dive deeper into the ML Model (`MlModel`) Entity shape and usage with the Python SDK.

## Introduction

When we are talking about Machine Learning tooling there are some projects that automatically come to our mind: [Mlflow](https://mlflow.org/), [TFX](https://www.tensorflow.org/tfx/), [Kubeflow](https://www.kubeflow.org/), [SageMaker](https://aws.amazon.com/sagemaker/)...

The main goal of these solutions is to enable Data Scientists and Machine Learning practitioners to handle the models' lifecycle. As a short summary (not taking into account all the great DevOps work and more specific features), this means:

- Preparing **pipelines** that extract the data from the sources & run the Feature Engineering.
- **Train** multiple models with different inputs and hyperparameters in external computes.
- **Record** all the experiments, their configurations and metrics.
- **Serve** the models or store them externally.

The main focus is then empowering the teams and organising their working approach (usually in short fast-paced cycles), treating all of this in **isolation**. The **metadata** captured by these tools is purely functional: model name, Python/conda environment used, hyperparameter configuration, the signature of the inputs, etc.

Long-story-short: These are great tools to build autonomous, powerful and scalable ML Platforms and/or MLOps processes.

## OpenMetadata & ML
What we are trying to build with OpenMetadata and ML Models is, by no means, a replacement of those tools or the information they provide. Data Science teams NEED structured experimentation and the metadata processing and discovery provided by the projects mentioned above.

Instead, we want to look at ML Models from a different lens: **Where do ML Models fit within a Data Platform?** While - let's call them "lifecycle tools" - give the underlying view of the modelling process, we want to bring **context** and **relationships**.

There are some common questions with lifecycle tools, such as _Where (URL) is the MlModel hosted_, but we are bringing in a product and platform management view:

- Where can we find the dashboards showing the performance evolution of our PROD algorithms? -> **Trust** & **transparency**
- What tables/sources are being used? -> **Lineage** and **traceability**
- Are we using sensitive data? -> **Governance**

This information, together with the rest of the features brought by OpenMetadata, lets us also manage topics such as schema changes in the sources or feature drifts, with the corresponding alerting systems.

While we can already extract certain pieces of information automatically via our Connectors (e.g., [Mlflow](/connectors/ml-model/mlflow)), there are attributes that we'll need to fill in by ourselves. Thanks to the [Solution Design](/main-concepts/high-level-design) of OpenMetadata and the [Python SDK](/sdk/python), this is going to be a rather easy task that will unlock the full power of your **organization's metadata**.

## Properties
Now that we have a clearer view of what we are trying to achieve, let's jump into a deeper view on the `MlModel` Entity [definition](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/data/mlmodel.json):

- The `name` and `algorithm` are the only required properties when [creating](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/api/data/createMlModel.json) an `MlModel`. We can just bring the top shell to the catalogue automatically and then choose which models we want to enrich.
- The `dashboard` is a reference to a Dashboard Entity present in OpenMetadata (what we call an `EntityReference`). This should be a dashboard we have built that shows the evolution of our performance metrics. The **transparency** on ML services is integral, and that is why we have added it to the `MlModel` properties.
- A server with the URL on where to reach the model **endpoint**, to `POST` input data or retrieve a prediction.
- The mlStore specifies the **location** containing the model. Here we support both passing a URI with the object (e.g. `pkl`) location and/or a Docker image in its repository.
- With `mlHyperParameters` we can add the `name`, `value` and `description` of the used hyperparameters.

On top of this information, we can also have common metadata attributes, such as the Owner, tags, followers or **versioning**.

So far so good, but we are missing interesting points:

- What are my model features?
- How do I link these features to their origin/sources?
- What do you mean by "versioning"?

## ML Features
When talking about the `MlModel` features and how to inform them, we have made an interesting distinction:

- On the one hand, there are the results of Feature Engineering as the predictors used to train the model,
- On the other, the actual sources that the predictors are based on.

Being able to track both sides of a feature is a powerful way to know how our algorithm uses the Data Platform. This will help us show feature definitions as well as keep track of their origins.

{% note %}

To fully understand what we are going to show now, it would be interesting for the reader to make sure to visit the  section.

{% /note %}

Let's create an example of an MlFeature:

```python
MlFeature(
    name="persona",
    dataType=FeatureType.categorical,
    featureAlgorithm="PCA",
)
```

Some properties that we can define when instantiating an `MlFeature` are the name, the `dataType` and the `featureAlgorithm`. Now, the question is: Are we being thorough in describing what is really going on? Are we going to be able to detect at any point in the future if this model is based on biased predictors (such as gender)?

Here we want to give more **depth**. In order to do so, we can inform another property of the `MlFeature`, which are the `MlFeatureSource`s. The idea is that any feature can be based on an arbitrary number of real/physical sources (e.g., the columns of a Table), and informing this field will allow us to obtain this **relationship**.

If we add this extra information, our feature will look like this:

```python
MlFeature(
    name="persona",
    dataType=FeatureType.categorical,
    featureSources=[
        FeatureSource(
            name="age",
            dataType=FeatureSourceDataType.integer,
            dataSource=EntityReference(
                id=table1_entity.id, type="table"
            ),
        ),
        FeatureSource(
            name="education",
            dataType=FeatureSourceDataType.string,
            dataSource=EntityReference(
                id=table2_entity.id, type="table"
            ),
        ),
        FeatureSource(
            name="city", dataType=FeatureSourceDataType.string
        ),
    ],
    featureAlgorithm="PCA",
)
```

Note how we added a list of `FeatureSource`, with values such as `name`, `dataType` (regarding the source type, not the categorical/numerical distinction of the `MlFeature`) and an `EntityReference` as the `dataSource`.

Thanks to this extra piece of information, we now can run the following method on our `MlModel` instance:

```python
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig

server_config = MetadataServerConfig(api_endpoint="http://localhost:8585/api")
metadata = OpenMetadata(server_config)

metadata.add_mlmodel_lineage(model=my_mlmodel_entity)
```

This call will register the **Lineage** information between our MlModel instance and the tables referenced in the dataSources. Then, we will be able to explore these relationships either via the API or the UI.

If we also have ingested the Lineage from the different Tables in our platform as well as how they relate to the data processing Pipelines, we can obtain a global end-to-end view on our ML Model and all its dependencies.

## Versioning
One of the key features of OpenMetadata is the ability to version our Entities. Being able to keep track of schema changes or any community updates and having an alerting system on top can be life-saving.

In the [Solution Design](/main-concepts/high-level-design#example-1-updating-columns-of-a-table), we discussed the versioning example on how a Table reacts to adding or deleting columns in terms of its version. How do we manage versions for our MlModels?

Based on the experimentation nature of the ML field, it does not make sense to receive an alert when playing around with the model features. Therefore, we are using **major** version changes when any of the following properties are updated:

- Changes in the algorithm might mean uneven results when comparing predictions (or if handled poorly different outcomes)
- Changes to the server can enable/break integrations to the ML prediction systems.

## Summary
In this doc, we have seen the role that OpenMetadata serves from a Machine Learning perspective and its purpose in giving the vision of ML models inside the Data Platform.

We have shown how to use the Python API to enrich the models' metadata and add the lineage information with its related Entities and how the versioning will respond to changes.

For further information on the properties, do not hesitate to review the [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/data/mlmodel.json) and for examples and usages with the Python API, you can take a look at our [integration tests](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/tests/integration/ometa/test_ometa_mlmodel_api.py).
