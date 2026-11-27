# Migrate the OpenMetadata Prometheus scrape

OpenMetadata serves these metrics at `/prometheus` on its admin connector (port 8586 by
default). During a rolling upgrade, old and new servers can expose different metric names
for the same measurement. Choose one series per scrape target before aggregating across
servers.

## Metric names and units

| Canonical series | Type and meaning | Legacy series during rollout |
| --- | --- | --- |
| `jetty_threads_utilization_ratio` | Gauge. Busy threads divided by the configured maximum, bounded to 0–1. A missing or invalid maximum gives 0. | `jetty_threads_utilization` stays a percentage. New servers calculate it against the configured maximum. |
| `jetty_http_requests_total` | Counter. Requests observed by Jetty's StatisticsHandler. | `jetty_requests` |
| `jetty_http_responses_total` | Counter. HTTP responses labeled `status_class`, from 1xx through 5xx. | `jetty_responses_1xx` through `jetty_responses_5xx`. `jetty_requests_failed` also counts 5xx responses. |
| `jetty_http_sent_bytes_total`, `jetty_http_received_bytes_total` | Counters. Bytes Jetty wrote and read, respectively. | `jetty_bytes_sent`, `jetty_bytes_received` |
| `jetty_http_request_failures_total` | Counter. Jetty recorded a failure when processing the request to completion. | `jetty_failures` |
| `jetty_http_handler_failures_total` | Counter. Jetty caught an exception during handler execution. | `jetty_failures_handling` |
| `jetty_response_time_{max,mean,stddev}_seconds` | Gauges. Jetty's request duration statistics in seconds. | `jetty_response_time_max`, `jetty_response_time_mean` and `jetty_response_time_stddev` remain in nanoseconds and are deprecated. |
| `process_cpu_seconds_total` | Counter. Cumulative process CPU time in seconds from the JVM's existing CPU time source. The series is absent on unsupported JVMs. | `process_cpu_time_ns_total` |
| `search_index_shard_usage_ratio` | Gauge. Fraction of configured shard capacity in use, bounded to 0–1. The existing cached snapshot supplies the counts. | `search_index_shard_usage_percent` can exceed 100. `search_index_shard_current` and `search_index_shard_max` retain the actual counts. |

Jetty can record an HTTP 5xx response and a failure on the same request. Alert on the
5xx response class for an HTTP error-rate alert. Use request and handler failures to
diagnose the two Jetty failure signals separately.

Jetty backs several totals with 32-bit integers. The canonical counters continue rising
through 2³¹ and reset when an unsigned value wraps after 2³²−1. Jetty also resets counters
when the statistics handler starts. Prometheus rate and increase handle a decrease as
a reset. Track each target independently to keep rolling restarts from distorting rates.

Jetty still exposes `jetty_request_queue_time_ms` as a legacy gauge. The server has no active
producer for the average queue wait. Adding the seconds gauge requires a verified producer.
Use the current queue size and thread metrics to monitor saturation.
[Queue instrumentation issue](https://github.com/open-metadata/OpenMetadata/issues/38503).

## Queries during a rolling upgrade

These examples treat `job` and `instance` as the stable target identity. Include any other
labels needed to distinguish targets in your deployment and keep method when querying
request latency. Run rate on each original counter before choosing one version per
target or aggregating across targets.

Migrate alerts using `jetty_requests_failed` to the 5xx response class. The right-hand
expression temporarily uses the legacy cumulative gauge for old targets.

~~~promql
sum(
  rate(jetty_http_responses_total{status_class="5xx"}[5m])
  or on (job, instance) rate(jetty_requests_failed[5m])
)
~~~

Use the configured maximum to calculate the old server's thread utilization. A legacy
server's `jetty_threads_utilization` divides by currently allocated threads. For example,
10 busy threads out of 13 allocated and 50 configured use 0.20 of capacity. Divide
percentage thresholds by 100 when moving to either of the new ratio gauges.

~~~promql
jetty_threads_utilization_ratio
or on (job, instance)
clamp(jetty_threads_busy / on (job, instance) (jetty_threads_max > 0), 0, 1)
~~~

Convert the old shard percentage and request duration to each new gauge's unit.

~~~promql
search_index_shard_usage_ratio
or on (job, instance)
clamp(search_index_shard_usage_percent / 100, 0, 1)
~~~

~~~promql
jetty_response_time_max_seconds
or on (job, instance)
(jetty_response_time_max / 1e9)
~~~

CPU rates from both versions measure seconds of CPU time per second.

~~~promql
rate(process_cpu_seconds_total[5m])
or on (job, instance)
(rate(process_cpu_time_ns_total[5m]) / 1e9)
~~~

Latency still uses one tuple per classified route and HTTP method. The server
exports `http_route` for its classified route, such as /v1/tables, while the
ServiceMonitor's target `endpoint` remains available separately. Existing diagnostics at
`/api/v1/system/diagnostics` still group latency by method and `endpoint` and report
`utilization_pct` in percent.

For old pods, Prometheus may copy the old application `endpoint` label to
`exported_endpoint` when it conflicts with a target label. The temporary expression below
renames that old application label when `http_route` is absent. When the old scrape had no
such conflict, it copies `endpoint`. It chooses the new series first for each target,
route and method.

~~~promql
sum by (http_route, method) (
  rate(request_latency_total_seconds_count{http_route!=""}[5m])
  or on (job, instance, http_route, method)
  label_replace(
    rate(request_latency_total_seconds_count{http_route="",exported_endpoint!=""}[5m]),
    "http_route", "$1", "exported_endpoint", "(.+)"
  )
  or on (job, instance, http_route, method)
  label_replace(
    rate(request_latency_total_seconds_count{http_route="",exported_endpoint="",endpoint!=""}[5m]),
    "http_route", "$1", "endpoint", "(.+)"
  )
)
~~~

For classic histogram buckets, use `request_latency_total_seconds_bucket`, add `le`
to both the matching and aggregation labels, and pass the resulting bucket rates to
`histogram_quantile`. The debug script reads both label formats and reports each method
separately. Use `bin/debug-latency.sh -l` to list monitored routes and
`bin/debug-latency.sh -e /v1/tables` to inspect the table route.

## Deploy, verify and roll back

1. Put the mixed-version queries on dashboards and alerts before replacing servers.
2. In staging, capture the old admin scrape and the candidate admin scrape after controlled
   HTTP traffic. Check each with `promtool check metrics`. Record baseline findings on the
   retained legacy series and verify that the new families expose the expected types and units
   without new lint findings.
3. Check one old pod and one new pod together behind the ServiceMonitor. Confirm that target
   labels survive, latency methods stay distinct, and dashboards choose the canonical meter
   per pod when it is present. Observe scrape health, panel coverage and alert thresholds for
   at least one evaluation window.
4. Expand the rollout after the canary. Keep the mixed-version queries during any rollback.
   Retire the legacy query branches after all targets use the new contract. Removing legacy
   exported series requires a separately communicated release.

[Prometheus metric naming](https://prometheus.io/docs/practices/naming/),
[Prometheus scrape labels](https://prometheus.io/docs/prometheus/latest/configuration/configuration/#scrape_config),
[PromQL vector matching](https://prometheus.io/docs/prometheus/latest/querying/operators/),
and ADR:2026-11-26-prometheus-metrics-migrate-with-dual-series.
