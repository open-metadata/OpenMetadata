---
title: How to enable Azure Auth
slug: /deployment/azure-auth
collate: false
---

# AZURE resources on Postgres/MySQL Auth
[Azure Reference Doc](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-extensions#how-to-use-postgresql-extensions)

# Requirements

1. Azure Postgres or MySQL Cluster with auth enabled
2. User on DB Cluster with authentication enabled

# How to enable Azure Auth on postgresql

Set the environment variables

```Commandline
  DB_PARAMS="azure=true&allowPublicKeyRetrieval=true&sslmode=require&serverTimezone=UTC" 
  DB_USER_PASSWORD=none
```

Either through helm (if deployed in kubernetes) or as env vars.

{% note %}

The `DB_USER_PASSWORD` is still required and cannot be empty. Set it to a random/dummy string.

{% /note %} 
