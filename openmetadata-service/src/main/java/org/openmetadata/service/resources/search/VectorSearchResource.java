package org.openmetadata.service.resources.search;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.search.SearchUtils;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.utils.DTOs.FingerprintResponse;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchRequest;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.ViewPermissionFilter;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@Slf4j
@Path("/v1/search/vector")
@Tag(name = "Vector Search", description = "APIs for vector-based semantic search.")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "vectorSearch")
public class VectorSearchResource {
  private final Authorizer authorizer;

  private static final int MAX_SIZE = 100;
  private static final int MAX_K = 10_000;

  public VectorSearchResource(Authorizer authorizer) {
    this.authorizer = authorizer;
  }

  @POST
  @Path("/query")
  @Consumes(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "vectorSearch",
      summary = "Vector semantic search",
      description = "Search entities using vector embeddings with full filter support.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Vector search results",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = VectorSearchResponse.class)))
      })
  public Response vectorSearchPost(
      @Context SecurityContext securityContext, VectorSearchRequest request) {
    SubjectContext subjectContext = DefaultAuthorizer.getSubjectContext(securityContext);

    if (request.query == null || request.query.isBlank()) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity("{\"error\":\"query is required\"}")
          .build();
    }

    if (!Entity.getSearchRepository().isVectorEmbeddingEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("{\"error\":\"Vector search is not enabled\"}")
          .build();
    }

    VectorIndexService vectorService = Entity.getSearchRepository().getVectorIndexService();
    if (vectorService == null) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("{\"error\":\"Vector search service is not initialized\"}")
          .build();
    }

    try {
      int effectiveSize = Math.min(Math.max(request.size, 1), MAX_SIZE);
      int effectiveFrom = Math.max(request.from != null ? request.from : 0, 0);
      int effectiveK = Math.min(Math.max(request.k, 1), MAX_K);
      VectorSearchResponse response =
          vectorService.search(
              request.query,
              request.filters != null ? request.filters : Collections.emptyMap(),
              effectiveSize,
              effectiveFrom,
              effectiveK,
              request.threshold,
              SearchUtils.searchPreferenceFor(subjectContext),
              subjectContext);
      if (!subjectContext.isAdmin()) {
        response.hits = viewableHits(securityContext, response.hits);
      }
      return Response.ok(response).build();
    } catch (Exception e) {
      LOG.error("Vector search failed: {}", e.getMessage(), e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("{\"error\":\"An internal error occurred\"}")
          .build();
    }
  }

  @GET
  @Path("/fingerprint")
  @Operation(
      operationId = "getFingerprint",
      summary = "Get vector fingerprint",
      description = "Returns the existing fingerprint for a given entity.")
  public Response getFingerprint(
      @Context SecurityContext securityContext,
      @Parameter(description = "Parent entity ID", required = true) @QueryParam("parentId")
          String parentId) {
    authorizer.authorizeAdmin(securityContext);

    if (!Entity.getSearchRepository().isVectorEmbeddingEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("{\"error\":\"Vector search is not enabled\"}")
          .build();
    }

    VectorIndexService vectorService = Entity.getSearchRepository().getVectorIndexService();
    if (vectorService == null) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("{\"error\":\"Vector search service is not initialized\"}")
          .build();
    }

    if (parentId == null || parentId.isBlank()) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity("{\"error\":\"parentId is required\"}")
          .build();
    }
    try {
      UUID.fromString(parentId);
    } catch (IllegalArgumentException e) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity("{\"error\":\"Invalid parentId format\"}")
          .build();
    }

    try {
      String indexName = vectorService.getIndexAlias();
      String fingerprint = vectorService.getExistingFingerprint(indexName, parentId);
      FingerprintResponse response =
          new FingerprintResponse(
              parentId, indexName, fingerprint, fingerprint != null ? "Found" : "Not found");
      return Response.ok(response).build();
    } catch (Exception e) {
      LOG.error("Failed to get fingerprint for {}: {}", parentId, e.getMessage(), e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("{\"error\":\"An internal error occurred\"}")
          .build();
    }
  }

  /**
   * The hits whose entity the caller may view: a hit carries the indexed text of its entity, so it
   * is decided as a read of that entity, in one batch per entity type, the way the MCP semantic
   * search decides them (ADR:2026-11-03-search-applies-the-same-access-rules-as-entity-reads).
   */
  private List<Map<String, Object>> viewableHits(
      SecurityContext securityContext, List<Map<String, Object>> hits) {
    if (hits == null || hits.isEmpty()) {
      return hits;
    }
    List<EntityReference> entities = new ArrayList<>();
    for (Map<String, Object> hit : hits) {
      EntityReference entity = entityOf(hit);
      if (entity != null) {
        entities.add(entity);
      }
    }
    Set<UUID> viewable =
        new ViewPermissionFilter(authorizer).viewableIds(securityContext, entities);
    return hits.stream()
        .filter(
            hit -> {
              EntityReference entity = entityOf(hit);
              return entity != null && viewable.contains(entity.getId());
            })
        .toList();
  }

  private static EntityReference entityOf(Map<String, Object> hit) {
    Object type = hit.get("entityType");
    Object parentId = hit.get("parentId");
    if (type == null || parentId == null) {
      return null;
    }
    try {
      return new EntityReference()
          .withType(type.toString())
          .withId(UUID.fromString(parentId.toString()));
    } catch (IllegalArgumentException e) {
      return null;
    }
  }
}
