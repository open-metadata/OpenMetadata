package org.openmetadata.sdk.services.drives;

import org.openmetadata.schema.api.data.CreateFolder;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class FolderService extends EntityServiceBase<Folder> {
  public FolderService(HttpClient httpClient) {
    super(httpClient, "/v1/drive/folders");
  }

  @Override
  protected Class<Folder> getEntityClass() {
    return Folder.class;
  }

  public Folder create(CreateFolder request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Folder.class);
  }
}
