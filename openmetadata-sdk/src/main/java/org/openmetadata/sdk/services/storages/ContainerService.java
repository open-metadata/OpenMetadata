package org.openmetadata.sdk.services.storages;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.Collections;
import java.util.List;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.EntityServiceBase;

public class ContainerService extends EntityServiceBase<Container> {
  public ContainerService(HttpClient httpClient) {
    super(httpClient, "/v1/containers");
  }

  @Override
  protected Class<Container> getEntityClass() {
    return Container.class;
  }

  // Create container using CreateContainer request
  public Container create(CreateContainer request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Container.class);
  }

  /**
   * Page through the immediate children of a Container via the dedicated
   * {@code /v1/containers/name/{fqn}/children} endpoint. Use this instead of fetching the
   * parent with {@code fields=children} — that field is no longer served because the inline
   * payload is unbounded for buckets with many objects.
   *
   * <p>Each row is a slim {@link Container} projection (id, name, displayName, fqn,
   * description, service); {@code dataModel}, {@code tags}, {@code owners}, {@code extension}
   * are not populated. Re-fetch the specific child via {@link #getByName(String)} when full
   * details are needed.
   */
  public ListResponse<Container> listChildren(String fqn, ListParams params)
      throws OpenMetadataException {
    String path = buildPathWithEncodedName(fqn) + "/children";
    RequestOptions options =
        RequestOptions.builder()
            .queryParams(params != null ? params.toQueryParams() : Collections.emptyMap())
            .build();
    String responseStr = httpClient.executeForString(HttpMethod.GET, path, null, options);
    return deserializeListResponse(responseStr);
  }

  public ListResponse<Container> listChildren(String fqn) throws OpenMetadataException {
    return listChildren(fqn, new ListParams());
  }

  /**
   * Resolve the full ancestor chain for a container in a single call. Returns
   * {@link EntityReference}s ordered from the root container (immediate child of the storage
   * service) down to the immediate parent of {@code fqn}. Empty when the container is at the
   * top level.
   */
  public List<EntityReference> listAncestors(String fqn) throws OpenMetadataException {
    String path = buildPathWithEncodedName(fqn) + "/ancestors";
    String responseStr = httpClient.executeForString(HttpMethod.GET, path, null, null);
    try {
      return objectMapper.readValue(responseStr, new TypeReference<List<EntityReference>>() {});
    } catch (Exception e) {
      throw new OpenMetadataException(
          "Failed to deserialize ancestors response: " + e.getMessage(), e);
    }
  }
}
