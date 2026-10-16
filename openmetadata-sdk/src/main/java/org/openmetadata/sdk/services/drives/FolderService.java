package org.openmetadata.sdk.services.drives;

import com.fasterxml.jackson.databind.JsonNode;
import org.openmetadata.schema.api.data.CreateFolder;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.EntityServiceBase;

/**
 * Service client for Context Center Folder operations.
 *
 * <p>Folders are hierarchical containers for Context Center files. This service speaks to
 * {@code /v1/contextCenter/drive/folders} on the OpenMetadata server.
 */
public class FolderService extends EntityServiceBase<Folder> {
  public FolderService(HttpClient httpClient) {
    super(httpClient, "/v1/contextCenter/drive/folders");
  }

  @Override
  protected Class<Folder> getEntityClass() {
    return Folder.class;
  }

  public Folder create(CreateFolder request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Folder.class);
  }

  /**
   * Return the children (subfolders and files) of a folder as a raw JSON tree. The shape mirrors
   * the {@code FolderContents} payload returned by {@code GET /folders/{id}/contents}.
   */
  public JsonNode getContents(String id) throws OpenMetadataException {
    return getContents(id, null);
  }

  public JsonNode getContents(String id, String fields) throws OpenMetadataException {
    RequestOptions options =
        fields != null ? RequestOptions.builder().queryParam("fields", fields).build() : null;
    String body =
        httpClient.executeForString(
            HttpMethod.GET, basePath + "/" + id + "/contents", null, options);
    try {
      return objectMapper.readTree(body);
    } catch (Exception e) {
      throw new OpenMetadataException("Failed to parse folder contents: " + e.getMessage(), e);
    }
  }
}
