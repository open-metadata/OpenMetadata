package org.openmetadata.sdk.fluent.collections;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.stream.Stream;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Collection for iterating over Chart entities with auto-pagination support.
 */
public class ChartCollection implements Iterable<Chart> {
  private final OpenMetadataClient client;
  private final ListParams params;
  private List<Chart> currentPage;
  private String nextPageToken;
  private boolean hasMore;

  public ChartCollection(OpenMetadataClient client) {
    this(client, new ListParams());
  }

  public ChartCollection(OpenMetadataClient client, ListParams params) {
    this.client = client;
    this.params = params;
    this.hasMore = true;
  }

  public ChartCollection limit(int limit) {
    params.setLimit(limit);
    return this;
  }

  public List<Chart> getCurrentPage() {
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

      ListResponse<Chart> response = client.charts().list(pageParams);
      currentPage = response.getData();
      nextPageToken = response.getPaging() != null ? response.getPaging().getAfter() : null;
      hasMore = nextPageToken != null && !currentPage.isEmpty();
      return true;
    } catch (Exception e) {
      throw new RuntimeException("Failed to load next page", e);
    }
  }

  @Override
  public Iterator<Chart> iterator() {
    return getCurrentPage().iterator();
  }

  public Stream<Chart> stream() {
    return getCurrentPage().stream();
  }

  public List<Chart> toList() {
    List<Chart> all = new ArrayList<>();
    do {
      all.addAll(getCurrentPage());
    } while (loadNextPage());
    return all;
  }
}
