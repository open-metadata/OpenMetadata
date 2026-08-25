package org.openmetadata.sdk.services.importexport;

import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

public class ImportExportAPI {
  private final HttpClient httpClient;

  public ImportExportAPI(HttpClient httpClient) {
    this.httpClient = httpClient;
  }

  public String exportEntities(String entityType) throws OpenMetadataException {
    return exportEntities(entityType, null, null);
  }

  public String exportEntities(String entityType, String format, String filter)
      throws OpenMetadataException {
    RequestOptions.Builder optionsBuilder = RequestOptions.builder();

    if (format != null) optionsBuilder.queryParam("format", format);
    if (filter != null) optionsBuilder.queryParam("filter", filter);

    return httpClient.executeForString(
        HttpMethod.GET, String.format("/v1/export/%s", entityType), null, optionsBuilder.build());
  }

  public CompletableFuture<String> exportEntitiesAsync(String entityType) {
    return exportEntitiesAsync(entityType, null, null);
  }

  public CompletableFuture<String> exportEntitiesAsync(
      String entityType, String format, String filter) {
    RequestOptions.Builder optionsBuilder = RequestOptions.builder();

    if (format != null) optionsBuilder.queryParam("format", format);
    if (filter != null) optionsBuilder.queryParam("filter", filter);

    return httpClient.executeForStringAsync(
        HttpMethod.GET, String.format("/v1/export/%s", entityType), null, optionsBuilder.build());
  }

  public String importEntities(String entityType, String data) throws OpenMetadataException {
    return importEntities(entityType, data, false);
  }

  public String importEntities(String entityType, String data, boolean dryRun)
      throws OpenMetadataException {
    RequestOptions options =
        RequestOptions.builder()
            .header("Content-Type", "application/json")
            .queryParam("dryRun", String.valueOf(dryRun))
            .build();

    return httpClient.executeForString(
        HttpMethod.POST, String.format("/v1/import/%s", entityType), data, options);
  }

  public CompletableFuture<String> importEntitiesAsync(String entityType, String data) {
    return importEntitiesAsync(entityType, data, false);
  }

  public CompletableFuture<String> importEntitiesAsync(
      String entityType, String data, boolean dryRun) {
    RequestOptions options =
        RequestOptions.builder()
            .header("Content-Type", "application/json")
            .queryParam("dryRun", String.valueOf(dryRun))
            .build();

    return httpClient.executeForStringAsync(
        HttpMethod.POST, String.format("/v1/import/%s", entityType), data, options);
  }

  public String exportDatabase(String databaseId) throws OpenMetadataException {
    return httpClient.executeForString(
        HttpMethod.GET, String.format("/v1/databases/%s/export", databaseId), null);
  }

  public String exportGlossary(String glossaryId) throws OpenMetadataException {
    return httpClient.executeForString(
        HttpMethod.GET, String.format("/v1/glossaries/%s/export", glossaryId), null);
  }

  public String importGlossary(String glossaryId, String data) throws OpenMetadataException {
    RequestOptions options =
        RequestOptions.builder().header("Content-Type", "application/json").build();

    return httpClient.executeForString(
        HttpMethod.POST, String.format("/v1/glossaries/%s/import", glossaryId), data, options);
  }

  public String getImportStatus(String jobId) throws OpenMetadataException {
    return httpClient.executeForString(
        HttpMethod.GET, String.format("/v1/import/status/%s", jobId), null);
  }

  public String getExportStatus(String jobId) throws OpenMetadataException {
    return httpClient.executeForString(
        HttpMethod.GET, String.format("/v1/export/status/%s", jobId), null);
  }
}
