package org.openmetadata.sdk.fluent.collections;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.stream.Stream;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Collection for iterating over TestDefinition entities with auto-pagination support.
 */
public class TestDefinitionCollection implements Iterable<TestDefinition> {
  private final OpenMetadataClient client;
  private final ListParams params;
  private List<TestDefinition> currentPage;
  private String nextPageToken;
  private boolean hasMore;

  public TestDefinitionCollection(OpenMetadataClient client) {
    this(client, new ListParams());
  }

  public TestDefinitionCollection(OpenMetadataClient client, ListParams params) {
    this.client = client;
    this.params = params;
    this.hasMore = true;
  }

  public TestDefinitionCollection limit(int limit) {
    params.setLimit(limit);
    return this;
  }

  public List<TestDefinition> getCurrentPage() {
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

      ListResponse<TestDefinition> response = client.testDefinitions().list(pageParams);
      currentPage = response.getData();
      nextPageToken = response.getPaging() != null ? response.getPaging().getAfter() : null;
      hasMore = nextPageToken != null && !currentPage.isEmpty();
      return true;
    } catch (Exception e) {
      throw new RuntimeException("Failed to load next page", e);
    }
  }

  @Override
  public Iterator<TestDefinition> iterator() {
    return getCurrentPage().iterator();
  }

  public Stream<TestDefinition> stream() {
    return getCurrentPage().stream();
  }

  public List<TestDefinition> toList() {
    List<TestDefinition> all = new ArrayList<>();
    do {
      all.addAll(getCurrentPage());
    } while (loadNextPage());
    return all;
  }
}
