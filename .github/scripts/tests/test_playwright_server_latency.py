from test_playwright_ci_planning import load_script


def test_latency_histogram_preserves_slow_tail_separately_from_call_count():
    module = load_script("summarize_playwright_requests")
    accumulator = module.RequestAccumulator()
    for duration in [5] * 95 + [2200] * 5:
        accumulator.add(
            f'"GET /api/v1/search/query?q=x HTTP/1.1" 200 10 "-" "ua" {duration}'
        )
    latency = accumulator.payload("shard")["apiLatency"]
    assert latency["samples"] == 100
    assert latency["p95UpperBoundMs"] == 10
    assert latency["p99UpperBoundMs"] == 5000
    assert latency["maxMs"] == 2200


def test_latency_routes_are_bounded_without_losing_requests():
    module = load_script("summarize_playwright_requests")
    accumulator = module.RequestAccumulator()
    for index in range(1000):
        accumulator.add(f'"GET /api/v1/other/{index} HTTP/1.1" 500 0 "-" "ua" 100')
    payload = accumulator.payload("shard")
    assert len(payload["apiEndpointLatency"]) <= module.MAX_LATENCY_ROUTES
    assert (
        sum(route["samples"] for route in payload["apiEndpointLatency"].values())
        == 1000
    )
    assert payload["apiLatency"]["samples"] == 1000


def test_workflow_percentiles_merge_bucket_counts_not_shard_averages():
    module = load_script("summarize_playwright_requests")
    fast = module.LatencyHistogram()
    slow = module.LatencyHistogram()
    for _ in range(99):
        fast.add(5)
    slow.add(3000)
    combined = module.merge_latency_histograms([fast.payload(), slow.payload()])
    assert combined["p95UpperBoundMs"] == 10
    assert combined["meanMs"] == 34.95
