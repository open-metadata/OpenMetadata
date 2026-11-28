# Prometheus metrics migrate through distinct canonical and legacy series

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** OpenMetadata contributors
- **Guard:** JettyMetricsIntegrationTest, MicrometerBundleTest and PrometheusResourceIT
- **Related:** #38509, #38503

## Context

Metrics consumers use the existing Jetty gauges and the JVM's CPU time counter. Prometheus
identifies a metric family by its exported name. Registering a gauge and a counter for the
same family can break the scrape. A ServiceMonitor can also attach its own endpoint label,
which collides with the application's existing latency label.

## Decision

- Publish counter and base-unit families alongside the legacy families during migration.
  The [Prometheus migration guide](../prometheus-metric-migration.md) records the names,
  units, and supported fallback queries.
- Derive thread utilization from busy threads and configured capacity. The legacy
  percentage and the canonical ratio share the corrected denominator.
- Rename the application route label to http_route at the Prometheus registry boundary.
  The composite Micrometer registry keeps endpoint for system diagnostics.
- Publish a canonical queue wait metric when a producer records real queue wait.

## Consequences

Operators can update rules and roll out servers independently while preferring one
family per target. The latency rename requires mixed-version queries during rollout and
rollback. The retained families add scrape samples during migration.
