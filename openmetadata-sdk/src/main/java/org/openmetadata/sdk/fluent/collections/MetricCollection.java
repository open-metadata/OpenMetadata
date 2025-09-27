package org.openmetadata.sdk.fluent.collections;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.stream.Stream;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Collection for iterating over Metric entities with auto-pagination support.
 */
public class MetricCollection implements Iterable<Metric> {
  private final OpenMetadataClient client;
  private final ListParams params;
  private List<Metric> currentPage;
  private String nextPageToken;
  private boolean hasMore;

  public MetricCollection(OpenMetadataClient client) {
    this(client, new ListParams());
  }

  public MetricCollection(OpenMetadataClient client, ListParams params) {
    this.client = client;
    this.params = params;
    this.hasMore = true;
  }

  public MetricCollection limit(int limit) {
    params.setLimit(limit);
    return this;
  }

  public List<Metric> getCurrentPage() {
    if (currentPage == null) {
      loadNextPage();
    }
    return currentPage;
  }

  public boolean loadNextPage() {
    if (!hasMore) {
      return false;
    }

    try {
      ListParams pageParams = new ListParams();
      pageParams.setLimit(params.getLimit());
      if (nextPageToken != null) {
        pageParams.setAfter(nextPageToken);
      }

      ListResponse<Metric> response = client.metrics().list(pageParams);
      currentPage = response.getData();
      nextPageToken = response.getPaging() != null ? response.getPaging().getAfter() : null;
      hasMore = nextPageToken != null && !currentPage.isEmpty();
      return true;
    } catch (Exception e) {
      throw new RuntimeException("Failed to load next page", e);
    }
  }

  @Override
  public Iterator<Metric> iterator() {
    return getCurrentPage().iterator();
  }

  public Stream<Metric> stream() {
    return getCurrentPage().stream();
  }

  public List<Metric> toList() {
    List<Metric> all = new ArrayList<>();
    do {
      all.addAll(getCurrentPage());
    } while (loadNextPage());
    return all;
  }
}
