package org.openmetadata.sdk.services.knowledge;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreatePage;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.EntityServiceBase;

/**
 * Service client for Context Center Page operations (articles and quick links).
 *
 * <p>Speaks to {@code /v1/contextCenter/pages} on the OpenMetadata server. Inherits standard CRUD
 * from {@link EntityServiceBase} and adds Page-specific operations: voting, followers, and
 * hierarchical browsing.
 */
public class PageService extends EntityServiceBase<Page> {
  public PageService(HttpClient httpClient) {
    super(httpClient, "/v1/contextCenter/pages");
  }

  @Override
  protected Class<Page> getEntityClass() {
    return Page.class;
  }

  public Page create(CreatePage request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Page.class);
  }

  /** Cast an up/down vote on a page. */
  public ChangeEvent vote(String id, VoteRequest request) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT, basePath + "/" + id + "/vote", request, ChangeEvent.class);
  }

  /** Add a user as a follower of this page. */
  public ChangeEvent addFollower(String id, UUID userId) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT, basePath + "/" + id + "/followers", userId, ChangeEvent.class);
  }

  /** Remove a user from the followers of this page. */
  public ChangeEvent removeFollower(String id, UUID userId) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.DELETE, basePath + "/" + id + "/followers/" + userId, null, ChangeEvent.class);
  }

  /**
   * Fetch the flat parent/child tree of pages, optionally scoped by {@code pageType}. Returns the
   * raw JSON payload because the hierarchy schema is bespoke to the resource (not a standard
   * entity).
   */
  public JsonNode getHierarchy() throws OpenMetadataException {
    return getHierarchy(null);
  }

  public JsonNode getHierarchy(String pageType) throws OpenMetadataException {
    RequestOptions options =
        pageType != null ? RequestOptions.builder().queryParam("pageType", pageType).build() : null;
    String body =
        httpClient.executeForString(HttpMethod.GET, basePath + "/hierarchy", null, options);
    return parseTree(body, "page hierarchy");
  }

  /**
   * Fetch the search-index-backed hierarchy view used by the dashboard. Supports filtering by
   * parent FQN, page type, and pagination. Returns raw JSON.
   */
  public JsonNode searchHierarchy(
      String parentFqn, String pageType, Integer offset, Integer limit, String activeFqn)
      throws OpenMetadataException {
    RequestOptions.Builder builder = RequestOptions.builder();
    if (parentFqn != null) {
      builder.queryParam("parent", parentFqn);
    }
    if (pageType != null) {
      builder.queryParam("pageType", pageType);
    }
    if (offset != null) {
      builder.queryParam("offset", offset.toString());
    }
    if (limit != null) {
      builder.queryParam("limit", limit.toString());
    }
    if (activeFqn != null) {
      builder.queryParam("activeFqn", activeFqn);
    }
    String body =
        httpClient.executeForString(
            HttpMethod.GET, basePath + "/search/hierarchy", null, builder.build());
    return parseTree(body, "search hierarchy");
  }

  private JsonNode parseTree(String body, String label) throws OpenMetadataException {
    try {
      return objectMapper.readTree(body);
    } catch (Exception e) {
      throw new OpenMetadataException("Failed to parse " + label + ": " + e.getMessage(), e);
    }
  }
}
