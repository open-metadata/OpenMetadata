package org.openmetadata.sdk.services.drives;

import org.openmetadata.schema.api.data.CreateDirectory;
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class DirectoryService extends EntityServiceBase<Directory> {
  public DirectoryService(HttpClient httpClient) {
    super(httpClient, "/v1/drives/directories");
  }

  @Override
  protected Class<Directory> getEntityClass() {
    return Directory.class;
  }

  public Directory create(CreateDirectory request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Directory.class);
  }
}
