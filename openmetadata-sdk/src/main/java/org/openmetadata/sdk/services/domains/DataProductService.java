package org.openmetadata.sdk.services.domains;

import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class DataProductService
    extends EntityServiceBase<org.openmetadata.schema.entity.domains.DataProduct> {

  public DataProductService(HttpClient httpClient) {
    super(httpClient, "/v1/dataProducts");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.domains.DataProduct> getEntityClass() {
    return org.openmetadata.schema.entity.domains.DataProduct.class;
  }

  public org.openmetadata.schema.entity.domains.DataProduct create(CreateDataProduct request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST,
        basePath,
        request,
        org.openmetadata.schema.entity.domains.DataProduct.class);
  }

  public org.openmetadata.schema.entity.domains.DataProduct upsert(CreateDataProduct request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT,
        basePath,
        request,
        org.openmetadata.schema.entity.domains.DataProduct.class);
  }

  public BulkOperationResult bulkAddAssets(String name, BulkAssets request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT,
        String.format("%s/%s/assets/add", basePath, name),
        request,
        BulkOperationResult.class);
  }

  public BulkOperationResult bulkRemoveAssets(String name, BulkAssets request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT,
        String.format("%s/%s/assets/remove", basePath, name),
        request,
        BulkOperationResult.class);
  }

  public BulkOperationResult bulkAddInputPorts(String name, BulkAssets request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT,
        String.format("%s/%s/inputPorts/add", basePath, name),
        request,
        BulkOperationResult.class);
  }

  public BulkOperationResult bulkRemoveInputPorts(String name, BulkAssets request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT,
        String.format("%s/%s/inputPorts/remove", basePath, name),
        request,
        BulkOperationResult.class);
  }

  public BulkOperationResult bulkAddOutputPorts(String name, BulkAssets request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT,
        String.format("%s/%s/outputPorts/add", basePath, name),
        request,
        BulkOperationResult.class);
  }

  public BulkOperationResult bulkRemoveOutputPorts(String name, BulkAssets request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT,
        String.format("%s/%s/outputPorts/remove", basePath, name),
        request,
        BulkOperationResult.class);
  }
}
