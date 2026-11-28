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

At runtime, OpenMetadata still attempts spaCy's download when a model is missing locally. If a model cannot load, classification is disabled for the rest of that run. Sampling and configured sample writes continue, then the workflow reports failure. Tags already saved and existing manual tags remain; pending tags for the interrupted entity are discarded. The failure identifies the model and repair command. Repair or provision the model in the runner's Python environment, then rerun the workflow to retry classification.

The status file and pipeline state report failure even when the CLI's explicit `workflowConfig.raiseOnError: false` setting suppresses the final exception.

## Use a preinstalled custom NER model

To use a custom spaCy NER model for one classification language, set `OM_PII_SPACY_MODEL_<LANG>` in the environment of the ingestion runner. `<LANG>` is the uppercase workflow language identifier. For example:

```bash
export OM_PII_SPACY_MODEL_EN=/opt/models/company_en_ner
```

The value can be the name of an installed spaCy package or a local spaCy model path. For a workflow set to `any`, recognizers configured for `any` use `OM_PII_SPACY_MODEL_ANY` if set and otherwise follow English model selection. Recognizers configured for a specific language use their own language override, such as `OM_PII_SPACY_MODEL_ES`.

Overrides affect runtime loading only. `metadata install-classification-models` and `AUTO_CLASSIFICATION_LANGUAGES` continue to provision the release-pinned OpenMetadata models, not arbitrary override values. OpenMetadata never downloads an override at runtime: install or mount the selected model in the same Python environment and as the same user that runs ingestion, then restart the runner after changing the environment. If the override cannot load, classification follows the normal failure behavior and reports that the configured local model must be installed.
