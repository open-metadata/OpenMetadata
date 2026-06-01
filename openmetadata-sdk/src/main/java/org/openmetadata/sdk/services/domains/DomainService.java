package org.openmetadata.sdk.services.domains;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.AllModels;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.EntityServiceBase;

public class DomainService
    extends EntityServiceBase<org.openmetadata.schema.entity.domains.Domain> {

  public DomainService(HttpClient httpClient) {
    super(httpClient, "/v1/domains");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.domains.Domain> getEntityClass() {
    return org.openmetadata.schema.entity.domains.Domain.class;
  }

  // Create using CreateDomain request
  public org.openmetadata.schema.entity.domains.Domain create(CreateDomain request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST, basePath, request, org.openmetadata.schema.entity.domains.Domain.class);
  }

  public ListResponse<Task> listTasks(String domainFqn) throws OpenMetadataException {
    return listTasks(domainFqn, null, 10);
  }

  public ListResponse<Task> listTasks(String domainFqn, TaskEntityStatus status, int limit)
      throws OpenMetadataException {
    String path = basePath + "/" + domainFqn + "/tasks";
    RequestOptions.Builder optionsBuilder =
        RequestOptions.builder().queryParam("limit", String.valueOf(limit));
    if (status != null) {
      optionsBuilder.queryParam("status", status.value());
    }
    String responseStr =
        httpClient.executeForString(HttpMethod.GET, path, null, optionsBuilder.build());
    return deserializeTaskListResponse(responseStr);
  }

  private ListResponse<Task> deserializeTaskListResponse(String json) throws OpenMetadataException {
    try {
      JsonNode rootNode = objectMapper.readTree(json);
      ListResponse<Task> response = new ListResponse<>();

      if (rootNode.has("data") && rootNode.get("data").isArray()) {
        List<Task> items = new ArrayList<>();
        for (JsonNode node : rootNode.get("data")) {
          items.add(objectMapper.treeToValue(node, Task.class));
        }
        response.setData(items);
      }

      if (rootNode.has("paging")) {
        response.setPaging(
            objectMapper.treeToValue(rootNode.get("paging"), AllModels.Paging.class));
      }

      return response;
    } catch (Exception e) {
      throw new OpenMetadataException(
          "Failed to deserialize domain tasks list response: " + e.getMessage(), e);
    }
  }
}
