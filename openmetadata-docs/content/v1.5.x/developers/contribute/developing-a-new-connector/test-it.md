---
title: Test It
slug: /developers/contribute/developing-a-new-connector/test-it
---

# Test It

In order to test your new connector you need to run `make generate` from the project's root in order to generate the propert Python Classes from the JSON Schemas you created and modified.

## Unit Tests

If you want to test the whole package you could always run the following commands from the project's root:

```bash
make install_test
make coverage
```

This could be slow and in order to iterate faster you could just run the tests you created for your connector by running `pytest {path_to_your_tests}`.

## Run the Connector from the CLI

In order to test the connector using the CLI you first need to have the OpenMetadata stack running locally.
The easiest way to do is to check how to do it [here](/developers/contribute/build-code-and-run-tests).

With it up and running you can install the ingestion pacakge locally and use the CLI directly:

```bash
metadata ingest -c {your_yaml_file}
```

## Run the Connector from the UI

In order to test the connector using the UI you first need to have the OpenMetadata stack running locally.
The easiest way to do is to check how to do it [here](/developers/contribute/build-code-and-run-tests).

With it up and running you can configure the connector from the UI itself.

## Next Step

Now that it's all working correctly, let's learn how to update the documentation for everyone else that will use the connector!

{%inlineCallout
  color="violet-70"
  bold="Update the Documentation"
  icon="MdArrowForward"
  href="/developers/contribute/developing-a-new-connector/update-documentation"%}
  Learn how to create the documentation for your new Connector
{%/inlineCallout%}
