package org.openmetadata.sdk.fluent.collections;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Spliterator;
import java.util.Spliterators;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Collection for iterating over DatabaseSchema entities with auto-pagination support.
 *
 * Usage:
 * <pre>
 * // Basic iteration
 * DatabaseSchemaCollection schemas = DatabaseSchemas.collection();
 * for (DatabaseSchema schema : schemas) {
 *     System.out.println(schema.getName());
 * }
 *
 * // Stream API
 * schemas.stream()
 *     .filter(s -> s.getTags().contains("Public"))
 *     .forEach(System.out::println);
 *
 * // Auto-pagination
 * schemas.autoPaginate()
 *     .forEach(schema -> process(schema));
 * </pre>
 */
public class DatabaseSchemaCollection implements Iterable<DatabaseSchema> {
  private final OpenMetadataClient client;
  private final ListParams params;
  private List<DatabaseSchema> currentPage;
  private String nextPageToken;
  private boolean hasMore;
  private boolean autoPaginate;

  public DatabaseSchemaCollection(OpenMetadataClient client) {
    this(client, new ListParams());
  }

  public DatabaseSchemaCollection(OpenMetadataClient client, ListParams params) {
    this.client = client;
    this.params = params;
    this.hasMore = true;
    this.autoPaginate = false;
  }

  /**
   * Set the limit for each page.
   */
  public DatabaseSchemaCollection limit(int limit) {
    params.setLimit(limit);
    return this;
  }

  /**
   * Set the fields to include in the response.
   */
  public DatabaseSchemaCollection fields(String fields) {
    params.setFields(fields);
    return this;
  }

  /**
   * Set the after cursor for pagination.
   */
  public DatabaseSchemaCollection after(String after) {
    params.setAfter(after);
    return this;
  }

  /**
   * Set the before cursor for pagination.
   */
  public DatabaseSchemaCollection before(String before) {
    params.setBefore(before);
    return this;
  }

  /**
   * Enable auto-pagination to automatically fetch all pages.
   */
  public DatabaseSchemaCollection autoPaginate() {
    this.autoPaginate = true;
    return this;
  }

  /**
   * Get the current page of results.
   */
  public List<DatabaseSchema> getCurrentPage() {
    if (currentPage == null) {
      loadNextPage();
    }
    return currentPage;
  }

  /**
   * Check if there are more pages available.
   */
  public boolean hasNextPage() {
    return hasMore;
  }

  /**
   * Load the next page of results.
   */
  public boolean nextPage() {
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

      ListResponse<DatabaseSchema> response = client.databaseSchemas().list(pageParams);

      currentPage = response.getData();
      nextPageToken = response.getPaging() != null ? response.getPaging().getAfter() : null;
      hasMore = nextPageToken != null && !currentPage.isEmpty();

      return true;
    } catch (Exception e) {
      throw new RuntimeException("Failed to load next page", e);
    }
  }

  /**
   * Load the next page of results.
   */
  public boolean loadNextPage() {
    return nextPage();
  }

  /**
   * Reset the collection to start from the beginning.
   */
  public DatabaseSchemaCollection reset() {
    currentPage = null;
    nextPageToken = null;
    hasMore = true;
    return this;
  }

  @Override
  public Iterator<DatabaseSchema> iterator() {
    if (autoPaginate) {
      return new AutoPaginatingIterator();
    } else {
      return getCurrentPage().iterator();
    }
  }

  /**
   * Get a stream of database schemas.
   */
  public Stream<DatabaseSchema> stream() {
    if (autoPaginate) {
      Spliterator<DatabaseSchema> spliterator =
          Spliterators.spliteratorUnknownSize(
              new AutoPaginatingIterator(), Spliterator.ORDERED | Spliterator.NONNULL);
      return StreamSupport.stream(spliterator, false);
    } else {
      return getCurrentPage().stream();
    }
  }

  /**
   * Iterate over all database schemas across all pages.
   */
  public Iterable<DatabaseSchema> all() {
    return () -> new AutoPaginatingIterator();
  }

  /**
   * Collect all database schemas into a list (loads all pages).
   */
  public List<DatabaseSchema> toList() {
    List<DatabaseSchema> allSchemas = new ArrayList<>();
    for (DatabaseSchema schema : all()) {
      allSchemas.add(schema);
    }
    return allSchemas;
  }

  /**
   * Iterator that automatically fetches new pages as needed.
   */
  private class AutoPaginatingIterator implements Iterator<DatabaseSchema> {
    private Iterator<DatabaseSchema> currentIterator;
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
    public DatabaseSchema next() {
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
          currentIterator = new ArrayList<DatabaseSchema>().iterator();
        }
        initialized = true;
      }
    }
  }
}
