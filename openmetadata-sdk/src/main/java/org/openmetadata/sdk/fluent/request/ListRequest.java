package org.openmetadata.sdk.fluent.request;

import java.util.function.Function;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Fluent builder for list operations with filtering and pagination.
 *
 * Usage:
 * <pre>
 * // Simple listing
 * var tables = Tables.list().fetch();
 *
 * // With pagination
 * var tables = Tables.list()
 *     .limit(50)
 *     .after("cursor123")
 *     .fetch();
 *
 * // With filtering
 * var tables = Tables.list()
 *     .filter("database", "sales_db")
 *     .limit(100)
 *     .fetch();
 *
 * // Iterate through all pages
 * Tables.list()
 *     .limit(50)
 *     .autoPaginate()
 *     .forEach(table -> process(table));
 * </pre>
 *
 * @param <T> The entity type being listed
 */
public class ListRequest<T> {
  private final Function<ListParams, ListResponse<T>> listFunction;
  private final ListParams params = new ListParams();
  private boolean autoPaginate = false;

  public ListRequest(Function<ListParams, ListResponse<T>> listFunction) {
    this.listFunction = listFunction;
  }

  /**
   * Set the maximum number of items to return.
   *
   * @param limit The limit (1-1000)
   * @return This request for chaining
   */
  public ListRequest<T> limit(int limit) {
    if (limit < 1 || limit > 1000) {
      throw new IllegalArgumentException("Limit must be between 1 and 1000");
    }
    params.setLimit(limit);
    return this;
  }

  /**
   * Set the cursor for pagination.
   *
   * @param after The cursor token from a previous response
   * @return This request for chaining
   */
  public ListRequest<T> after(String after) {
    params.setAfter(after);
    return this;
  }

  /**
   * Set the cursor for reverse pagination.
   *
   * @param before The cursor token
   * @return This request for chaining
   */
  public ListRequest<T> before(String before) {
    params.setBefore(before);
    return this;
  }

  /**
   * Add a filter parameter.
   *
   * @param key The filter key
   * @param value The filter value
   * @return This request for chaining
   */
  public ListRequest<T> filter(String key, String value) {
    params.addFilter(key, value);
    return this;
  }

  /**
   * Include specific fields in the response.
   *
   * @param fields The fields to include
   * @return This request for chaining
   */
  public ListRequest<T> include(String... fields) {
    params.setFields(String.join(",", fields));
    return this;
  }

  /**
   * Enable auto-pagination to fetch all results.
   *
   * @return This request for chaining
   */
  public ListRequest<T> autoPaginate() {
    this.autoPaginate = true;
    return this;
  }

  /**
   * Execute the list operation.
   *
   * @return The list response
   */
  public ListResponse<T> fetch() {
    return listFunction.apply(params);
  }

  /**
   * Execute and return an iterable for all pages.
   *
   * @return An iterable that fetches pages on demand
   */
  public Iterable<T> fetchAll() {
    return new PaginatedIterable<>(listFunction, params);
  }

  /**
   * Execute and iterate through results with a callback.
   *
   * @param callback The callback for each item
   */
  public void forEach(java.util.function.Consumer<T> callback) {
    if (autoPaginate) {
      fetchAll().forEach(callback);
    } else {
      fetch().getData().forEach(callback);
    }
  }

  /**
   * Private helper class for paginated iteration.
   */
  private static class PaginatedIterable<T> implements Iterable<T> {
    private final Function<ListParams, ListResponse<T>> listFunction;
    private final ListParams initialParams;

    PaginatedIterable(Function<ListParams, ListResponse<T>> listFunction, ListParams params) {
      this.listFunction = listFunction;
      this.initialParams = params.copy();
    }

    @Override
    public java.util.Iterator<T> iterator() {
      return new PaginatedIterator<>(listFunction, initialParams);
    }
  }

  /**
   * Private helper class for paginated iterator.
   */
  private static class PaginatedIterator<T> implements java.util.Iterator<T> {
    private final Function<ListParams, ListResponse<T>> listFunction;
    private final ListParams params;
    private ListResponse<T> currentPage;
    private java.util.Iterator<T> currentIterator;

    PaginatedIterator(Function<ListParams, ListResponse<T>> listFunction, ListParams params) {
      this.listFunction = listFunction;
      this.params = params;
      fetchNextPage();
    }

    private void fetchNextPage() {
      currentPage = listFunction.apply(params);
      currentIterator = currentPage.getData().iterator();

      // Update params for next page
      if (currentPage.getPaging() != null && currentPage.getPaging().getAfter() != null) {
        params.setAfter(currentPage.getPaging().getAfter());
      }
    }

    @Override
    public boolean hasNext() {
      if (currentIterator.hasNext()) {
        return true;
      }

      // Check if there are more pages
      if (currentPage.getPaging() != null && currentPage.getPaging().getAfter() != null) {
        fetchNextPage();
        return currentIterator.hasNext();
      }

      return false;
    }

    @Override
    public T next() {
      return currentIterator.next();
    }
  }
}
