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

    try {
      ListParams pageParams = new ListParams();
      pageParams.setLimit(params.getLimit());
      pageParams.setFields(params.getFields());

      if (nextPageToken != null) {
        pageParams.setAfter(nextPageToken);
      } else if (params.getAfter() != null) {
        pageParams.setAfter(params.getAfter());
      }

      ListResponse<GlossaryTerm> response = client.glossaryTerms().list(pageParams);

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
   * Iterator that automatically fetches new pages as needed.
   */
  private class AutoPaginatingIterator implements Iterator<GlossaryTerm> {
    private Iterator<GlossaryTerm> currentIterator;
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
    public GlossaryTerm next() {
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
          currentIterator = new ArrayList<GlossaryTerm>().iterator();
        }
        initialized = true;
      }
    }
  }
}
