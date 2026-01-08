package org.openmetadata.sdk.services.datacontracts;

import java.util.UUID;
import org.openmetadata.schema.api.data.CreateDataContract;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.EntityServiceBase;

public class DataContractService extends EntityServiceBase<DataContract> {
  public DataContractService(HttpClient httpClient) {
    super(httpClient, "/v1/dataContracts");
  }

  @Override
  protected Class<DataContract> getEntityClass() {
    return DataContract.class;
  }

  public DataContract create(CreateDataContract request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, DataContract.class);
  }

  public DataContract createOrUpdate(CreateDataContract request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.PUT, basePath, request, DataContract.class);
  }

  /**
   * Get data contract by entity ID.
   */
  public DataContract getByEntityId(UUID entityId, String entityType) throws OpenMetadataException {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("entityId", entityId.toString())
            .queryParam("entityType", entityType)
            .build();
    return httpClient.execute(
        HttpMethod.GET, basePath + "/entity", null, DataContract.class, options);
  }

  /**
   * Get data contract by entity ID with fields.
   */
  public DataContract getByEntityId(UUID entityId, String entityType, String fields)
      throws OpenMetadataException {
    RequestOptions.Builder optionsBuilder =
        RequestOptions.builder()
            .queryParam("entityId", entityId.toString())
            .queryParam("entityType", entityType);
    if (fields != null) {
      optionsBuilder.queryParam("fields", fields);
    }
    return httpClient.execute(
        HttpMethod.GET, basePath + "/entity", null, DataContract.class, optionsBuilder.build());
  }

  /**
   * Validate a data contract.
   */
  public DataContractResult validate(UUID contractId) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST, basePath + "/" + contractId + "/validate", null, DataContractResult.class);
  }

  /**
   * Get latest data contract result.
   */
  public DataContractResult getLatestResult(UUID contractId) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.GET,
        basePath + "/" + contractId + "/results/latest",
        null,
        DataContractResult.class);
  }

  /**
   * Add a result to a data contract.
   */
  public DataContractResult addResult(UUID contractId, DataContractResult result)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT, basePath + "/" + contractId + "/results", result, DataContractResult.class);
  }

  /**
   * Delete a result at a specific timestamp.
   */
  public void deleteResult(UUID contractId, Long timestamp) throws OpenMetadataException {
    httpClient.executeForString(
        HttpMethod.DELETE, basePath + "/" + contractId + "/results/" + timestamp, null);
  }

  /**
   * Delete results before a specific timestamp.
   */
  public void deleteResultsBefore(UUID contractId, Long timestamp) throws OpenMetadataException {
    httpClient.executeForString(
        HttpMethod.DELETE, basePath + "/" + contractId + "/results/before/" + timestamp, null);
  }

  /**
   * Export data contract to ODCS format by ID.
   */
  public ODCSDataContract exportToODCS(UUID contractId) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.GET, basePath + "/" + contractId + "/odcs", null, ODCSDataContract.class);
  }

  /**
   * Export data contract to ODCS format by FQN.
   */
  public ODCSDataContract exportToODCSByFqn(String fqn) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.GET, basePath + "/name/" + fqn + "/odcs", null, ODCSDataContract.class);
  }

  /**
   * Export data contract to ODCS YAML format by ID.
   */
  public String exportToODCSYaml(UUID contractId) throws OpenMetadataException {
    RequestOptions options = RequestOptions.builder().header("Accept", "application/yaml").build();
    return httpClient.executeForString(
        HttpMethod.GET, basePath + "/" + contractId + "/odcs/yaml", null, options);
  }

  /**
   * Import data contract from ODCS format.
   */
  public DataContract importFromODCS(ODCSDataContract odcs, UUID entityId, String entityType)
      throws OpenMetadataException {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("entityId", entityId.toString())
            .queryParam("entityType", entityType)
            .build();
    return httpClient.execute(
        HttpMethod.POST, basePath + "/odcs", odcs, DataContract.class, options);
  }

  /**
   * Import data contract from ODCS YAML format.
   */
  public DataContract importFromODCSYaml(String yamlContent, UUID entityId, String entityType)
      throws OpenMetadataException {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("entityId", entityId.toString())
            .queryParam("entityType", entityType)
            .header("Content-Type", "application/yaml")
            .build();
    return httpClient.execute(
        HttpMethod.POST, basePath + "/odcs/yaml", yamlContent, DataContract.class, options);
  }

  /**
   * Create or update data contract from ODCS format.
   */
  public DataContract createOrUpdateFromODCS(
      ODCSDataContract odcs, UUID entityId, String entityType) throws OpenMetadataException {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("entityId", entityId.toString())
            .queryParam("entityType", entityType)
            .build();
    return httpClient.execute(
        HttpMethod.PUT, basePath + "/odcs", odcs, DataContract.class, options);
  }

  /**
   * Create or update data contract from ODCS YAML format.
   */
  public DataContract createOrUpdateFromODCSYaml(
      String yamlContent, UUID entityId, String entityType) throws OpenMetadataException {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("entityId", entityId.toString())
            .queryParam("entityType", entityType)
            .header("Content-Type", "application/yaml")
            .build();
    return httpClient.execute(
        HttpMethod.PUT, basePath + "/odcs/yaml", yamlContent, DataContract.class, options);
  }

  /**
   * Export data contract to ODCS YAML format by FQN.
   */
  public String exportToODCSYamlByFqn(String fqn) throws OpenMetadataException {
    RequestOptions options = RequestOptions.builder().header("Accept", "application/yaml").build();
    return httpClient.executeForString(
        HttpMethod.GET, basePath + "/name/" + fqn + "/odcs/yaml", null, options);
  }
}
