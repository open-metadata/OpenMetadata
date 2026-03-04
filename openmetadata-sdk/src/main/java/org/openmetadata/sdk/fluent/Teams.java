package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.collections.TeamCollection;

/**
 * Pure Fluent API for Team operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.Teams.*;
 *
 * // Create
 * Team team = create()
 *     .name("team_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * Team team = find(teamId)
 *     .includeOwners()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * Team updated = find(teamId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(teamId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(team -> process(team));
 * </pre>
 */
public final class Teams {
  private static OpenMetadataClient defaultClient;

  private Teams() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Teams.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static TeamCreator create() {
    return new TeamCreator(getClient());
  }

  public static Team create(CreateTeam request) {
    return getClient().teams().create(request);
  }

  // ==================== Direct Access Methods ====================

  public static Team get(String id) {
    return getClient().teams().get(id);
  }

  public static Team get(String id, String fields) {
    return getClient().teams().get(id, fields);
  }

  public static Team get(String id, String fields, String include) {
    return getClient().teams().get(id, fields, include);
  }

  public static Team getByName(String fqn) {
    return getClient().teams().getByName(fqn);
  }

  public static Team getByName(String fqn, String fields) {
    return getClient().teams().getByName(fqn, fields);
  }

  public static Team update(String id, Team entity) {
    return getClient().teams().update(id, entity);
  }

  public static void delete(String id) {
    getClient().teams().delete(id);
  }

  public static void delete(String id, java.util.Map<String, String> params) {
    getClient().teams().delete(id, params);
  }

  public static void restore(String id) {
    getClient().teams().restore(id);
  }

  public static org.openmetadata.sdk.models.ListResponse<Team> list(
      org.openmetadata.sdk.models.ListParams params) {
    return getClient().teams().list(params);
  }

  public static org.openmetadata.schema.type.EntityHistory getVersionList(java.util.UUID id) {
    return getClient().teams().getVersionList(id);
  }

  public static Team getVersion(String id, Double version) {
    return getClient().teams().getVersion(id, version);
  }

  // ==================== Finding/Retrieval ====================

  public static TeamFinder find(String id) {
    return new TeamFinder(getClient(), id);
  }

  public static TeamFinder find(UUID id) {
    return find(id.toString());
  }

  public static TeamFinder findByName(String fqn) {
    return new TeamFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static TeamLister list() {
    return new TeamLister(getClient());
  }

  public static TeamCollection collection() {
    return new TeamCollection(getClient());
  }

  // ==================== Creator ====================

  public static class TeamCreator {
    private final OpenMetadataClient client;
    private final CreateTeam request = new CreateTeam();

    TeamCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public TeamCreator name(String name) {
      request.setName(name);
      return this;
    }

    public TeamCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public TeamCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public TeamCreator withUsers(UUID... userIds) {
      request.setUsers(Arrays.asList(userIds));
      return this;
    }

    public Team execute() {
      return client.teams().create(request);
    }

    public Team now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class TeamFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    TeamFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    TeamFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public TeamFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public TeamFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public TeamFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "tags", "followers", "domain"));
      return this;
    }

    public FluentTeam fetch() {
      Team team;
      if (includes.isEmpty()) {
        team = isFqn ? client.teams().getByName(identifier) : client.teams().get(identifier);
      } else {
        String fields = String.join(",", includes);
        team =
            isFqn
                ? client.teams().getByName(identifier, fields)
                : client.teams().get(identifier, fields);
      }
      return new FluentTeam(team, client);
    }

    public TeamDeleter delete() {
      return new TeamDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class TeamDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    TeamDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public TeamDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public TeamDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.teams().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class TeamLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    TeamLister(OpenMetadataClient client) {
      this.client = client;
    }

    public TeamLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public TeamLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentTeam> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.teams().list(params);
      List<FluentTeam> items = new ArrayList<>();
      for (Team item : response.getData()) {
        items.add(new FluentTeam(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentTeam> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentTeam {
    private final Team team;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentTeam(Team team, OpenMetadataClient client) {
      this.team = team;
      this.client = client;
    }

    public Team get() {
      return team;
    }

    public FluentTeam withDescription(String description) {
      team.setDescription(description);
      modified = true;
      return this;
    }

    public FluentTeam withDisplayName(String displayName) {
      team.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentTeam save() {
      if (modified) {
        Team updated = client.teams().update(team.getId().toString(), team);
        team.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public TeamDeleter delete() {
      return new TeamDeleter(client, team.getId().toString());
    }

    public FluentTeam addUser(String userId) {
      // Add user logic
      modified = true;
      return this;
    }
  }
}
