---
title: Update the Documentation
slug: /developers/contribute/developing-a-new-connector/update-documentation
---

# Update the Documentation

One important part of developing a new connector is to document how it works after it is done.

The documentation for connectors can be found within `openmetadata-docs/content/v{version}-SNAPSHOT/connectors`
where `{version}` depends on the time of reading.

There you need to create a new folder within the proper Source Type you are building a connector for (Database, Dashboard, MLModel, etc) and create two files:

- **index.md**: It explains how to configure the connector using the UI.
- **yaml.md**: It explains how to configure the connector using a YAML file.

Again the best way to create the documentation is to use another connector's documentation as a base since they all follow the same structure.

Once the documentation is done, it's important to add it to the proper indexes and menus:

- `openmetadata-docs/content/v{version}-SNAPSHOT/menu.md`
- `openmetadata-docs/content/v{version}-SNAPSHOT/connectors/index.md`
- `openmetadata-docs/content/v{version}-SNAPSHOT/connectors/{source_type}/index.md`

This will guarantee that the connector is shown in the menus.

## How to test the Documentation

You can check your changes in the documentation by building it locally using `make docker-docs`. This will pull the OpenMetadata documentation Docker images and mount the project as a volume.

You should be able to see the documentation page on `http://localhost:3000`.

{% note %}
**Attention**

Beware that any version that is suffixed with `-SNAPSHOT` is not shown. So in order to check it out you will need to remove the suffic and add it again afterwards.
{% /note %}
