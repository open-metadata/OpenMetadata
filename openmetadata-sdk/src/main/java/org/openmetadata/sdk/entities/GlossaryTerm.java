package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * SDK wrapper for GlossaryTerm operations.
 * This class provides static methods for GlossaryTerm CRUD operations.
 */
public class GlossaryTerm {
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

  // Static CRUD methods
  public static org.openmetadata.schema.entity.data.GlossaryTerm create(
      CreateGlossaryTerm request) {
    // Convert CreateGlossaryTerm to GlossaryTerm
    org.openmetadata.schema.entity.data.GlossaryTerm entity =
        new org.openmetadata.schema.entity.data.GlossaryTerm();
    entity.setName(request.getName());
    if (request.getDisplayName() != null) {
      entity.setDisplayName(request.getDisplayName());
    }
    if (request.getDescription() != null) {
      entity.setDescription(request.getDescription());
    }
    if (request.getGlossary() != null) {
      entity.setGlossary(
          new EntityReference().withFullyQualifiedName(request.getGlossary()).withType("glossary"));
    }
    if (request.getParent() != null) {
      entity.setParent(
          new EntityReference()
              .withFullyQualifiedName(request.getParent())
              .withType("glossaryTerm"));
    }
    if (request.getOwners() != null) {
      entity.setOwners(request.getOwners());
    }
    if (request.getTags() != null) {
      entity.setTags(request.getTags());
    }
    return getClient().glossaryTerms().create(entity);
  }

  public static org.openmetadata.schema.entity.data.GlossaryTerm retrieve(String id) {
    return getClient().glossaryTerms().get(id);
  }

  public static org.openmetadata.schema.entity.data.GlossaryTerm retrieve(
      String id, String fields) {
    return getClient().glossaryTerms().get(id, fields);
  }

  public static org.openmetadata.schema.entity.data.GlossaryTerm retrieveByName(String name) {
    return getClient().glossaryTerms().getByName(name);
  }

  public static org.openmetadata.schema.entity.data.GlossaryTerm retrieveByName(
      String name, String fields) {
    return getClient().glossaryTerms().getByName(name, fields);
  }

  public static org.openmetadata.schema.entity.data.GlossaryTerm update(
      String id, org.openmetadata.schema.entity.data.GlossaryTerm entity) {
    return getClient().glossaryTerms().update(id, entity);
  }

  public static org.openmetadata.schema.entity.data.GlossaryTerm update(
      org.openmetadata.schema.entity.data.GlossaryTerm entity) {
    if (entity.getId() == null) {
      throw new IllegalArgumentException("GlossaryTerm must have an ID for update");
    }
    return update(entity.getId().toString(), entity);
  }

  public static void delete(String id) {
    delete(id, false, false);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete) {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    getClient().glossaryTerms().delete(id, params);
  }

  // Async operations
  public static CompletableFuture<org.openmetadata.schema.entity.data.GlossaryTerm> createAsync(
      CreateGlossaryTerm request) {
    return CompletableFuture.supplyAsync(() -> create(request));
  }

  public static CompletableFuture<org.openmetadata.schema.entity.data.GlossaryTerm> retrieveAsync(
      String id) {
    return CompletableFuture.supplyAsync(() -> retrieve(id));
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(() -> delete(id, recursive, hardDelete));
  }
}
