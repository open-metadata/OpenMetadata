package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;
import feign.Response;

import org.openmetadata.catalog.type.EntityLineage;
import org.openmetadata.catalog.api.lineage.AddLineage;

import java.util.HashMap;
import java.util.Map;
import feign.*;

public interface LineageApi extends ApiClient.Api {

  /**
   * Add a lineage edge
   * Add a lineage edge with from entity as upstream node and to entity as downstream node.
   * @param body  (optional)
   */
  @RequestLine("PUT /lineage")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response addLineage(AddLineage body);
  /**
   * Delete a lineage edge
   * Delete a lineage edge with from entity as upstream node and to entity as downstream node.
   * @param fromEntity Entity type of upstream entity of the edge (required)
   * @param fromId Entity id (required)
   * @param toEntity Entity type for downstream entity of the edge (required)
   * @param toId Entity id (required)
   */
  @RequestLine("DELETE /lineage/{fromEntity}/{fromId}/{toEntity}/{toId}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response deleteLineage(@Param("fromEntity") String fromEntity, @Param("fromId") String fromId, @Param("toEntity") String toEntity, @Param("toId") String toId);
  /**
   * Get lineage
   * Get lineage details for an entity identified by &#x60;id&#x60;.
   * @param entity Entity type for which lineage is requested (required)
   * @param id Entity id (required)
   * @param upstreamDepth Upstream depth of lineage (default&#x3D;1, min&#x3D;0, max&#x3D;3) (optional)
   * @param downstreamDepth Upstream depth of lineage (default&#x3D;1, min&#x3D;0, max&#x3D;3) (optional)
   * @return EntityLineage
   */
  @RequestLine("GET /lineage/{entity}/{id}?upstreamDepth={upstreamDepth}&downstreamDepth={downstreamDepth}")
  @Headers({
      "Accept: application/json",
  })
  EntityLineage getLineageByID(@Param("entity") String entity, @Param("id") String id, @Param("upstreamDepth") Integer upstreamDepth, @Param("downstreamDepth") Integer downstreamDepth);

  /**
   * Get lineage
   * Get lineage details for an entity identified by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get11</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link Get11QueryParams} class that allows for
   * building up this map in a fluent style.
   * @param entity Entity type for which lineage is requested (required)
   * @param id Entity id (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>upstreamDepth - Upstream depth of lineage (default&#x3D;1, min&#x3D;0, max&#x3D;3) (optional)</li>
   *   <li>downstreamDepth - Upstream depth of lineage (default&#x3D;1, min&#x3D;0, max&#x3D;3) (optional)</li>
   *   </ul>
   * @return EntityLineage

   */
  @RequestLine("GET /lineage/{entity}/{id}?upstreamDepth={upstreamDepth}&downstreamDepth={downstreamDepth}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  EntityLineage getLineageByID(@Param("entity") String entity, @Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get11</code> method in a fluent style.
   */
  class Get11QueryParams extends HashMap<String, Object> {
    public Get11QueryParams upstreamDepth(final Integer value) {
      put("upstreamDepth", EncodingUtils.encode(value));
      return this;
    }
    public Get11QueryParams downstreamDepth(final Integer value) {
      put("downstreamDepth", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get lineage by name
   * Get lineage details for an entity identified by fully qualified name.
   * @param entity Entity type for which lineage is requested (required)
   * @param fqn Fully qualified name of the entity that uniquely identifies an entity (required)
   * @param upstreamDepth Upstream depth of lineage (default&#x3D;1, min&#x3D;0, max&#x3D;3) (optional)
   * @param downstreamDepth Upstream depth of lineage (default&#x3D;1, min&#x3D;0, max&#x3D;3) (optional)
   * @return EntityLineage
   */
  @RequestLine("GET /lineage/{entity}/name/{fqn}?upstreamDepth={upstreamDepth}&downstreamDepth={downstreamDepth}")
  @Headers({
      "Accept: application/json",
  })
  EntityLineage getLineageByFQN(@Param("entity") String entity, @Param("fqn") String fqn, @Param("upstreamDepth") Integer upstreamDepth, @Param("downstreamDepth") Integer downstreamDepth);

  /**
   * Get lineage by name
   * Get lineage details for an entity identified by fully qualified name.
   * Note, this is equivalent to the other <code>getByName8</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetByNameQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param entity Entity type for which lineage is requested (required)
   * @param fqn Fully qualified name of the entity that uniquely identifies an entity (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>upstreamDepth - Upstream depth of lineage (default&#x3D;1, min&#x3D;0, max&#x3D;3) (optional)</li>
   *   <li>downstreamDepth - Upstream depth of lineage (default&#x3D;1, min&#x3D;0, max&#x3D;3) (optional)</li>
   *   </ul>
   * @return EntityLineage

   */
  @RequestLine("GET /lineage/{entity}/name/{fqn}?upstreamDepth={upstreamDepth}&downstreamDepth={downstreamDepth}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  EntityLineage getLineageByFQN(@Param("entity") String entity, @Param("fqn") String fqn, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName8</code> method in a fluent style.
   */
  class GetByNameQueryParams extends HashMap<String, Object> {
    public GetByNameQueryParams upstreamDepth(final Integer value) {
      put("upstreamDepth", EncodingUtils.encode(value));
      return this;
    }
    public GetByNameQueryParams downstreamDepth(final Integer value) {
      put("downstreamDepth", EncodingUtils.encode(value));
      return this;
    }
  }
}
