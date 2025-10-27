package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.services.teams.UserService;

public class User extends org.openmetadata.schema.entity.teams.User {
  private static OpenMetadataClient defaultClient;

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException("Default client not set. Call setDefaultClient() first.");
    }
    return defaultClient;
  }

  // Static CRUD methods - Stripe style
  public static org.openmetadata.schema.entity.teams.User create(CreateUser request) {
    return getClient().users().create(request);
  }

  public static org.openmetadata.schema.entity.teams.User retrieve(String id) {
    return (org.openmetadata.schema.entity.teams.User) getClient().users().get(id);
  }

  public static org.openmetadata.schema.entity.teams.User retrieve(String id, String fields) {
    return (org.openmetadata.schema.entity.teams.User) getClient().users().get(id, fields);
  }

  public static org.openmetadata.schema.entity.teams.User retrieveByName(
      String fullyQualifiedName) {
    return (org.openmetadata.schema.entity.teams.User)
        getClient().users().getByName(fullyQualifiedName);
  }

  public static org.openmetadata.schema.entity.teams.User retrieveByName(
      String fullyQualifiedName, String fields) {
    return (org.openmetadata.schema.entity.teams.User)
        getClient().users().getByName(fullyQualifiedName, fields);
  }

  public static UserCollection list() {
    return new UserCollection(getClient().users());
  }

  public static UserCollection list(UserListParams params) {
    return new UserCollection(getClient().users(), params);
  }

  public static org.openmetadata.schema.entity.teams.User update(
      String id, org.openmetadata.schema.entity.teams.User user) {
    return (org.openmetadata.schema.entity.teams.User) getClient().users().update(id, user);
  }

  public static org.openmetadata.schema.entity.teams.User patch(String id, String jsonPatch) {
    try {
      com.fasterxml.jackson.databind.ObjectMapper mapper =
          new com.fasterxml.jackson.databind.ObjectMapper();
      com.fasterxml.jackson.databind.JsonNode patchNode = mapper.readTree(jsonPatch);
      return getClient().users().patch(id, patchNode);
    } catch (Exception e) {
      throw new org.openmetadata.sdk.exceptions.OpenMetadataException(
          "Failed to parse JSON patch: " + e.getMessage(), e);
    }
  }

  public static void delete(String id) {
    delete(id, false, false);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete) {
    UserService service = getClient().users();
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    service.delete(id, params);
  }

  // Async operations
  public static CompletableFuture<org.openmetadata.schema.entity.teams.User> createAsync(
      CreateUser request) {
    return CompletableFuture.supplyAsync(() -> create(request));
  }

  public static CompletableFuture<org.openmetadata.schema.entity.teams.User> retrieveAsync(
      String id) {
    return CompletableFuture.supplyAsync(() -> retrieve(id));
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(() -> delete(id, recursive, hardDelete));
  }

  // Instance methods
  public org.openmetadata.schema.entity.teams.User save() {
    if (this.getId() != null) {
      return update(this.getId().toString(), this);
    } else {
      throw new IllegalStateException("Cannot save a user without an ID");
    }
  }

  public void delete() {
    if (this.getId() != null) {
      delete(this.getId().toString());
    } else {
      throw new IllegalStateException("Cannot delete a user without an ID");
    }
  }

  // Collection class with iterator support
  public static class UserCollection {
    private final UserService service;
    private final UserListParams params;

    UserCollection(UserService service) {
      this(service, null);
    }

    UserCollection(UserService service, UserListParams params) {
      this.service = service;
      this.params = params;
    }

    public Iterable<org.openmetadata.schema.entity.teams.User> autoPagingIterable() {
      return new Iterable<org.openmetadata.schema.entity.teams.User>() {
        @Override
        public Iterator<org.openmetadata.schema.entity.teams.User> iterator() {
          return new UserIterator(service, params);
        }
      };
    }
  }

  // List params
  public static class UserListParams {
    private Integer limit;
    private String before;
    private String after;
    private String fields;
    private String domain;
    private String team;

    public static Builder builder() {
      return new Builder();
    }

    public static class Builder {
      private UserListParams params = new UserListParams();

      public Builder limit(Integer limit) {
        params.limit = limit;
        return this;
      }

      public Builder before(String before) {
        params.before = before;
        return this;
      }

      public Builder after(String after) {
        params.after = after;
        return this;
      }

      public Builder fields(String fields) {
        params.fields = fields;
        return this;
      }

      public Builder domain(String domain) {
        params.domain = domain;
        return this;
      }

      public Builder team(String team) {
        params.team = team;
        return this;
      }

      public UserListParams build() {
        return params;
      }
    }

    public ListParams toListParams() {
      ListParams listParams = new ListParams();
      if (limit != null) listParams.setLimit(limit);
      if (before != null) listParams.setBefore(before);
      if (after != null) listParams.setAfter(after);
      if (fields != null) listParams.setFields(fields);
      // Additional params can be added to ListParams extensions
      return listParams;
    }
  }

  // Iterator for pagination
  private static class UserIterator implements Iterator<org.openmetadata.schema.entity.teams.User> {
    private final UserService service;
    private final UserListParams params;
    private Iterator<org.openmetadata.schema.entity.teams.User> currentPage;
    private String nextPageToken;
    private boolean hasMore = true;

    UserIterator(UserService service, UserListParams params) {
      this.service = service;
      this.params = params;
      loadNextPage();
    }

    private void loadNextPage() {
      if (!hasMore) {
        return;
      }

      ListParams listParams = params != null ? params.toListParams() : new ListParams();
      if (nextPageToken != null) {
        listParams.setAfter(nextPageToken);
      }

      var response = service.list(listParams);
      currentPage = response.getData().iterator();
      nextPageToken = response.getPaging() != null ? response.getPaging().getAfter() : null;
      hasMore = nextPageToken != null;
    }

    @Override
    public boolean hasNext() {
      if (currentPage.hasNext()) {
        return true;
      }
      if (hasMore) {
        loadNextPage();
        return currentPage.hasNext();
      }
      return false;
    }

    @Override
    public org.openmetadata.schema.entity.teams.User next() {
      if (!hasNext()) {
        throw new java.util.NoSuchElementException();
      }
      return (org.openmetadata.schema.entity.teams.User) currentPage.next();
    }
  }
}
