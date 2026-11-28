package org.openmetadata.sdk.fluent.collections;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Spliterator;
import java.util.Spliterators;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Collection for iterating over Pipeline entities with auto-pagination support.
 *
 * Usage:
 * <pre>
 * // Basic iteration
 * PipelineCollection pipelines = Pipelines.list();
 * for (Pipeline pipeline : pipelines) {
 *     System.out.println(pipeline.getName());
 * }
 *
 * // Stream API
 * pipelines.stream()
 *     .filter(p -> p.getConcurrency() > 5)
 *     .forEach(System.out::println);
 *
 * // Auto-pagination
 * pipelines.autoPaginate()
 *     .forEach(pipeline -> process(pipeline));
 * </pre>
 */
public class PipelineCollection implements Iterable<Pipeline> {
  private final OpenMetadataClient client;
  private final ListParams params;
  private List<Pipeline> currentPage;
  private String nextPageToken;
  private boolean hasMore;
  private boolean autoPaginate;

  public PipelineCollection(OpenMetadataClient client) {
    this(client, new ListParams());
  }

  public PipelineCollection(OpenMetadataClient client, ListParams params) {
    this.client = client;
    this.params = params;
    this.hasMore = true;
    this.autoPaginate = false;
  }

  /**
   * Set the limit for each page.
   */
  public PipelineCollection limit(int limit) {
    params.setLimit(limit);
    return this;
  }

  /**
   * Set the fields to include in the response.
   */
  public PipelineCollection fields(String fields) {
    params.setFields(fields);
    return this;
  }

  /**
   * Set the after cursor for pagination.
   */
  public PipelineCollection after(String after) {
    params.setAfter(after);
    return this;
  }

  /**
   * Set the before cursor for pagination.
   */
  public PipelineCollection before(String before) {
    params.setBefore(before);
    return this;
  }

  /**
   * Enable auto-pagination to automatically fetch all pages.
   */
  public PipelineCollection autoPaginate() {
    this.autoPaginate = true;
    return this;
  }

  /**
   * Get the current page of results.
   */
  public List<Pipeline> getCurrentPage() {
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
    PageResult page = fetchPage(nextPageToken);
    currentPage = page.data;
    nextPageToken = page.nextCursor;
    hasMore = page.hasMore;
    return true;
  }

  /**
   * Reset the collection to start from the beginning.
   */
  public PipelineCollection reset() {
    currentPage = null;
    nextPageToken = null;
    hasMore = true;
    return this;
  }

  @Override
  public Iterator<Pipeline> iterator() {
    if (autoPaginate) {
      return new AutoPaginatingIterator();
    } else {
      return getCurrentPage().iterator();
    }
  }

  /**
   * Get a stream of pipelines.
   */
  public Stream<Pipeline> stream() {
    if (autoPaginate) {
      Spliterator<Pipeline> spliterator =
          Spliterators.spliteratorUnknownSize(
              new AutoPaginatingIterator(), Spliterator.ORDERED | Spliterator.NONNULL);
      return StreamSupport.stream(spliterator, false);
    } else {
      return getCurrentPage().stream();
    }
  }

  /**
   * Iterate over all pipelines across all pages.
   */
  public Iterable<Pipeline> all() {
    return () -> new AutoPaginatingIterator();
  }

  /**
   * Collect all pipelines into a list (loads all pages).
   */
  public List<Pipeline> toList() {
    List<Pipeline> allPipelines = new ArrayList<>();
    for (Pipeline pipeline : all()) {
      allPipelines.add(pipeline);
    }
    return allPipelines;
  }

  /**
   * Fetch a single page from the server using the given cursor.
   *
   * <p>When {@code cursor} is {@code null} the request preserves the user's own start cursor
   * ({@code params.getAfter()} / {@code params.getBefore()}); when {@code cursor} is non-null it
   * overrides {@code after} and clears {@code before} so the server never sees both cursors. This
   * method never reads or writes collection cursor state, so it is safe to call from multiple
   * independent iterators without them interfering with each other or with the manual-pagination
   * API.
   */
  private PageResult fetchPage(String cursor) {
    try {
      ListParams pageParams = params.copy();
      if (cursor != null) {
        pageParams.setAfter(cursor);
        pageParams.setBefore(null);
      }
      ListResponse<Pipeline> response = client.pipelines().list(pageParams);
      List<Pipeline> data = response.getData();
      String nextCursor = response.getPaging() != null ? response.getPaging().getAfter() : null;
      boolean more = nextCursor != null && !data.isEmpty();
      return new PageResult(data, nextCursor, more);
    } catch (Exception e) {
      throw new RuntimeException("Failed to load next page", e);
    }
  }

  /**
   * Iterator that automatically fetches new pages as needed.
   *
   * <p>Each iterator owns its own cursor state, so multiple iterators created from the same
   * collection — including interleaved or nested traversals, and {@code stream()} / {@code
   * all()} calls opened while another traversal is in progress — advance independently and never
   * clobber each other's position. The collection-level cursor is left exclusively to the
   * manual-pagination API.
   */
  private class AutoPaginatingIterator implements Iterator<Pipeline> {
    private Iterator<Pipeline> currentIterator = List.<Pipeline>of().iterator();
    private String nextPageToken = null;
    private boolean hasMore = true;
    private boolean initialized = false;

    @Override
    public boolean hasNext() {
      if (!initialized) {
        initialize();
      }
      if (currentIterator.hasNext()) {
        return true;
      }
      if (hasMore) {
        fetchNextPage();
        return currentIterator.hasNext();
      }
      return false;
    }

    @Override
    public Pipeline next() {
      if (!hasNext()) {
        throw new NoSuchElementException();
      }
      return currentIterator.next();
    }

    private void initialize() {
      if (!initialized) {
        fetchNextPage();
        initialized = true;
      }
    }

    private void fetchNextPage() {
      PageResult page = fetchPage(nextPageToken);
      currentIterator = page.data.iterator();
      nextPageToken = page.nextCursor;
      hasMore = page.hasMore;
    }
  }

  /** Holder for the data, next-page cursor and hasMore flag of a single fetched page. */
  private static final class PageResult {
    final List<Pipeline> data;
    final String nextCursor;
    final boolean hasMore;

    PageResult(List<Pipeline> data, String nextCursor, boolean hasMore) {
      this.data = data;
      this.nextCursor = nextCursor;
      this.hasMore = hasMore;
    }
  }
}
