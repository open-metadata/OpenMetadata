# Metrics

Metrics are the minimum entity of this Profiler implementation.

Everything goes around Metrics:
- A profiler is defined as a set of Metrics
- The profiler results are a dictionary with Metrics' names as keys
- In the Validation process, we make sure that the parsed metrics are properly registered.

A new metric is defined in its own module. Its implementation can have specific
implementations depending on the dialect.

It is important to add new metrics into the `Metrics` Registry. It is a useful
utility for finding all available metrics and initializing them. It is also
used in the validation process to control the received metrics.
