# Performance Standards

## Pagination

Never load all entities into memory at once. Use generators:

```python
def get_dashboards_list(self):
    """Yield dashboards one page at a time."""
    yield from self.client.paginate("/api/v1/dashboards")
```

## Connection Reuse

- SQLAlchemy: The `BaseConnection` class handles connection caching automatically
- REST clients: Create one `requests.Session` and reuse it for all requests
- SDK clients: Initialize once in `get_connection()`, not per-entity

## Batch Operations

When fetching details for each entity, prefer batch endpoints if available:

```python
# Prefer this
details = self.client.get_dashboards_batch(ids=[d.id for d in dashboards])

# Over this
for dashboard in dashboards:
    detail = self.client.get_dashboard(dashboard.id)  # N+1 problem
```

## Rate Limiting

For REST APIs with rate limits:
- Implement retry with exponential backoff in the client
- Use `tenacity` or a custom retry decorator
- Log rate limit encounters at `WARNING` level

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, max=30))
def _get(self, endpoint):
    response = self._session.get(f"{self._base_url}{endpoint}")
    if response.status_code == 429:
        raise RateLimitError(response.headers.get("Retry-After", 30))
    response.raise_for_status()
    return response.json()
```

## Lazy Loading

Only fetch entity details when needed:

```python
def get_dashboard_details(self, dashboard):
    """Called only for dashboards that pass filters."""
    return self.client.get_dashboard(dashboard.id)
```

The framework applies filter patterns between `get_dashboards_list()` and `get_dashboard_details()`, so filtered entities never trigger detail fetches.

## Memory

- Never accumulate all entities in a list — yield them
- For large query log processing, stream line-by-line
- Close database cursors explicitly when done
