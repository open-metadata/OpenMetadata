# Run Integration Tests

{% hint style="info" %}
Make sure OpenMetadata is up and running. Refer to instructions [building and running](build-code-run-tests.md).
{% endhint %}

## Run MySQL test

Run the following commands from the top-level directory
```text
python3 -m venv /tmp/venv
source /tmp/venv/bin/activate
pip install -r ingestion/requirements.txt
pip install -e ingestion
pip install pytest
pip install pytest-docker
cd ingestion/tests/integration/mysql
pytest -s -c /dev/null
```

## Run MsSQL test

```text
cd ingestion
source env/bin/activate
cd tests/integration/mssql
pytest -s -c /dev/null
```

## Run Postgres test

```text
cd ingestion
source env/bin/activate
cd tests/integration/postgres
pytest -s -c /dev/null
```

## Run LDAP test

```text
cd ingestion
source env/bin/activate
cd tests/integration/ldap
pytest -s -c /dev/null
```

## Run Hive test

```text
cd ingestion
source env/bin/activate
cd tests/integration/hive
pytest -s -c /dev/null
```

