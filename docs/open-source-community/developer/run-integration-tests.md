# Run Integration Tests

{% hint style="info" %}
Make sure OpenMetadata is up and running
{% endhint %}

## Run MySQL test

```text
cd ingestion
source env/bin/activate
cd tests/integration/mysql
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

