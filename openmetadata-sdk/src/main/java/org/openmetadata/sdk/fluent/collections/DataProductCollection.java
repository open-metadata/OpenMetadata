package org.openmetadata.sdk.fluent.collections;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.stream.Stream;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Collection for iterating over DataProduct entities with auto-pagination support.
 */
public class DataProductCollection implements Iterable<DataProduct> {
  private final OpenMetadataClient client;
  private final ListParams params;
  private List<DataProduct> currentPage;
  private String nextPageToken;
  private boolean hasMore;

  public DataProductCollection(OpenMetadataClient client) {
    this(client, new ListParams());
  }

  public DataProductCollection(OpenMetadataClient client, ListParams params) {
    this.client = client;
    this.params = params;
    this.hasMore = true;
  }

  public DataProductCollection limit(int limit) {
    params.setLimit(limit);
    return this;
  }

  public List<DataProduct> getCurrentPage() {
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

      ListResponse<DataProduct> response = client.dataProducts().list(pageParams);
      currentPage = response.getData();
      nextPageToken = response.getPaging() != null ? response.getPaging().getAfter() : null;
      hasMore = nextPageToken != null && !currentPage.isEmpty();
      return true;
    } catch (Exception e) {
      throw new RuntimeException("Failed to load next page", e);
    }
  }

  @Override
  public Iterator<DataProduct> iterator() {
    return getCurrentPage().iterator();
  }

  public Stream<DataProduct> stream() {
    return getCurrentPage().stream();
  }

  public List<DataProduct> toList() {
    List<DataProduct> all = new ArrayList<>();
    do {
      all.addAll(getCurrentPage());
    } while (loadNextPage());
    return all;
  }
}
