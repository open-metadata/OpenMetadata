---
description: This guide will help you to run OpenMetadata UI locally.
---

# Run OpenMetadata UI Locally

### **Pre-requisites**

Using the command below, spin up the server locally from the directory.`openmetadata-dist/target/openmetadata-*-SNAPSHOT`.

```shell
# # Non-secure mode
./bin/openmetadata-server-start.sh conf/openmetadata.yaml
# # Secure mode
./bin/openmetadata-server-start.sh conf/openmetadata-security.yaml
```

> Since typescript is heavily used in the OpenMetadata project, we generate the typescript types and the interface from JSON schema. We use the `QuickType` tool to generate the typescript types and interface. You can view the complete instructions [here](https://docs.open-metadata.org/open-source-community/developer/generate-typescript-types-from-json-schema)

### **Steps to Run OpenMetadata UI**

Once the node and yarn is installed in the system, you can go ahead and perform the following steps to run OpenMetadata UI.

**Step 1**: Run the given command to install the required dependencies.

**Note:** It’s a one-time task to install dependencies. If there are any changes in the `package.json` file, then again the following steps will have to be performed.

```shell
# installing dependencies
> make yarn_install_cache
```

**Step 2**: Start the UI locally

```shell
# starting the UI locally
> make yarn_start_dev_ui
```

**Step 3:** Visit [localhost:3000](http://localhost:3000) to access the OpenMetadata UI.
