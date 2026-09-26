# Provision Auto Classification models

Auto Classification uses spaCy language models to analyze samples. Provision the models while network access is available, then run classification in the restricted environment.

## Install models

Install `openmetadata-ingestion[pii-processor]` in the same Python environment and as the same user that runs the classification workflow. Then run:

```bash
metadata install-classification-models --languages en,es
```

The command does not need a workflow configuration, OpenMetadata server, or Airflow.

## Select languages

Pass a nonempty comma-separated list of lowercase language identifiers that match the workflow, such as `en,es`. Surrounding whitespace is accepted; uppercase, unknown, and empty entries are rejected before installation.

`any` provisions the English model. A workflow using `any` can also initialize recognizers for specific languages. For an air-gapped workflow, provision every recognizer language it uses, for example `any,es,ar`.

## Docker images

Ingestion and Airflow image builds accept the optional `AUTO_CLASSIFICATION_LANGUAGES` build argument:

```bash
docker build -f ingestion/Dockerfile \
  --build-arg INGESTION_DEPENDENCY=postgres,pii-processor \
  --build-arg AUTO_CLASSIFICATION_LANGUAGES=en,es \
  -t ingestion-with-classification:local .

docker build -f ingestion/operators/docker/Dockerfile \
  --build-arg INGESTION_DEPENDENCY=postgres,pii-processor \
  --build-arg AUTO_CLASSIFICATION_LANGUAGES=en,es \
  -t ingestion-runner-with-classification:local .
```

Run these commands from the repository root. The build argument's empty default installs no models. When supplying it, ensure the selected ingestion dependencies include `pii-processor`.

To extend a published ingestion image instead, build a derived image from a release tag that already has the `pii-processor` extra installed:

```dockerfile
FROM docker.getcollate.io/openmetadata/ingestion-base:2.0.0
RUN metadata install-classification-models --languages en,es
```

Replace the example tag with the version used by your deployment. The same provisioning step works with the published Airflow ingestion image (`docker.getcollate.io/openmetadata/ingestion:<release-tag>`). A build argument passed to a derived image does not affect its published base image; run the command in the derived Dockerfile as shown.

## External Python and Airflow environments

Install the ingestion package with the `pii-processor` extra into the Python environment used by the workflow, then provision models there before starting the workflow:

```bash
python -m pip install 'openmetadata-ingestion[pii-processor]'
metadata install-classification-models --languages en,es
```

For an externally managed Airflow deployment, run these commands as the Airflow task's user in its Python environment during environment setup. If Airflow launches a separate ingestion runner, provision the runner image or environment instead. Pin the ingestion package to the OpenMetadata release used by the deployment.

## Re-runs and failures

The command installs the model versions selected by your OpenMetadata release. It reuses a healthy matching model; a different installed version is replaced with the selected version. A broken matching installation fails with repair guidance.

Provisioning stops at the first install or verification failure. Models completed before that failure remain installed, so correct the reported issue and rerun the command.

Provisioning downloads exact upstream wheel URLs. Build or install while connected; a private pip index alone does not redirect those URLs. In a disconnected environment, preinstall matching model wheels and dependencies through your own artifact distribution.

At runtime, a missing model keeps the existing behavior: OpenMetadata warns, attempts spaCy's download, and fails the enabled classification workflow if it cannot load the model.
