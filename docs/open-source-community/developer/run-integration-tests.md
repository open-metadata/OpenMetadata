# Run Integration Tests

{% hint style="info" %}
**The integration tests don't work at the moment.**

Make sure OpenMetadata is up and running. Refer to instructions [building and running](build-code-run-tests/).
{% endhint %}

## Run MySQL test

Run the following commands from the top-level directory

```
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

```
cd ingestion
source env/bin/activate
cd tests/integration/mssql
pytest -s -c /dev/null
```

## Run Postgres test

```
cd ingestion
source env/bin/activate
cd tests/integration/postgres
pytest -s -c /dev/null
```

## Run LDAP test

```
python3 -m venv /tmp/venv
source /tmp/venv/bin/activate
pip install -r ingestion/requirements.txt
pip install -e ingestion
pip install pytest
pip install pytest-docker
cd ingestion/tests/integration/ldap
pytest -s -c /dev/null
```

## Run Hive test

```
python3 -m venv /tmp/venv
source /tmp/venv/bin/activate
pip install -r ingestion/requirements.txt
pip install -e ingestion
pip install pytest
pip install pytest-docker
pip install pyhive thrift sasl thrift_sasl
cd ingestion/tests/integration/hive
pytest -s -c /dev/null
```
