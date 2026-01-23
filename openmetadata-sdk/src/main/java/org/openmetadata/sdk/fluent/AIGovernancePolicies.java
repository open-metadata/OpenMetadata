package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.ai.CreateAIGovernancePolicy;
import org.openmetadata.schema.entity.ai.AIGovernancePolicy;
import org.openmetadata.schema.entity.ai.PolicyType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent API for AIGovernancePolicy operations.
 *
 * <p>Usage:
 *
 * <pre>
 * // Create
 * AIGovernancePolicy policy = AIGovernancePolicies.create()
 *     .name("data-access-policy")
 *     .withDescription("AI data access governance policy")
 *     .withEnforcementLevel(EnforcementLevel.ENFORCED)
 *     .execute();
 *
 * // Find
 * AIGovernancePolicy policy = AIGovernancePolicies.find(policyId).fetch();
 *
 * // List
 * AIGovernancePolicies.list().limit(10).forEach(p -> process(p));
 * </pre>
 */
public final class AIGovernancePolicies {
  private static OpenMetadataClient defaultClient;

  private AIGovernancePolicies() {}

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call AIGovernancePolicies.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static AIGovernancePolicyCreator create() {
    return new AIGovernancePolicyCreator(getClient());
  }

  public static AIGovernancePolicy create(CreateAIGovernancePolicy request) {
    return getClient().aiGovernancePolicies().create(request);
  }

  // ==================== Direct Access ====================

  public static AIGovernancePolicy get(String id) {
    return getClient().aiGovernancePolicies().get(id);
  }

  public static AIGovernancePolicy get(String id, String fields) {
    return getClient().aiGovernancePolicies().get(id, fields);
  }

  public static AIGovernancePolicy getByName(String fqn) {
    return getClient().aiGovernancePolicies().getByName(fqn);
  }

  public static AIGovernancePolicy getByName(String fqn, String fields) {
    return getClient().aiGovernancePolicies().getByName(fqn, fields);
  }

  public static AIGovernancePolicy update(String id, AIGovernancePolicy entity) {
    return getClient().aiGovernancePolicies().update(id, entity);
  }

  public static void delete(String id) {
    getClient().aiGovernancePolicies().delete(id);
  }

  public static void delete(String id, Map<String, String> params) {
    getClient().aiGovernancePolicies().delete(id, params);
  }

  public static void restore(String id) {
    getClient().aiGovernancePolicies().restore(id);
  }

  // ==================== Finders ====================

  public static AIGovernancePolicyFinder find(String id) {
    return new AIGovernancePolicyFinder(getClient(), id);
  }

  public static AIGovernancePolicyFinder find(UUID id) {
    return find(id.toString());
  }

  public static AIGovernancePolicyFinder findByName(String fqn) {
    return new AIGovernancePolicyFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static AIGovernancePolicyLister list() {
    return new AIGovernancePolicyLister(getClient());
  }

  // ==================== Creator ====================

  public static class AIGovernancePolicyCreator {
    private final OpenMetadataClient client;
    private final CreateAIGovernancePolicy request = new CreateAIGovernancePolicy();

    AIGovernancePolicyCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public AIGovernancePolicyCreator name(String name) {
      request.setName(name);
      return this;
    }

    public AIGovernancePolicyCreator withPolicyType(PolicyType policyType) {
      request.setPolicyType(policyType);
      return this;
    }

    public AIGovernancePolicyCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public AIGovernancePolicyCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public AIGovernancePolicyCreator withEnforcementLevel(
        CreateAIGovernancePolicy.EnforcementLevel level) {
      request.setEnforcementLevel(level);
      return this;
    }

    public AIGovernancePolicyCreator withOwners(List<EntityReference> owners) {
      request.setOwners(owners);
      return this;
    }

    public AIGovernancePolicy execute() {
      return client.aiGovernancePolicies().create(request);
    }

    public AIGovernancePolicy now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class AIGovernancePolicyFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    AIGovernancePolicyFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    AIGovernancePolicyFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public AIGovernancePolicyFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public AIGovernancePolicyFinder withFields(String... fields) {
      includes.addAll(Arrays.asList(fields));
      return this;
    }

    public AIGovernancePolicyFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "domain"));
      return this;
    }

    public FluentAIGovernancePolicy fetch() {
      AIGovernancePolicy entity;
      if (includes.isEmpty()) {
        entity =
            isFqn
                ? client.aiGovernancePolicies().getByName(identifier)
                : client.aiGovernancePolicies().get(identifier);
      } else {
        String fields = String.join(",", includes);
        entity =
            isFqn
                ? client.aiGovernancePolicies().getByName(identifier, fields)
                : client.aiGovernancePolicies().get(identifier, fields);
      }
      return new FluentAIGovernancePolicy(entity, client);
    }

    public AIGovernancePolicy get() {
      return fetch().get();
    }

    public AIGovernancePolicyDeleter delete() {
      return new AIGovernancePolicyDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class AIGovernancePolicyDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean hardDelete = false;

    AIGovernancePolicyDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public AIGovernancePolicyDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (hardDelete) params.put("hardDelete", "true");
      client.aiGovernancePolicies().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class AIGovernancePolicyLister {
    private final OpenMetadataClient client;
    private Integer limit;
    private String after;
    private final Map<String, String> filters = new HashMap<>();

    AIGovernancePolicyLister(OpenMetadataClient client) {
      this.client = client;
    }

    public AIGovernancePolicyLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public AIGovernancePolicyLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public AIGovernancePolicyLister filter(String key, String value) {
      filters.put(key, value);
      return this;
    }

    public List<FluentAIGovernancePolicy> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.aiGovernancePolicies().list(params);
      List<FluentAIGovernancePolicy> items = new ArrayList<>();
      for (AIGovernancePolicy item : response.getData()) {
        items.add(new FluentAIGovernancePolicy(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentAIGovernancePolicy> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentAIGovernancePolicy {
    private final AIGovernancePolicy entity;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentAIGovernancePolicy(AIGovernancePolicy entity, OpenMetadataClient client) {
      this.entity = entity;
      this.client = client;
    }

    public AIGovernancePolicy get() {
      return entity;
    }

    public FluentAIGovernancePolicy withDescription(String description) {
      entity.setDescription(description);
      modified = true;
      return this;
    }

    public FluentAIGovernancePolicy withDisplayName(String displayName) {
      entity.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentAIGovernancePolicy withOwners(List<EntityReference> owners) {
      entity.setOwners(owners);
      modified = true;
      return this;
    }

    public FluentAIGovernancePolicy save() {
      if (modified) {
        AIGovernancePolicy updated =
            client.aiGovernancePolicies().update(entity.getId().toString(), entity);
        entity.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public AIGovernancePolicyDeleter delete() {
      return new AIGovernancePolicyDeleter(client, entity.getId().toString());
    }
  }
}
