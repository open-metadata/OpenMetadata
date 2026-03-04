package org.openmetadata.sdk.services.domains;

import java.util.UUID;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.DataProductPortsView;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
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

  /**
   * Returns a fluent API for input port operations on a data product by ID.
   */
  public InputPortsAPI inputPorts(UUID dataProductId) {
    return new InputPortsAPI(httpClient, basePath, dataProductId.toString(), false);
  }

  /**
   * Returns a fluent API for input port operations on a data product by name.
   */
  public InputPortsAPI inputPorts(String dataProductName) {
    return new InputPortsAPI(httpClient, basePath, dataProductName, true);
  }

  /**
   * Returns a fluent API for output port operations on a data product by ID.
   */
  public OutputPortsAPI outputPorts(UUID dataProductId) {
    return new OutputPortsAPI(httpClient, basePath, dataProductId.toString(), false);
  }

  /**
   * Returns a fluent API for output port operations on a data product by name.
   */
  public OutputPortsAPI outputPorts(String dataProductName) {
    return new OutputPortsAPI(httpClient, basePath, dataProductName, true);
  }

  /**
   * Returns a fluent API for combined ports view operations on a data product by ID.
   */
  public PortsViewAPI portsView(UUID dataProductId) {
    return new PortsViewAPI(httpClient, basePath, dataProductId.toString(), false);
  }

  /**
   * Returns a fluent API for combined ports view operations on a data product by name.
   */
  public PortsViewAPI portsView(String dataProductName) {
    return new PortsViewAPI(httpClient, basePath, dataProductName, true);
  }

  /**
   * Fluent API for input port operations.
   */
  public static class InputPortsAPI {
    private final HttpClient httpClient;
    private final String basePath;
    private final String identifier;
    private final boolean byName;

    InputPortsAPI(HttpClient httpClient, String basePath, String identifier, boolean byName) {
      this.httpClient = httpClient;
      this.basePath = basePath;
      this.identifier = identifier;
      this.byName = byName;
    }

    public BulkOperationResult add(BulkAssets request) throws OpenMetadataException {
      String path =
          byName
              ? String.format("%s/name/%s/inputPorts/add", basePath, identifier)
              : String.format("%s/%s/inputPorts/add", basePath, identifier);
      return httpClient.execute(HttpMethod.PUT, path, request, BulkOperationResult.class);
    }

    public BulkOperationResult remove(BulkAssets request) throws OpenMetadataException {
      String path =
          byName
              ? String.format("%s/name/%s/inputPorts/remove", basePath, identifier)
              : String.format("%s/%s/inputPorts/remove", basePath, identifier);
      return httpClient.execute(HttpMethod.PUT, path, request, BulkOperationResult.class);
    }

    @SuppressWarnings("unchecked")
    public ResultList<?> list(String fields, int limit, int offset) throws OpenMetadataException {
      String path =
          byName
              ? String.format("%s/name/%s/inputPorts", basePath, identifier)
              : String.format("%s/%s/inputPorts", basePath, identifier);
      RequestOptions.Builder builder =
          RequestOptions.builder()
              .queryParam("limit", String.valueOf(limit))
              .queryParam("offset", String.valueOf(offset));
      if (fields != null && !fields.isEmpty()) {
        builder.queryParam("fields", fields);
      }
      return httpClient.execute(HttpMethod.GET, path, null, ResultList.class, builder.build());
    }

    @SuppressWarnings("unchecked")
    public ResultList<?> list(int limit, int offset) throws OpenMetadataException {
      return list(null, limit, offset);
    }

    public ResultList<?> list() throws OpenMetadataException {
      return list(null, 50, 0);
    }
  }

  /**
   * Fluent API for output port operations.
   */
  public static class OutputPortsAPI {
    private final HttpClient httpClient;
    private final String basePath;
    private final String identifier;
    private final boolean byName;

    OutputPortsAPI(HttpClient httpClient, String basePath, String identifier, boolean byName) {
      this.httpClient = httpClient;
      this.basePath = basePath;
      this.identifier = identifier;
      this.byName = byName;
    }

    public BulkOperationResult add(BulkAssets request) throws OpenMetadataException {
      String path =
          byName
              ? String.format("%s/name/%s/outputPorts/add", basePath, identifier)
              : String.format("%s/%s/outputPorts/add", basePath, identifier);
      return httpClient.execute(HttpMethod.PUT, path, request, BulkOperationResult.class);
    }

    public BulkOperationResult remove(BulkAssets request) throws OpenMetadataException {
      String path =
          byName
              ? String.format("%s/name/%s/outputPorts/remove", basePath, identifier)
              : String.format("%s/%s/outputPorts/remove", basePath, identifier);
      return httpClient.execute(HttpMethod.PUT, path, request, BulkOperationResult.class);
    }

    @SuppressWarnings("unchecked")
    public ResultList<?> list(String fields, int limit, int offset) throws OpenMetadataException {
      String path =
          byName
              ? String.format("%s/name/%s/outputPorts", basePath, identifier)
              : String.format("%s/%s/outputPorts", basePath, identifier);
      RequestOptions.Builder builder =
          RequestOptions.builder()
              .queryParam("limit", String.valueOf(limit))
              .queryParam("offset", String.valueOf(offset));
      if (fields != null && !fields.isEmpty()) {
        builder.queryParam("fields", fields);
      }
      return httpClient.execute(HttpMethod.GET, path, null, ResultList.class, builder.build());
    }

    @SuppressWarnings("unchecked")
    public ResultList<?> list(int limit, int offset) throws OpenMetadataException {
      return list(null, limit, offset);
    }

    public ResultList<?> list() throws OpenMetadataException {
      return list(null, 50, 0);
    }
  }

  /**
   * Fluent API for combined ports view operations.
   */
  public static class PortsViewAPI {
    private final HttpClient httpClient;
    private final String basePath;
    private final String identifier;
    private final boolean byName;

    PortsViewAPI(HttpClient httpClient, String basePath, String identifier, boolean byName) {
      this.httpClient = httpClient;
      this.basePath = basePath;
      this.identifier = identifier;
      this.byName = byName;
    }

    public DataProductPortsView get(
        String fields, int inputLimit, int inputOffset, int outputLimit, int outputOffset)
        throws OpenMetadataException {
      String path =
          byName
              ? String.format("%s/name/%s/portsView", basePath, identifier)
              : String.format("%s/%s/portsView", basePath, identifier);
      RequestOptions.Builder builder =
          RequestOptions.builder()
              .queryParam("inputLimit", String.valueOf(inputLimit))
              .queryParam("inputOffset", String.valueOf(inputOffset))
              .queryParam("outputLimit", String.valueOf(outputLimit))
              .queryParam("outputOffset", String.valueOf(outputOffset));
      if (fields != null && !fields.isEmpty()) {
        builder.queryParam("fields", fields);
      }
      return httpClient.execute(
          HttpMethod.GET, path, null, DataProductPortsView.class, builder.build());
    }

    public DataProductPortsView get(
        int inputLimit, int inputOffset, int outputLimit, int outputOffset)
        throws OpenMetadataException {
      return get(null, inputLimit, inputOffset, outputLimit, outputOffset);
    }

    public DataProductPortsView get() throws OpenMetadataException {
      return get(null, 50, 0, 50, 0);
    }
  }

  // Legacy methods for backward compatibility

  @Deprecated
  public BulkOperationResult bulkAddInputPorts(String name, BulkAssets request)
      throws OpenMetadataException {
    return inputPorts(name).add(request);
  }

  @Deprecated
  public BulkOperationResult bulkRemoveInputPorts(String name, BulkAssets request)
      throws OpenMetadataException {
    return inputPorts(name).remove(request);
  }

  @Deprecated
  public BulkOperationResult bulkAddOutputPorts(String name, BulkAssets request)
      throws OpenMetadataException {
    return outputPorts(name).add(request);
  }

  @Deprecated
  public BulkOperationResult bulkRemoveOutputPorts(String name, BulkAssets request)
      throws OpenMetadataException {
    return outputPorts(name).remove(request);
  }
}
