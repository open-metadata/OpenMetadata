# Spline

In this section, we provide guides and references to use the Spline connector. You can view the full documentation for Spline [here](https://docs.open-metadata.org/connectors/pipeline/spline).

## Requirements

We extract Spline's metadata by using its [API](https://absaoss.github.io/spline/).

## Connection Details

$$section
### Spline REST Server Host & Port $(id="hostPort")

OpenMetadata uses Spline REST Server APIs to extract the execution details from spline to generate lineage.

This should be specified as a URI string in the format `scheme://hostname:port`. E.g., `http://localhost:8080`, `http://host.docker.internal:8080`.


$$

$$section
### Spline UI Host & Port $(id="uiHostPort")

Spline UI Host & Port is an optional field which is used for generating redirection URL from OpenMetadata to Spline Portal. 

This should be specified as a URI string in the format `scheme://hostname:port`. E.g., `http://localhost:9090`, `http://host.docker.internal:9090`.
$$