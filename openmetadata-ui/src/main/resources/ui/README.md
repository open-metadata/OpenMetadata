# OpenMetadata UI

> This guide will help you run OpenMetadata UI locally in dev mode.

## Pre-requisites

Before proceeding, ensure that you have installed the node and yarn with the versions given below.

```
"node": ">=10.0.0",
"yarn": "^1.22.0"
```

Install [Node](https://nodejs.org/en/download/) and [Yarn](https://classic.yarnpkg.com/lang/en/docs/install/).<br />

Install ANTLR using our recipes via

```shell
sudo make install_antlr_cli
```

Using the command below, spin up the server locally from the directory `openmetadata-dist/target/openmetadata-*-SNAPSHOT`

```shell
./bin/openmetadata-server-start.sh conf/openmetadata.yaml
```

> If you don't have distributions generated or don't see `target` directory inside the `openmetadata-dist` then follow [this](https://docs.open-metadata.org/developers/contribute/build-code-and-run-tests/openmetadata-server#create-a-distribution-packaging) guide to create a distribution.
>
> Since typescript is heavily used in the OpenMetadata project, we generate the typescript types and the interface from JSON schema. We use the `QuickType` tool to generate the typescript types and interfaces. You can view the complete instructions [here](https://docs.open-metadata.org/developers/contribute/build-code-and-run-tests/generate-typescript-types-from-json-schema).

## Steps to Run OpenMetadata UI

Once the node and yarn are installed in the system, you can perform the following steps to run OpenMetadata UI.

**Step 1**: Run the given command to install the required dependencies.

**Note**: It’s a one-time task to install dependencies. If there are any changes in the `package.json` file, the following steps will have to be performed again.

```shell
# installing dependencies
> make yarn_install_cache
```

**Step 2**: Start the UI locally

```shell
# starting the UI locally
> make yarn_start_dev_ui
```

**Step 3**: Visit [localhost:3000](http://localhost:3000/) to access the OpenMetadata UI.
