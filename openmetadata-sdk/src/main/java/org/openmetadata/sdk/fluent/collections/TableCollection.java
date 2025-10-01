package org.openmetadata.sdk.fluent.collections;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Spliterator;
import java.util.Spliterators;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Collection for iterating over Table entities with auto-pagination support.
 *
 * Usage:
 * <pre>
 * // Basic iteration
 * TableCollection tables = Tables.list();
 * for (Table table : tables) {
 *     System.out.println(table.getName());
 * }
 *
 * // Stream API
 * tables.stream()
 *     .filter(t -> t.getTags().contains("PII"))
 *     .forEach(System.out::println);
 *
 * // Auto-pagination
 * tables.autoPaginate()
 *     .forEach(table -> process(table));
 * </pre>
 */
public class TableCollection implements Iterable<Table> {
  private final OpenMetadataClient client;
  private final ListParams params;
  private List<Table> currentPage;
  private String nextPageToken;
  private boolean hasMore;
  private boolean autoPaginate;

  public TableCollection(OpenMetadataClient client) {
    this(client, new ListParams());
  }

  public TableCollection(OpenMetadataClient client, ListParams params) {
    this.client = client;
    this.params = params;
    this.hasMore = true;
    this.autoPaginate = false;
  }

  /**
   * Set the limit for each page.
   */
  public TableCollection limit(int limit) {
    params.setLimit(limit);
    return this;
  }

  /**
   * Set the fields to include in the response.
   */
  public TableCollection fields(String fields) {
    params.setFields(fields);
    return this;
  }

  /**
   * Set the after cursor for pagination.
   */
  public TableCollection after(String after) {
    params.setAfter(after);
    return this;
  }

  /**
   * Set the before cursor for pagination.
   */
  public TableCollection before(String before) {
    params.setBefore(before);
    return this;
  }

  /**
   * Enable auto-pagination to automatically fetch all pages.
   */
  public TableCollection autoPaginate() {
    this.autoPaginate = true;
    return this;
  }

  /**
   * Get the current page of results.
   */
  public List<Table> getCurrentPage() {
    if (currentPage == null) {
      loadNextPage();
    }
    return currentPage;
  }

  /**
   * Check if there are more pages available.
   */
  public boolean hasMore() {
    return hasMore;
  }

  /**
   * Load the next page of results.
   */
  public boolean loadNextPage() {
    if (!hasMore) {
      return false;
    }

    try {
      ListParams pageParams = new ListParams();
      pageParams.setLimit(params.getLimit());
      pageParams.setFields(params.getFields());

      if (nextPageToken != null) {
        pageParams.setAfter(nextPageToken);
      } else if (params.getAfter() != null) {
        pageParams.setAfter(params.getAfter());
      }

      ListResponse<Table> response = client.tables().list(pageParams);

      currentPage = response.getData();
      nextPageToken = response.getPaging() != null ? response.getPaging().getAfter() : null;
      hasMore = nextPageToken != null && !currentPage.isEmpty();

      return true;
    } catch (Exception e) {
      throw new RuntimeException("Failed to load next page", e);
    }
  }

  /**
   * Reset the collection to start from the beginning.
   */
  public TableCollection reset() {
    currentPage = null;
    nextPageToken = null;
    hasMore = true;
    return this;
  }

  @Override
  public Iterator<Table> iterator() {
    if (autoPaginate) {
      return new AutoPaginatingIterator();
    } else {
      return getCurrentPage().iterator();
    }
  }

  /**
   * Get a stream of tables.
   */
  public Stream<Table> stream() {
    if (autoPaginate) {
      Spliterator<Table> spliterator =
          Spliterators.spliteratorUnknownSize(
              new AutoPaginatingIterator(), Spliterator.ORDERED | Spliterator.NONNULL);
      return StreamSupport.stream(spliterator, false);
    } else {
      return getCurrentPage().stream();
    }
  }

  /**
   * Iterate over all tables across all pages.
   */
  public Iterable<Table> all() {
    return () -> new AutoPaginatingIterator();
  }

  /**
   * Collect all tables into a list (loads all pages).
   */
  public List<Table> toList() {
    List<Table> allTables = new ArrayList<>();
    for (Table table : all()) {
      allTables.add(table);
    }
    return allTables;
  }

  /**
   * Iterator that automatically fetches new pages as needed.
   */
  private class AutoPaginatingIterator implements Iterator<Table> {
    private Iterator<Table> currentIterator;
    private boolean initialized = false;

    @Override
    public boolean hasNext() {
      if (!initialized) {
        initialize();
      }

      if (currentIterator.hasNext()) {
        return true;
      }

      // Try to load next page
      if (hasMore && loadNextPage()) {
        currentIterator = currentPage.iterator();
        return currentIterator.hasNext();
      }

      return false;
    }

    @Override
    public Table next() {
      if (!hasNext()) {
        throw new NoSuchElementException();
      }
      return currentIterator.next();
    }

    private void initialize() {
      if (!initialized) {
        reset();
        if (loadNextPage()) {
          currentIterator = currentPage.iterator();
        } else {
          currentIterator = new ArrayList<Table>().iterator();
        }
        initialized = true;
      }
    }
  }
}
