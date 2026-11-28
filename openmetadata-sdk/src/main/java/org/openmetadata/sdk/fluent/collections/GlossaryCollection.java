package org.openmetadata.sdk.fluent.collections;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Spliterator;
import java.util.Spliterators;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Collection for iterating over Glossary entities with auto-pagination support.
 *
 * Usage:
 * <pre>
 * // Basic iteration
 * GlossaryCollection glossaries = Glossaries.collection();
 * for (Glossary glossary : glossaries) {
 *     System.out.println(glossary.getName());
 * }
 *
 * // Stream API
 * glossaries.stream()
 *     .filter(g -> g.getTags().contains("Business"))
 *     .forEach(System.out::println);
 *
 * // Auto-pagination
 * glossaries.autoPaginate()
 *     .forEach(glossary -> process(glossary));
 * </pre>
 */
public class GlossaryCollection implements Iterable<Glossary> {
  private final OpenMetadataClient client;
  private final ListParams params;
  private List<Glossary> currentPage;
  private String nextPageToken;
  private boolean hasMore;
  private boolean autoPaginate;

  public GlossaryCollection(OpenMetadataClient client) {
    this(client, new ListParams());
  }

  public GlossaryCollection(OpenMetadataClient client, ListParams params) {
    this.client = client;
    this.params = params;
    this.hasMore = true;
    this.autoPaginate = false;
  }

  /**
   * Set the limit for each page.
   */
  public GlossaryCollection limit(int limit) {
    params.setLimit(limit);
    return this;
  }

  /**
   * Set the fields to include in the response.
   */
  public GlossaryCollection fields(String fields) {
    params.setFields(fields);
    return this;
  }

  /**
   * Set the after cursor for pagination.
   */
  public GlossaryCollection after(String after) {
    params.setAfter(after);
    return this;
  }

  /**
   * Set the before cursor for pagination.
   */
  public GlossaryCollection before(String before) {
    params.setBefore(before);
    return this;
  }

  /**
   * Enable auto-pagination to automatically fetch all pages.
   */
  public GlossaryCollection autoPaginate() {
    this.autoPaginate = true;
    return this;
  }

  /**
   * Get the current page of results.
   */
  public List<Glossary> getCurrentPage() {
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
    PageResult page = fetchPage(nextPageToken);
    currentPage = page.data;
    nextPageToken = page.nextCursor;
    hasMore = page.hasMore;
    return true;
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
  public GlossaryCollection reset() {
    currentPage = null;
    nextPageToken = null;
    hasMore = true;
    return this;
  }

  @Override
  public Iterator<Glossary> iterator() {
    if (autoPaginate) {
      return new AutoPaginatingIterator();
    } else {
      return getCurrentPage().iterator();
    }
  }

  /**
   * Get a stream of glossaries.
   */
  public Stream<Glossary> stream() {
    if (autoPaginate) {
      Spliterator<Glossary> spliterator =
          Spliterators.spliteratorUnknownSize(
              new AutoPaginatingIterator(), Spliterator.ORDERED | Spliterator.NONNULL);
      return StreamSupport.stream(spliterator, false);
    } else {
      return getCurrentPage().stream();
    }
  }

  /**
   * Iterate over all glossaries across all pages.
   */
  public Iterable<Glossary> all() {
    return () -> new AutoPaginatingIterator();
  }

  /**
   * Collect all glossaries into a list (loads all pages).
   */
  public List<Glossary> toList() {
    List<Glossary> allGlossaries = new ArrayList<>();
    for (Glossary glossary : all()) {
      allGlossaries.add(glossary);
    }
    return allGlossaries;
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
      ListResponse<Glossary> response = client.glossaries().list(pageParams);
      List<Glossary> data = response.getData();
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
  private class AutoPaginatingIterator implements Iterator<Glossary> {
    private Iterator<Glossary> currentIterator = List.<Glossary>of().iterator();
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
    public Glossary next() {
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
    final List<Glossary> data;
    final String nextCursor;
    final boolean hasMore;

    PageResult(List<Glossary> data, String nextCursor, boolean hasMore) {
      this.data = data;
      this.nextCursor = nextCursor;
      this.hasMore = hasMore;
    }
  }
}
