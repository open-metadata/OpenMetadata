---
title: Understanding openmetadata-ops.sh file
description: Get started with openmetadata ops. Setup instructions, features, and configuration details inside.
slug: /developers/contribute/build-code-and-run-tests/openmetadata-ops
---

# Understanding openmetadata-ops.sh file
Learn how to run the OpenMetadata Ops in development mode by using commands.

#### Key Commands:
How to run the `openmetadata-ops.sh` file.
```shell
sh bootstrap/openmetadata-ops.sh [OPTIONS] [COMMANDS]
```

#### Options:
 1. -c, --config=<configFilePath>
 2. -d, --debug
 3. -h, --help      Show this help message and exit.
 4. -V, --version   Print version information and exit.

**Example:**
```shell
sh bootstrap/openmetadata-ops.sh --help
```

#### Commands:
 1. **migrate**         Migrates the OpenMetadata database schema and search index mappings.

 2. **reindex**         Re Indexes data into search engine from command line.

 3. **repair**          Repairs the DATABASE_CHANGE_LOG table which is used to trackall the migrations on the target database. This involves removing entries for the failed migrations and updatethe checksum of migrations already applied on the target database.

 4. **validate**        Checks if the all the migrations haven been applied on the target database.
  
 5. **drop-create**     Deletes any tables in configured database and creates a new tables based on current version of OpenMetadata. This command also re-creates the search indexes.

 6. **deploy-pipelines**  Deploy all the service pipelines.

 7. **analyze-tables**    Migrate secrets from DB to the configured Secrets Manager. Note that this does not support migrating between external Secrets Managers.

 8. **changelog**         Prints the change log of database migration.

 9. **check-connection**  Checks if a connection can be successfully obtained for the target database

 10. **info**              Shows the list of migrations applied and the pending migration waiting to be applied on the target database

 11. **migrate-secrets**   Migrate secrets from DB to the configured Secrets Manager. Note that this does not support migrating between external Secrets Managers

 12. **syncEmailFromEnv**  Sync the email configuration from environment variables

**Example:**
```shell
sh bootstrap/openmetadata-ops.sh migration
```