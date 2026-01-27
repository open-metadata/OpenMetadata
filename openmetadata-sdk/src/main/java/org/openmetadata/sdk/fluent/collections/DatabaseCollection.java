package org.openmetadata.sdk.fluent.collections;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Spliterator;
import java.util.Spliterators;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Collection for iterating over Database entities with auto-pagination support.
 *
 * Usage:
 * <pre>
 * // Basic iteration
 * DatabaseCollection databases = Databases.collection();
 * for (Database database : databases) {
 *     System.out.println(database.getName());
 * }
 *
 * // Stream API
 * databases.stream()
 *     .filter(d -> d.getService().getName().equals("mysql"))
 *     .forEach(System.out::println);
 *
 * // Auto-pagination
 * databases.autoPaginate()
 *     .forEach(database -> process(database));
 * </pre>
 */
public class DatabaseCollection implements Iterable<Database> {
  private final OpenMetadataClient client;
  private final ListParams params;
  private List<Database> currentPage;
  private String nextPageToken;
  private boolean hasMore;
  private boolean autoPaginate;

  public DatabaseCollection(OpenMetadataClient client) {
    this(client, new ListParams());
  }

  public DatabaseCollection(OpenMetadataClient client, ListParams params) {
    this.client = client;
    this.params = params;
    this.hasMore = true;
    this.autoPaginate = false;
  }

  /**
   * Set the limit for each page.
   */
  public DatabaseCollection limit(int limit) {
    params.setLimit(limit);
    return this;
  }

  /**
   * Set the fields to include in the response.
   */
  public DatabaseCollection fields(String fields) {
    params.setFields(fields);
    return this;
  }

  /**
   * Set the after cursor for pagination.
   */
  public DatabaseCollection after(String after) {
    params.setAfter(after);
    return this;
  }

  /**
   * Set the before cursor for pagination.
   */
  public DatabaseCollection before(String before) {
    params.setBefore(before);
    return this;
  }

  /**
   * Enable auto-pagination to automatically fetch all pages.
   */
  public DatabaseCollection autoPaginate() {
    this.autoPaginate = true;
    return this;
  }

  /**
   * Get the current page of results.
   */
  public List<Database> getCurrentPage() {
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

      ListResponse<Database> response = client.databases().list(pageParams);

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
  public DatabaseCollection reset() {
    currentPage = null;
    nextPageToken = null;
    hasMore = true;
    return this;
  }

  @Override
  public Iterator<Database> iterator() {
    if (autoPaginate) {
      return new AutoPaginatingIterator();
    } else {
      return getCurrentPage().iterator();
    }
  }

  /**
   * Get a stream of databases.
   */
  public Stream<Database> stream() {
    if (autoPaginate) {
      Spliterator<Database> spliterator =
          Spliterators.spliteratorUnknownSize(
              new AutoPaginatingIterator(), Spliterator.ORDERED | Spliterator.NONNULL);
      return StreamSupport.stream(spliterator, false);
    } else {
      return getCurrentPage().stream();
    }
  }

  /**
   * Iterate over all databases across all pages.
   */
  public Iterable<Database> all() {
    return () -> new AutoPaginatingIterator();
  }

  /**
   * Collect all databases into a list (loads all pages).
   */
  public List<Database> toList() {
    List<Database> allDatabases = new ArrayList<>();
    for (Database database : all()) {
      allDatabases.add(database);
    }
    return allDatabases;
  }

  /**
   * Iterator that automatically fetches new pages as needed.
   */
  private class AutoPaginatingIterator implements Iterator<Database> {
    private Iterator<Database> currentIterator;
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
    public Database next() {
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
          currentIterator = new ArrayList<Database>().iterator();
        }
        initialized = true;
      }
    }
  }
}
