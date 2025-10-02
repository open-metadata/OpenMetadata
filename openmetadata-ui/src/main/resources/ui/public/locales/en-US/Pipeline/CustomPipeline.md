# Custom Pipeline

In this section, we provide guides and references to use the Custom Pipeline connector.

Note that this connector is a wrapper for any Python class you create and add to the OpenMetadata ingestion image. The full idea around it is bringing you the tools to bring into OpenMetadata any source that is only available within your business/engineering context.

You can learn more about Custom Connectors and see them in action in the following <a href="https://www.youtube.com/watch?v=fDUj30Ub9VE&ab_channel=OpenMetadata" target="_blank">Webinar</a>. Also, you can directly jump to the demo code <a href="https://github.com/open-metadata/openmetadata-demo/tree/main/custom-connector" target="_blank">here</a>.

## Connection Details

$$section
### Source Python Class $(id="sourcePythonClass")

Source Python Class Name to instantiated by the ingestion workflow.

Note that it should implement the `next_record` method so that the Workflow can keep reading and sending records to the OpenMetadata API.

$$section
### Connection Options $(id="connectionOptions")

This property becomes useful when we need to send input parameters to our Source Class.

If, for example, we want to run a piece of logic based on the value of a parameter named `business_unit`, we can pass the key `business_unit` with any value, and read it in the Source via:

```python
business_unit = self.service_connection.connectionOptions.__root__.get("business_unit")
```

You can find a full example of this implementation <a href="https://github.com/open-metadata/openmetadata-demo/blob/main/custom-connector/connector/my_csv_connector.py#L91" target="_blank">here</a>.

$$

## Test Connection

The test connection is disabled here as this is a custom implementation. The recommended approach would be to validate the connection to your source as a first step in the ingestion process.
