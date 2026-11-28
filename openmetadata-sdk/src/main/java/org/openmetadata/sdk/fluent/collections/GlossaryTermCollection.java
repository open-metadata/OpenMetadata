package org.openmetadata.sdk.fluent.collections;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Spliterator;
import java.util.Spliterators;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Collection for iterating over GlossaryTerm entities with auto-pagination support.
 *
 * Usage:
 * <pre>
 * // Basic iteration
 * GlossaryTermCollection terms = GlossaryTerms.collection();
 * for (GlossaryTerm term : terms) {
 *     System.out.println(term.getName());
 * }
 *
 * // Stream API
 * terms.stream()
 *     .filter(t -> t.getGlossary().getName().equals("Business"))
 *     .forEach(System.out::println);
 *
 * // Auto-pagination
 * terms.autoPaginate()
 *     .forEach(term -> process(term));
 * </pre>
 */
public class GlossaryTermCollection implements Iterable<GlossaryTerm> {
  private final OpenMetadataClient client;
  private final ListParams params;
  private List<GlossaryTerm> currentPage;
  private String nextPageToken;
  private boolean hasMore;
  private boolean autoPaginate;

  public GlossaryTermCollection(OpenMetadataClient client) {
    this(client, new ListParams());
  }

  public GlossaryTermCollection(OpenMetadataClient client, ListParams params) {
    this.client = client;
    this.params = params;
    this.hasMore = true;
    this.autoPaginate = false;
  }

  /**
   * Set the limit for each page.
   */
  public GlossaryTermCollection limit(int limit) {
    params.setLimit(limit);
    return this;
  }

  /**
   * Set the fields to include in the response.
   */
  public GlossaryTermCollection fields(String fields) {
    params.setFields(fields);
    return this;
  }

  /**
   * Set the after cursor for pagination.
   */
  public GlossaryTermCollection after(String after) {
    params.setAfter(after);
    return this;
  }

  /**
   * Set the before cursor for pagination.
   */
  public GlossaryTermCollection before(String before) {
    params.setBefore(before);
    return this;
  }

  /**
   * Enable auto-pagination to automatically fetch all pages.
   */
  public GlossaryTermCollection autoPaginate() {
    this.autoPaginate = true;
    return this;
  }

  /**
   * Get the current page of results.
   */
  public List<GlossaryTerm> getCurrentPage() {
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
  public GlossaryTermCollection reset() {
    currentPage = null;
    nextPageToken = null;
    hasMore = true;
    return this;
  }

  @Override
  public Iterator<GlossaryTerm> iterator() {
    if (autoPaginate) {
      return new AutoPaginatingIterator();
    } else {
      return getCurrentPage().iterator();
    }
  }

  /**
   * Get a stream of glossary terms.
   */
  public Stream<GlossaryTerm> stream() {
    if (autoPaginate) {
      Spliterator<GlossaryTerm> spliterator =
          Spliterators.spliteratorUnknownSize(
              new AutoPaginatingIterator(), Spliterator.ORDERED | Spliterator.NONNULL);
      return StreamSupport.stream(spliterator, false);
    } else {
      return getCurrentPage().stream();
    }
  }

  /**
   * Iterate over all glossary terms across all pages.
   */
  public Iterable<GlossaryTerm> all() {
    return () -> new AutoPaginatingIterator();
  }

  /**
   * Collect all glossary terms into a list (loads all pages).
   */
  public List<GlossaryTerm> toList() {
    List<GlossaryTerm> allTerms = new ArrayList<>();
    for (GlossaryTerm term : all()) {
      allTerms.add(term);
    }
    return allTerms;
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
      ListResponse<GlossaryTerm> response = client.glossaryTerms().list(pageParams);
      List<GlossaryTerm> data = response.getData();
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
  private class AutoPaginatingIterator implements Iterator<GlossaryTerm> {
    private Iterator<GlossaryTerm> currentIterator = List.<GlossaryTerm>of().iterator();
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
    public GlossaryTerm next() {
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
    final List<GlossaryTerm> data;
    final String nextCursor;
    final boolean hasMore;

    PageResult(List<GlossaryTerm> data, String nextCursor, boolean hasMore) {
      this.data = data;
      this.nextCursor = nextCursor;
      this.hasMore = hasMore;
    }
  }
}
