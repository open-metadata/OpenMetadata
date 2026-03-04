package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.TermReference;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.collections.GlossaryTermCollection;

/**
 * Pure Fluent API for GlossaryTerm operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.GlossaryTerms.*;
 *
 * // Create
 * GlossaryTerm glossaryTerm = create()
 *     .name("glossaryTerm_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * GlossaryTerm glossaryTerm = find(glossaryTermId)
 *     .includeOwners()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * GlossaryTerm updated = find(glossaryTermId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(glossaryTermId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(glossaryTerm -> process(glossaryTerm));
 * </pre>
 */
public final class GlossaryTerms {
  private static OpenMetadataClient defaultClient;

  private GlossaryTerms() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call GlossaryTerms.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static GlossaryTermCreator create() {
    return new GlossaryTermCreator(getClient());
  }

  public static GlossaryTerm create(CreateGlossaryTerm request) {
    return getClient().glossaryTerms().create(request);
  }

  // ==================== Finding/Retrieval ====================

  public static GlossaryTermFinder find(String id) {
    return new GlossaryTermFinder(getClient(), id);
  }

  public static GlossaryTermFinder find(UUID id) {
    return find(id.toString());
  }

  public static GlossaryTermFinder findByName(String fqn) {
    return new GlossaryTermFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static GlossaryTermLister list() {
    return new GlossaryTermLister(getClient());
  }

  public static GlossaryTermCollection collection() {
    return new GlossaryTermCollection(getClient());
  }

  // ==================== Creator ====================

  public static class GlossaryTermCreator {
    private final OpenMetadataClient client;
    private final CreateGlossaryTerm request = new CreateGlossaryTerm();

    GlossaryTermCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public GlossaryTermCreator name(String name) {
      request.setName(name);
      return this;
    }

    public GlossaryTermCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public GlossaryTermCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public GlossaryTermCreator in(String glossary) {
      request.setGlossary(glossary);
      return this;
    }

    public GlossaryTermCreator under(String parentTerm) {
      request.setParent(parentTerm);
      return this;
    }

    public GlossaryTermCreator withSynonyms(java.util.List<String> synonyms) {
      request.setSynonyms(synonyms);
      return this;
    }

    public GlossaryTermCreator withRelatedTerms(java.util.List<String> relatedTerms) {
      request.setRelatedTerms(relatedTerms);
      return this;
    }

    public GlossaryTermCreator withReferences(java.util.List<TermReference> references) {
      request.setReferences(references);
      return this;
    }

    public GlossaryTermCreator withStringReferences(java.util.List<String> references) {
      // Convert string references to TermReference objects
      if (references != null) {
        List<TermReference> termRefs = new ArrayList<>();
        for (String ref : references) {
          TermReference termRef = new TermReference();
          termRef.setName(ref);
          try {
            termRef.setEndpoint(java.net.URI.create(ref));
          } catch (Exception e) {
            // If it's not a valid URI, just use the string as the name
            termRef.setName(ref);
          }
          termRefs.add(termRef);
        }
        request.setReferences(termRefs);
      }
      return this;
    }

    public GlossaryTerm execute() {
      return client.glossaryTerms().create(request);
    }

    public GlossaryTerm now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class GlossaryTermFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    GlossaryTermFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    GlossaryTermFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public GlossaryTermFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public GlossaryTermFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public GlossaryTermFinder includeAll() {
      includes.addAll(Arrays.asList("owner", "tags", "followers", "domain"));
      return this;
    }

    public FluentGlossaryTerm fetch() {
      GlossaryTerm glossaryTerm;
      if (includes.isEmpty()) {
        glossaryTerm =
            isFqn
                ? client.glossaryTerms().getByName(identifier)
                : client.glossaryTerms().get(identifier);
      } else {
        String fields = String.join(",", includes);
        glossaryTerm =
            isFqn
                ? client.glossaryTerms().getByName(identifier, fields)
                : client.glossaryTerms().get(identifier, fields);
      }
      return new FluentGlossaryTerm(glossaryTerm, client);
    }

    public GlossaryTermDeleter delete() {
      return new GlossaryTermDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class GlossaryTermDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    GlossaryTermDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public GlossaryTermDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public GlossaryTermDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.glossaryTerms().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class GlossaryTermLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    GlossaryTermLister(OpenMetadataClient client) {
      this.client = client;
    }

    public GlossaryTermLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public GlossaryTermLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentGlossaryTerm> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.glossaryTerms().list(params);
      List<FluentGlossaryTerm> items = new ArrayList<>();
      for (GlossaryTerm item : response.getData()) {
        items.add(new FluentGlossaryTerm(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentGlossaryTerm> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentGlossaryTerm {
    private final GlossaryTerm glossaryTerm;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentGlossaryTerm(GlossaryTerm glossaryTerm, OpenMetadataClient client) {
      this.glossaryTerm = glossaryTerm;
      this.client = client;
    }

    public GlossaryTerm get() {
      return glossaryTerm;
    }

    public FluentGlossaryTerm withDescription(String description) {
      glossaryTerm.setDescription(description);
      modified = true;
      return this;
    }

    public FluentGlossaryTerm withDisplayName(String displayName) {
      glossaryTerm.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentGlossaryTerm withTags(List<TagLabel> tags) {
      glossaryTerm.setTags(tags);
      modified = true;
      return this;
    }

    public FluentGlossaryTerm save() {
      if (modified) {
        GlossaryTerm updated =
            client.glossaryTerms().update(glossaryTerm.getId().toString(), glossaryTerm);
        glossaryTerm.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public GlossaryTermDeleter delete() {
      return new GlossaryTermDeleter(client, glossaryTerm.getId().toString());
    }
  }
}
