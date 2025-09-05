package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class Glossary extends org.openmetadata.schema.entity.data.Glossary {

  public static Glossary create(org.openmetadata.schema.entity.data.Glossary entity)
      throws OpenMetadataException {
    return (Glossary) OpenMetadata.client().glossaries().create(entity);
  }

  public static Glossary retrieve(String id) throws OpenMetadataException {
    return (Glossary) OpenMetadata.client().glossaries().get(id);
  }

  public static Glossary retrieve(UUID id) throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static Glossary retrieveByName(String name) throws OpenMetadataException {
    return (Glossary) OpenMetadata.client().glossaries().getByName(name);
  }

  public static Glossary update(String id, org.openmetadata.schema.entity.data.Glossary patch)
      throws OpenMetadataException {
    return (Glossary) OpenMetadata.client().glossaries().patch(id, patch);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    OpenMetadata.client().glossaries().delete(id, params);
  }

  public static ListResponse<org.openmetadata.schema.entity.data.Glossary> list()
      throws OpenMetadataException {
    return OpenMetadata.client().glossaries().list();
  }

  public static ListResponse<org.openmetadata.schema.entity.data.Glossary> list(ListParams params)
      throws OpenMetadataException {
    return OpenMetadata.client().glossaries().list(params);
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

  public static String exportCsv(String glossaryId) throws OpenMetadataException {
    return OpenMetadata.client().glossaries().exportCsv(glossaryId);
  }

  public static String importCsv(String csvData) throws OpenMetadataException {
    return OpenMetadata.client().glossaries().importCsv(csvData);
  }

  public static String importCsv(String csvData, boolean dryRun) throws OpenMetadataException {
    return OpenMetadata.client().glossaries().importCsv(csvData, dryRun);
  }

  public static CompletableFuture<String> exportCsvAsync(String glossaryId) {
    return CompletableFuture.supplyAsync(
        () -> {
          try {
            return exportCsv(glossaryId);
          } catch (OpenMetadataException e) {
            throw new RuntimeException(e);
          }
        });
  }

  public static CompletableFuture<String> importCsvAsync(String csvData) {
    return CompletableFuture.supplyAsync(
        () -> {
          try {
            return importCsv(csvData);
          } catch (OpenMetadataException e) {
            throw new RuntimeException(e);
          }
        });
  }

  public static CompletableFuture<String> importCsvAsync(String csvData, boolean dryRun) {
    return CompletableFuture.supplyAsync(
        () -> {
          try {
            return importCsv(csvData, dryRun);
          } catch (OpenMetadataException e) {
            throw new RuntimeException(e);
          }
        });
  }
}
