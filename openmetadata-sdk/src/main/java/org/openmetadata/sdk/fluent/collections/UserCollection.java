package org.openmetadata.sdk.fluent.collections;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Spliterator;
import java.util.Spliterators;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Collection for iterating over User entities with auto-pagination support.
 *
 * Usage:
 * <pre>
 * // Basic iteration
 * UserCollection users = Users.collection();
 * for (User user : users) {
 *     System.out.println(user.getName());
 * }
 *
 * // Stream API
 * users.stream()
 *     .filter(u -> u.getIsAdmin())
 *     .forEach(System.out::println);
 *
 * // Auto-pagination
 * users.autoPaginate()
 *     .forEach(user -> process(user));
 * </pre>
 */
public class UserCollection implements Iterable<User> {
  private final OpenMetadataClient client;
  private final ListParams params;
  private List<User> currentPage;
  private String nextPageToken;
  private boolean hasMore;
  private boolean autoPaginate;

  public UserCollection(OpenMetadataClient client) {
    this(client, new ListParams());
  }

  public UserCollection(OpenMetadataClient client, ListParams params) {
    this.client = client;
    this.params = params;
    this.hasMore = true;
    this.autoPaginate = false;
  }

  /**
   * Set the limit for each page.
   */
  public UserCollection limit(int limit) {
    params.setLimit(limit);
    return this;
  }

  /**
   * Set the fields to include in the response.
   */
  public UserCollection fields(String fields) {
    params.setFields(fields);
    return this;
  }

  /**
   * Set the after cursor for pagination.
   */
  public UserCollection after(String after) {
    params.setAfter(after);
    return this;
  }

  /**
   * Set the before cursor for pagination.
   */
  public UserCollection before(String before) {
    params.setBefore(before);
    return this;
  }

  /**
   * Enable auto-pagination to automatically fetch all pages.
   */
  public UserCollection autoPaginate() {
    this.autoPaginate = true;
    return this;
  }

  /**
   * Get the current page of results.
   */
  public List<User> getCurrentPage() {
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

      ListResponse<User> response = client.users().list(pageParams);

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
  public UserCollection reset() {
    currentPage = null;
    nextPageToken = null;
    hasMore = true;
    return this;
  }

  @Override
  public Iterator<User> iterator() {
    if (autoPaginate) {
      return new AutoPaginatingIterator();
    } else {
      return getCurrentPage().iterator();
    }
  }

  /**
   * Get a stream of users.
   */
  public Stream<User> stream() {
    if (autoPaginate) {
      Spliterator<User> spliterator =
          Spliterators.spliteratorUnknownSize(
              new AutoPaginatingIterator(), Spliterator.ORDERED | Spliterator.NONNULL);
      return StreamSupport.stream(spliterator, false);
    } else {
      return getCurrentPage().stream();
    }
  }

  /**
   * Iterate over all users across all pages.
   */
  public Iterable<User> all() {
    return () -> new AutoPaginatingIterator();
  }

  /**
   * Collect all users into a list (loads all pages).
   */
  public List<User> toList() {
    List<User> allUsers = new ArrayList<>();
    for (User user : all()) {
      allUsers.add(user);
    }
    return allUsers;
  }

  /**
   * Iterator that automatically fetches new pages as needed.
   */
  private class AutoPaginatingIterator implements Iterator<User> {
    private Iterator<User> currentIterator;
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
    public User next() {
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
          currentIterator = new ArrayList<User>().iterator();
        }
        initialized = true;
      }
    }
  }
}
