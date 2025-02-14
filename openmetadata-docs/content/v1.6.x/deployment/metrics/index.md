---
title: Metrics
slug: /deployment/metrics
collate: false
---

All server metrics are published to `/prometheus` on the admin port (default 8586).
The metrics are in the Prometheus format and can be scraped by Prometheus or any other monitoring system that supports
Prometheus format.

## Metrics Description

### Counters

| Name                                 | Description                                                                                             | Type    |
|--------------------------------------|---------------------------------------------------------------------------------------------------------|---------|
 jvm_gc_memory_promoted_bytes_total   | Count of positive increases in the size of the old generation memory pool before GC to after GC         | counter 
 jvm_gc_memory_allocated_bytes_total  | Incremented for an increase in the size of the (young) heap memory pool after one GC to before the next | counter 
 pipeline_client_request_status_total | status codes returned by pipeline client by operation                                                   | counter 
 logback_events_total                 | Number of events that made it to the logs                                                               | counter 
 jvm_classes_unloaded_classes_total   | The total number of classes unloaded since the Java virtual machine has started execution               | counter 

### Gauges

| Name                                   | Description                                                                                                                                                                      | Type  |
|----------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------|
 jvm_gc_pause_seconds_max               | Time spent in GC pause                                                                                                                                                           | gauge 
 jvm_memory_usage_after_gc_percent      | The percentage of long-lived heap pool used after the last GC event, in the range [0..1]                                                                                         | gauge 
 jvm_buffer_count_buffers               | An estimate of the number of buffers in the pool                                                                                                                                 | gauge 
 jvm_gc_max_data_size_bytes             | Max size of long-lived heap memory pool                                                                                                                                          | gauge 
 jvm_memory_used_bytes                  | The amount of used memory                                                                                                                                                        | gauge 
 process_cpu_usage                      | The "recent cpu usage" for the Java Virtual Machine process                                                                                                                      | gauge 
 process_uptime_seconds                 | The uptime of the Java virtual machine                                                                                                                                           | gauge 
 jvm_classes_loaded_classes             | The number of classes that are currently loaded in the Java virtual machine                                                                                                      | gauge 
 jvm_memory_max_bytes                   | The maximum amount of memory in bytes that can be used for memory management                                                                                                     | gauge 
 system_cpu_usage                       | The "recent cpu usage" of the system the application is running in                                                                                                               | gauge 
 process_files_open_files               | The open file descriptor count                                                                                                                                                   | gauge 
 system_cpu_count                       | The number of processors available to the Java virtual machine                                                                                                                   | gauge 
 system_load_average_1m                 | The sum of the number of runnable entities queued to available processors and the number of runnable entities running on the available processors averaged over a period of time | gauge 
 http_latency_requests_seconds_max      | HTTP request latency in seconds.                                                                                                                                                 | gauge 
 jvm_gc_live_data_size_bytes            | Size of long-lived heap memory pool after reclamation                                                                                                                            | gauge 
 jvm_buffer_memory_used_bytes           | An estimate of the memory that the Java virtual machine is using for this buffer pool                                                                                            | gauge 
 process_files_max_files                | The maximum file descriptor count                                                                                                                                                | gauge 
 jvm_threads_live_threads               | The current number of live threads including both daemon and non-daemon threads                                                                                                  | gauge 
 process_start_time_seconds             | Start time of the process since unix epoch.                                                                                                                                      | gauge 
 jvm_buffer_total_capacity_bytes        | An estimate of the total capacity of the buffers in this pool                                                                                                                    | gauge 
 jvm_threads_states_threads             | The current number of threads                                                                                                                                                    | gauge 
 jdbi_latency_requests_seconds_max      | JDBI queries latency in seconds.                                                                                                                                                 | gauge 
 jvm_threads_daemon_threads             | The current number of live daemon threads                                                                                                                                        | gauge 
 jvm_gc_overhead_percent                | An approximation of the percent of CPU time used by GC activities over the last lookback period or since monitoring began, whichever is shorter, in the range [0..1]             | gauge 
 jvm_memory_committed_bytes             | The amount of memory in bytes that is committed for the Java virtual machine to use                                                                                              | gauge 
 jvm_threads_peak_threads               | The peak live thread count since the Java virtual machine started or peak was reset                                                                                              | gauge 
 http_server_requests_sec_created       | HTTP methods duration                                                                                                                                                            | gauge 
 jdbi_requests_seconds_created          | jdbi requests duration distribution                                                                                                                                              | gauge 
 pipeline_client_request_status_created | status codes returned by pipeline client by operation                                                                                                                            | gauge 

### Summaries

| Name                          | Description                      | Type    |
|-------------------------------|----------------------------------|---------|
 jvm_gc_pause_seconds          | Time spent in GC pause           | summary 
 http_latency_requests_seconds | HTTP request latency in seconds. | summary 
 jdbi_latency_requests_seconds | JDBI queries latency in seconds. | summary 

### Histograms

| Name                         | Description                         | Type      |
|------------------------------|-------------------------------------|-----------|
 jdbi_requests_seconds        | jdbi requests duration distribution | histogram 
 http_server_requests_seconds | HTTP requests duration distribution | histogram 
 http_server_requests_sec     | HTTP methods duration               | histogram 