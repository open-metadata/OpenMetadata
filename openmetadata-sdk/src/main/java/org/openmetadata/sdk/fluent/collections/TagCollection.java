package org.openmetadata.sdk.fluent.collections;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.stream.Stream;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Collection for iterating over Tag entities with auto-pagination support.
 */
public class TagCollection implements Iterable<Tag> {
  private final OpenMetadataClient client;
  private final ListParams params;
  private List<Tag> currentPage;
  private String nextPageToken;
  private boolean hasMore;

  public TagCollection(OpenMetadataClient client) {
    this(client, new ListParams());
  }

  public TagCollection(OpenMetadataClient client, ListParams params) {
    this.client = client;
    this.params = params;
    this.hasMore = true;
  }

  public TagCollection limit(int limit) {
    params.setLimit(limit);
    return this;
  }

  public List<Tag> getCurrentPage() {
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

      ListResponse<Tag> response = client.tags().list(pageParams);
      currentPage = response.getData();
      nextPageToken = response.getPaging() != null ? response.getPaging().getAfter() : null;
      hasMore = nextPageToken != null && !currentPage.isEmpty();
      return true;
    } catch (Exception e) {
      throw new RuntimeException("Failed to load next page", e);
    }
  }

  @Override
  public Iterator<Tag> iterator() {
    return getCurrentPage().iterator();
  }

  public Stream<Tag> stream() {
    return getCurrentPage().stream();
  }

  public List<Tag> toList() {
    List<Tag> all = new ArrayList<>();
    do {
      all.addAll(getCurrentPage());
    } while (loadNextPage());
    return all;
  }
}
