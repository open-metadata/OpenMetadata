package org.openmetadata.sdk.services.drives;

import org.openmetadata.schema.api.data.CreateContextFile;
import org.openmetadata.schema.api.data.MoveContextFileRequest;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

/**
 * Service client for Context Center File ({@code ContextFile}) operations.
 *
 * <p>Speaks to {@code /v1/contextCenter/drive/files} on the OpenMetadata server. Provides standard
 * CRUD plus Context-Center-specific moves. Binary download and multipart upload are not exposed
 * via this client — callers should hit {@code /v1/contextCenter/drive/files/{id}/download} and
 * {@code /v1/contextCenter/drive/files/upload} directly with their preferred HTTP client.
 */
public class ContextFileService extends EntityServiceBase<ContextFile> {
  public ContextFileService(HttpClient httpClient) {
    super(httpClient, "/v1/contextCenter/drive/files");
  }

  @Override
  protected Class<ContextFile> getEntityClass() {
    return ContextFile.class;
  }

  public ContextFile create(CreateContextFile request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, ContextFile.class);
  }

  /**
   * Move a file to a different folder. A null {@code folder} moves the file to the drive root.
   * The server emits a {@code ChangeEvent} on success.
   */
  public ContextFile move(String id, EntityReference folder) throws OpenMetadataException {
    MoveContextFileRequest request = new MoveContextFileRequest().withFolder(folder);
    return httpClient.execute(
        HttpMethod.PUT, basePath + "/" + id + "/move", request, ContextFile.class);
  }
}
