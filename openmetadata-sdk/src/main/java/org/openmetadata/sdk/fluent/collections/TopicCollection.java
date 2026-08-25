package org.openmetadata.sdk.fluent.collections;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.stream.Stream;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Collection for iterating over Topic entities with auto-pagination support.
 */
public class TopicCollection implements Iterable<Topic> {
  private final OpenMetadataClient client;
  private final ListParams params;
  private List<Topic> currentPage;
  private String nextPageToken;
  private boolean hasMore;

  public TopicCollection(OpenMetadataClient client) {
    this(client, new ListParams());
  }

  public TopicCollection(OpenMetadataClient client, ListParams params) {
    this.client = client;
    this.params = params;
    this.hasMore = true;
  }

  public TopicCollection limit(int limit) {
    params.setLimit(limit);
    return this;
  }

  public List<Topic> getCurrentPage() {
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

      ListResponse<Topic> response = client.topics().list(pageParams);
      currentPage = response.getData();
      nextPageToken = response.getPaging() != null ? response.getPaging().getAfter() : null;
      hasMore = nextPageToken != null && !currentPage.isEmpty();
      return true;
    } catch (Exception e) {
      throw new RuntimeException("Failed to load next page", e);
    }
  }

  @Override
  public Iterator<Topic> iterator() {
    return getCurrentPage().iterator();
  }

  public Stream<Topic> stream() {
    return getCurrentPage().stream();
  }

  public List<Topic> toList() {
    List<Topic> all = new ArrayList<>();
    do {
      all.addAll(getCurrentPage());
    } while (loadNextPage());
    return all;
  }
}
