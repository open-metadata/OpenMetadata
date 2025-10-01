package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.services.teams.TeamService;

public class Team extends org.openmetadata.schema.entity.teams.Team {
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
  public static org.openmetadata.schema.entity.teams.Team create(CreateTeam request) {
    return getClient().teams().create(request);
  }

  public static org.openmetadata.schema.entity.teams.Team retrieve(String id) {
    return (org.openmetadata.schema.entity.teams.Team) getClient().teams().get(id);
  }

  public static org.openmetadata.schema.entity.teams.Team retrieve(String id, String fields) {
    return (org.openmetadata.schema.entity.teams.Team) getClient().teams().get(id, fields);
  }

  public static org.openmetadata.schema.entity.teams.Team retrieveByName(
      String fullyQualifiedName) {
    return (org.openmetadata.schema.entity.teams.Team)
        getClient().teams().getByName(fullyQualifiedName);
  }

  public static org.openmetadata.schema.entity.teams.Team retrieveByName(
      String fullyQualifiedName, String fields) {
    return (org.openmetadata.schema.entity.teams.Team)
        getClient().teams().getByName(fullyQualifiedName, fields);
  }

  public static TeamCollection list() {
    return new TeamCollection(getClient().teams());
  }

  public static TeamCollection list(TeamListParams params) {
    return new TeamCollection(getClient().teams(), params);
  }

  public static org.openmetadata.schema.entity.teams.Team update(
      String id, org.openmetadata.schema.entity.teams.Team team) {
    return (org.openmetadata.schema.entity.teams.Team) getClient().teams().update(id, team);
  }

  public static org.openmetadata.schema.entity.teams.Team patch(String id, String jsonPatch) {
    try {
      com.fasterxml.jackson.databind.ObjectMapper mapper =
          new com.fasterxml.jackson.databind.ObjectMapper();
      com.fasterxml.jackson.databind.JsonNode patchNode = mapper.readTree(jsonPatch);
      return getClient().teams().patch(id, patchNode);
    } catch (Exception e) {
      throw new org.openmetadata.sdk.exceptions.OpenMetadataException(
          "Failed to parse JSON patch: " + e.getMessage(), e);
    }
  }

  public static void delete(String id) {
    delete(id, false, false);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete) {
    TeamService service = getClient().teams();
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    service.delete(id, params);
  }

  // Async operations
  public static CompletableFuture<org.openmetadata.schema.entity.teams.Team> createAsync(
      CreateTeam request) {
    return CompletableFuture.supplyAsync(() -> create(request));
  }

  public static CompletableFuture<org.openmetadata.schema.entity.teams.Team> retrieveAsync(
      String id) {
    return CompletableFuture.supplyAsync(() -> retrieve(id));
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(() -> delete(id, recursive, hardDelete));
  }

  // Instance methods
  public org.openmetadata.schema.entity.teams.Team save() {
    if (this.getId() != null) {
      return update(this.getId().toString(), this);
    } else {
      throw new IllegalStateException("Cannot save a team without an ID");
    }
  }

  public void delete() {
    if (this.getId() != null) {
      delete(this.getId().toString());
    } else {
      throw new IllegalStateException("Cannot delete a team without an ID");
    }
  }

  // Collection class with iterator support
  public static class TeamCollection {
    private final TeamService service;
    private final TeamListParams params;

    TeamCollection(TeamService service) {
      this(service, null);
    }

    TeamCollection(TeamService service, TeamListParams params) {
      this.service = service;
      this.params = params;
    }

    public Iterable<org.openmetadata.schema.entity.teams.Team> autoPagingIterable() {
      return new Iterable<org.openmetadata.schema.entity.teams.Team>() {
        @Override
        public Iterator<org.openmetadata.schema.entity.teams.Team> iterator() {
          return new TeamIterator(service, params);
        }
      };
    }
  }

  // List params
  public static class TeamListParams {
    private Integer limit;
    private String before;
    private String after;
    private String fields;
    private String domain;
    private Boolean isJoinable;

    public static Builder builder() {
      return new Builder();
    }

    public static class Builder {
      private TeamListParams params = new TeamListParams();

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

      public Builder isJoinable(Boolean isJoinable) {
        params.isJoinable = isJoinable;
        return this;
      }

      public TeamListParams build() {
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
  private static class TeamIterator implements Iterator<org.openmetadata.schema.entity.teams.Team> {
    private final TeamService service;
    private final TeamListParams params;
    private Iterator<org.openmetadata.schema.entity.teams.Team> currentPage;
    private String nextPageToken;
    private boolean hasMore = true;

    TeamIterator(TeamService service, TeamListParams params) {
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
    public org.openmetadata.schema.entity.teams.Team next() {
      if (!hasNext()) {
        throw new java.util.NoSuchElementException();
      }
      return (org.openmetadata.schema.entity.teams.Team) currentPage.next();
    }
  }
}
