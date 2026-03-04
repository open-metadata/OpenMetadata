package org.openmetadata.sdk.fluent.collections;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.stream.Stream;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Collection for iterating over SearchIndex entities with auto-pagination support.
 */
public class SearchIndexCollection implements Iterable<SearchIndex> {
  private final OpenMetadataClient client;
  private final ListParams params;
  private List<SearchIndex> currentPage;
  private String nextPageToken;
  private boolean hasMore;

  public SearchIndexCollection(OpenMetadataClient client) {
    this(client, new ListParams());
  }

  public SearchIndexCollection(OpenMetadataClient client, ListParams params) {
    this.client = client;
    this.params = params;
    this.hasMore = true;
  }

  public SearchIndexCollection limit(int limit) {
    params.setLimit(limit);
    return this;
  }

  public List<SearchIndex> getCurrentPage() {
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

      ListResponse<SearchIndex> response = client.searchIndexes().list(pageParams);
      currentPage = response.getData();
      nextPageToken = response.getPaging() != null ? response.getPaging().getAfter() : null;
      hasMore = nextPageToken != null && !currentPage.isEmpty();
      return true;
    } catch (Exception e) {
      throw new RuntimeException("Failed to load next page", e);
    }
  }

  @Override
  public Iterator<SearchIndex> iterator() {
    return getCurrentPage().iterator();
  }

  public Stream<SearchIndex> stream() {
    return getCurrentPage().stream();
  }

  public List<SearchIndex> toList() {
    List<SearchIndex> all = new ArrayList<>();
    do {
      all.addAll(getCurrentPage());
    } while (loadNextPage());
    return all;
  }
}
