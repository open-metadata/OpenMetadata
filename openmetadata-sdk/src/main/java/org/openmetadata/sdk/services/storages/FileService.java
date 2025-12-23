package org.openmetadata.sdk.services.storages;

import org.openmetadata.schema.api.data.CreateFile;
import org.openmetadata.schema.entity.data.File;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class FileService extends EntityServiceBase<File> {
  public FileService(HttpClient httpClient) {
    super(httpClient, "/v1/files");
  }

  @Override
  protected Class<File> getEntityClass() {
    return File.class;
  }

  public File create(CreateFile request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, File.class);
  }
}
