---
title: Upgrade on Bare Metal | Official Documentation
description: Learn how to upgrade deployments on bare-metal infrastructure with versioning steps, rollback plans, and configuration tips.
slug: /deployment/upgrade/bare-metal
collate: false
---

# Upgrade on Bare Metal

This guide will help you upgrade an OpenMetadata deployment using release binaries.

## Requirements 

This guide assumes that you have an OpenMetadata deployment that you installed and configured following the
[Bare Metal deployment](/deployment/bare-metal) guide.

{% partial file="/v1.7/deployment/upgrade/upgrade-prerequisites.md" /%}

# Upgrade process

## Step 1: Download the binaries for the release you want to install

OpenMetadata release binaries are maintained as GitHub releases.

To download a specific release binary:

- Visit [github.com/open-metadata/OpenMetadata/releases](https://github.com/open-metadata/OpenMetadata/releases). The latest
  release will be at the top of this page. 
- Locate the Assets' section for the release you want to upgrade to. 
- Download the release binaries. The release binaries will be in a compressed tar file named using the following 
  convention, `openmetadata-x.y.z.tar.gz` Where `x`, `y`, `z` are the major, minor, and patch release numbers, respectively.

## Step 2: Extract the release binaries from the download file

Using the command-line tool or application of your choice, extract the release binaries. 

For example, to extract using `tar`, run the following command. 

```commandline
tar xfz openmetadata-*.tar.gz
```

This will create a directory with the same name as the download file minus the `.tar` and `.gz` extensions.

## Step 3: Navigate into the directory created by extracting the release binaries

Change into the new directory by issuing a command similar to the following.

```commandline
cd openmetadata-x.y.z
```

For example, to navigate into the directory created by issuing the tar command above, you would run the following
command.

```commandline
cd openmetadata-1.1.0
```

## Step 4: Stop the OpenMetadata server

OpenMetadata ships with a few control scripts. One is `openmetadata.sh`. This script enables you to start, stop, and
perform other deployment operations on the OpenMetadata server. 

Most OpenMetadata releases will require you to migrate your data to updated schemas. 

Before you migrate your data to the new release you are upgrading to, stop the OpenMetadata server from the
directory of your current installation by running the following command:

```commandline
./bin/openmetadata.sh stop
```

## Step 5: Migrate the database schemas and ElasticSearch indexes

The `bootstrap/openmetadata-ops.sh` script enables you to perform a number of operations on the OpenMetadata database (in
MySQL) and index (in Elasticsearch).

```commandline
./bootstrap/openmetadata-ops.sh migrate
```


## Step 6: Restart the OpenMetadata server

Once you've dropped and recreated your data in the new version, restart the OpenMetadata server using the new release
binaries. You may restart the server by running the following command.

```commandline
./bin/openmetadata.sh start
```

{% partial file="/v1.7/deployment/upgrade/post-upgrade-steps.md" /%}
