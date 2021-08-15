---
description: >-
  This guide will help install Simple Scheduler and schedule connectors for
  ingestion.
---

# Scheduler

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty and MySQL.

1. Python 3.7 or above
2. Create an env

   ```bash
   python3 -m venv env
   ```

3. Activating the enviroment

   ```bash
   source env/bin/activate
   ```
{% endhint %}

## Install dependencies

```text
cd ingestion
python3 -m venv env
source env/bin/activate
pip install '.[scheduler]'
python ingestion_scheduler/scheduler.py
```

{% hint style="warning" %}
**Note:**

Different Connectors require different dependencies, please go through [Connectors](https://docs.open-metadata.org/install/metadata-ingestion/connectors) Documentation install dependencies as needed.
{% endhint %}

## Scheduler UI

### Main Page

Loads all the Json connectors inside the pipeline directory as cron jobs.

![](../../.gitbook/assets/screenshot-from-2021-07-26-21-08-17%20%281%29%20%282%29%20%282%29%20%282%29%20%283%29%20%284%29%20%284%29%20%285%29%20%283%29%20%281%29%20%284%29.png)

### Custom run a job

* Click on **Custom Run** button under Action column of the jobs.
* Click on **Run.**
* The Job will start running the ingestion.

![After Clicking &apos;Custom Run&apos; Button](../../.gitbook/assets/screenshot-from-2021-07-26-21-08-30.png)

**Status of an executed job**

* Click on **Executions** tab under Navigation Bar.

![Status of the executions](../../.gitbook/assets/screenshot-from-2021-07-26-23-57-46.png)

