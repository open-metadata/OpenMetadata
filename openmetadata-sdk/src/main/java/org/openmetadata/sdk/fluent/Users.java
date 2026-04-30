package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.GenerateTokenRequest;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.collections.UserCollection;

/**
 * Pure Fluent API for User operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.Users.*;
 *
 * // Create
 * User user = create()
 *     .name("user_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * User user = find(userId)
 *     .includeOwners()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * User updated = find(userId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(userId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(user -> process(user));
 * </pre>
 */
public final class Users {
  private static OpenMetadataClient defaultClient;

  private Users() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Users.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static UserCreator create() {
    return new UserCreator(getClient());
  }

  public static User create(CreateUser request) {
    return getClient().users().create(request);
  }

  // ==================== Direct Access Methods ====================

  public static User get(String id) {
    return getClient().users().get(id);
  }

  public static User get(String id, String fields) {
    return getClient().users().get(id, fields);
  }

  public static User get(String id, String fields, String include) {
    return getClient().users().get(id, fields, include);
  }

  public static User getByName(String fqn) {
    return getClient().users().getByName(fqn);
  }

  public static User getByName(String fqn, String fields) {
    return getClient().users().getByName(fqn, fields);
  }

  public static User update(String id, User entity) {
    return getClient().users().update(id, entity);
  }

  public static void delete(String id) {
    getClient().users().delete(id);
  }

  public static void delete(String id, java.util.Map<String, String> params) {
    getClient().users().delete(id, params);
  }

  public static void restore(String id) {
    getClient().users().restore(id);
  }

  public static org.openmetadata.sdk.models.ListResponse<User> list(
      org.openmetadata.sdk.models.ListParams params) {
    return getClient().users().list(params);
  }

  public static org.openmetadata.schema.type.EntityHistory getVersionList(java.util.UUID id) {
    return getClient().users().getVersionList(id);
  }

  public static User getVersion(String id, Double version) {
    return getClient().users().getVersion(id, version);
  }

  // ==================== Token Generation ====================

  /**
   * Generate a JWT token for a user.
   *
   * <p>For bot users, the caller must have EDIT permission on the bot. For regular users, only the
   * user themselves can generate their own token.
   *
   * @param userId the user ID
   * @param expiry the token expiry
   * @return the JWT auth mechanism with the generated token
   */
  public static JWTAuthMechanism generateToken(UUID userId, JWTTokenExpiry expiry) {
    return getClient().users().generateToken(userId, expiry);
  }

  /**
   * Generate a JWT token for a user using the GenerateTokenRequest.
   *
   * @param request the generate token request containing user ID and expiry
   * @return the JWT auth mechanism with the generated token
   */
  public static JWTAuthMechanism generateToken(GenerateTokenRequest request) {
    return getClient().users().generateToken(request);
  }

  // ==================== Finding/Retrieval ====================

  public static UserFinder find(String id) {
    return new UserFinder(getClient(), id);
  }

  public static UserFinder find(UUID id) {
    return find(id.toString());
  }

  public static UserFinder findByName(String fqn) {
    return new UserFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static UserLister list() {
    return new UserLister(getClient());
  }

  public static UserCollection collection() {
    return new UserCollection(getClient());
  }

  // ==================== Creator ====================

  public static class UserCreator {
    private final OpenMetadataClient client;
    private final CreateUser request = new CreateUser();

    UserCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public UserCreator name(String name) {
      request.setName(name);
      return this;
    }

    public UserCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public UserCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public UserCreator withEmail(String email) {
      request.setEmail(email);
      return this;
    }

    public UserCreator inTeams(UUID... teamIds) {
      request.setTeams(Arrays.asList(teamIds));
      return this;
    }

    public User execute() {
      return client.users().create(request);
    }

    public User now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class UserFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    UserFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    UserFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public UserFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public UserFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public UserFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "tags", "followers", "domain"));
      return this;
    }

    public FluentUser fetch() {
      User user;
      if (includes.isEmpty()) {
        user = isFqn ? client.users().getByName(identifier) : client.users().get(identifier);
      } else {
        String fields = String.join(",", includes);
        user =
            isFqn
                ? client.users().getByName(identifier, fields)
                : client.users().get(identifier, fields);
      }
      return new FluentUser(user, client);
    }

    public UserDeleter delete() {
      return new UserDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class UserDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    UserDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public UserDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public UserDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.users().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class UserLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    UserLister(OpenMetadataClient client) {
      this.client = client;
    }

    public UserLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public UserLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentUser> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.users().list(params);
      List<FluentUser> items = new ArrayList<>();
      for (User item : response.getData()) {
        items.add(new FluentUser(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentUser> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentUser {
    private final User user;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentUser(User user, OpenMetadataClient client) {
      this.user = user;
      this.client = client;
    }

    public User get() {
      return user;
    }

    public FluentUser withDescription(String description) {
      user.setDescription(description);
      modified = true;
      return this;
    }

    public FluentUser withDisplayName(String displayName) {
      user.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentUser save() {
      if (modified) {
        User updated = client.users().update(user.getId().toString(), user);
        user.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public UserDeleter delete() {
      return new UserDeleter(client, user.getId().toString());
    }

    public FluentUser joinTeam(String teamId) {
      // Add team logic
      modified = true;
      return this;
    }
  }
}
