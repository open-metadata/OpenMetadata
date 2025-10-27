package org.openmetadata.sdk.fluent.collections;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.stream.Stream;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Collection for iterating over TestCase entities with auto-pagination support.
 */
public class TestCaseCollection implements Iterable<TestCase> {
  private final OpenMetadataClient client;
  private final ListParams params;
  private List<TestCase> currentPage;
  private String nextPageToken;
  private boolean hasMore;

  public TestCaseCollection(OpenMetadataClient client) {
    this(client, new ListParams());
  }

  public TestCaseCollection(OpenMetadataClient client, ListParams params) {
    this.client = client;
    this.params = params;
    this.hasMore = true;
  }

  public TestCaseCollection limit(int limit) {
    params.setLimit(limit);
    return this;
  }

  public List<TestCase> getCurrentPage() {
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

      ListResponse<TestCase> response = client.testCases().list(pageParams);
      currentPage = response.getData();
      nextPageToken = response.getPaging() != null ? response.getPaging().getAfter() : null;
      hasMore = nextPageToken != null && !currentPage.isEmpty();
      return true;
    } catch (Exception e) {
      throw new RuntimeException("Failed to load next page", e);
    }
  }

  @Override
  public Iterator<TestCase> iterator() {
    return getCurrentPage().iterator();
  }

  public Stream<TestCase> stream() {
    return getCurrentPage().stream();
  }

  public List<TestCase> toList() {
    List<TestCase> all = new ArrayList<>();
    do {
      all.addAll(getCurrentPage());
    } while (loadNextPage());
    return all;
  }
}
