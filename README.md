<div align="center">
  <img src="https://i.imgur.com/5VumwFS.png" align="center" alt="OpenMetadata" height="90"/>
  <hr />

[![Build Status](https://github.com/open-metadata/OpenMetadata/actions/workflows/maven-build.yml/badge.svg?event=push)](https://github.com/open-metadata/OpenMetadata/actions/workflows/maven-build.yml)
[![Release](https://img.shields.io/github/release/open-metadata/OpenMetadata/all.svg)](https://github.com/open-metadata/OpenMetadata/releases)
[![Commit](https://img.shields.io/github/commit-activity/m/open-metadata/OpenMetadata)](Commit)
[![Twitter Follow](https://img.shields.io/twitter/follow/open_metadata?style=social)](https://twitter.com/intent/follow?screen_name=open_metadata)
<a href="https://join.slack.com/t/openmetadata/shared_invite/zt-oiq9s1qd-dHHvw4xjpnoRV1QQrq6vUg"><img src="https://img.shields.io/badge/slack-join-E01E5A?logo=slack" alt="Join us on Slack" height="22"/></a>
[![License](https://img.shields.io/github/license/open-metadata/OpenMetadata.svg)](LICENSE)

</div>

- [What is OpenMetadata?](#what-is-openmetadata )
- [Try our Sandbox](#try-our-sandbox)
- [Install & Run](#install-and-run-openmetadata)
- [Roadmap](docs/roadmap.md)
- [Documentation and support](#documentation-and-support)
- [Contributors](#contributors)
- [License](#license)

# What is OpenMetadata?
[OpenMetadata](https://open-metadata.org/) is an Open Standard for Metadata. A Single place to Discover, Collaborate, and Get your data right.
<img src="https://user-images.githubusercontent.com/1417689/129423079-d21cbf3f-786f-4d4a-b6c3-b66feca234b8.png"  width="800">

OpenMetadata includes the following:
- **Metadata schemas** - defines core abstractions and vocabulary for metadata with schemas for Types, Entities, Relationships between entities. This is the foundation of the Open Metadata Standard.

- **Metadata store** - stores metadata graph that connects data assets, user, and tool generated metadata.

- **Metadata APIs** - for producing and consuming metadata built on schemas for User Interfaces and Integration of tools, systems, and services.

- **Ingestion framework** - a pluggable framework for integrating tools and ingesting metadata to the metadata store. Ingestion framework already supports well know data warehouses - Google BigQuery, Snowflake, Amazon Redshift, and Apache Hive, and databases - MySQL, Postgres, Oracle, and MSSQL.

- **OpenMetadata User Interface** - one single place for users to discover, and collaborate on all data.

## Try our Sandbox

Visit our demo at [http://sandbox.open-metadata.org](http://sandbox.open-metadata.org)

## Install and run OpenMetadata
Get up and running in few mins

```sh
git clone https://github.com/open-metadata/OpenMetadata
cd OpenMetadata/docker/metadata
docker-compose up -d
```
Then visit [http://localhost:8585](http://localhost:8585)

For more details on running OpenMetadata on your local machine or in production, see our [Install Doc](https://docs.open-metadata.org/install/run-openmetadata).

## Documentation and Support

Check out [OpenMetadata documentation](https://docs.open-metadata.org/) for a complete description of OpenMetadata's features.

Join [our Slack Community](https://join.slack.com/t/openmetadata/shared_invite/) if you get stuck, want to chat, or are thinking of a new feature.

Or join the group at [https://groups.google.com/g/openmetadata-users](https://groups.google.com/g/openmetadata-users)

We're here to help - and make OpenMetadata even better!

## Contributors

We ❤️ all contributions, big and small!

Read [Build Code and Run Tests](https://docs.open-metadata.org/open-source-community/developer/build-code-run-tests) for how to setup your local development environment.

If you want to, you can reach out via [Slack](https://openmetadata.slack.com/) or [email](mailto:dev@open-metadata.org) and we'll set up a pair programming session to get you started.

## License
OpenMetadata is released under [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)
