package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class GlossaryTerm extends org.openmetadata.schema.entity.data.GlossaryTerm {

  public static GlossaryTerm create(org.openmetadata.schema.entity.data.GlossaryTerm entity)
      throws OpenMetadataException {
    return (GlossaryTerm) OpenMetadata.client().glossaryTerms().create(entity);
  }

  public static GlossaryTerm retrieve(String id) throws OpenMetadataException {
    return (GlossaryTerm) OpenMetadata.client().glossaryTerms().get(id);
  }

  public static GlossaryTerm retrieve(UUID id) throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static GlossaryTerm retrieveByName(String name) throws OpenMetadataException {
    return (GlossaryTerm) OpenMetadata.client().glossaryTerms().getByName(name);
  }

  public static GlossaryTerm update(
      String id, org.openmetadata.schema.entity.data.GlossaryTerm patch)
      throws OpenMetadataException {
    return (GlossaryTerm) OpenMetadata.client().glossaryTerms().patch(id, patch);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    OpenMetadata.client().glossaryTerms().delete(id, params);
  }

  public static ListResponse<org.openmetadata.schema.entity.data.GlossaryTerm> list()
      throws OpenMetadataException {
    return OpenMetadata.client().glossaryTerms().list();
  }

  public static ListResponse<org.openmetadata.schema.entity.data.GlossaryTerm> list(
      ListParams params) throws OpenMetadataException {
    return OpenMetadata.client().glossaryTerms().list(params);
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(
        () -> {
          try {
            delete(id, recursive, hardDelete);
          } catch (OpenMetadataException e) {
            throw new RuntimeException(e);
          }
        });
  }
}
