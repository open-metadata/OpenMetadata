---
title: How do the Upgrade & Backup work?
slug: /deployment/upgrade/how-does-it-work
---

# How do the Upgrade & Backup work?

If this is the first time you are trying to upgrade OpenMetadata, or you just have some doubts on how the
backup and upgrade process work, this is the place to be. We will cover:

- What is being backed up?
- When should we restore?
- What happens during the migration?

## Architecture Review

Let's start with a simplified design review of OpenMetadata. You can find further details [here](/main-concepts/high-level-design),
but we'll now focus on the Server & the Database:

{% image src="/images/v1.3/deployment/upgrade/how-does-it-work/upgrade-simple.drawio.png" alt="simple architecture" /%}

All the metadata is stored in a MySQL or Postgres instance. The shape of the data is managed using [Flyway](https://flywaydb.org/), and the migration
scripts are handled [here](https://github.com/open-metadata/OpenMetadata/tree/main/bootstrap/sql).

In a nutshell, we have a data model in which we store all of this information. The definition of this model (table names,
schemas,...) is managed using Flyway migrations. **In every release, the structure of this data model can change**. This means that
the shape of the database is tightly coupled to your OpenMetadata Server version.

## 1. What is being backed up?

{% note %}

You can find all the necessary information on how to run the backups [here](/deployment/backup-restore-metadata).

{% /note %}

When we backup the data, we are creating an SQL file that follows the shape of the database of a specific version. Thus, if we have
some issues on our instance, and we ever need to restore that data, it will only fit to a database with that same version shape.

{% image src="/images/v1.3/deployment/upgrade/how-does-it-work/upgrade-backup.drawio.png" alt="backup" /%}

## 2. When should we restore?

Now that we understand what is being backed up and how it looks like, when (and where) should we restore?

- **When**: We restore the data if we need to get back in time. Restoring is never needed during the upgrade process.
- **Where**: We will restore the data to a clean database with the Flyway migrations at the same version as the backed up data.
  The usual process will be:
  - We start with a clean database (no tables in it).
  - We run the migrations ([docs](/deployment/bare-metal#4.-prepare-the-openmetadata-database-and-indexes))
     or we start the OpenMetadata server, which will automatically run the migrations.
  - With the server stopped, we [restore](/deployment/backup-restore-metadata#restore-metadata) the data.

{% note %}

Note that the restore process will not work if we try to restore some data taken from version X to a database shaped with version Y.

{% /note %}

## 3. What happens during the migration?

We have been explaining how each OpenMetadata Server relies on a specific data model to store the metadata. What happens
when we upgrade from version X to Y?

{% image src="/images/v1.3/deployment/upgrade/how-does-it-work/upgrade-migrate.drawio.png" alt="backup" /%}

The migration process will take care of getting the data shaped as X and transform it to the Y shape. After the migration is done,
the server in version Y will be able to run properly.

