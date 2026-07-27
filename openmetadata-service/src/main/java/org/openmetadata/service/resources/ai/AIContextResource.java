/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.resources.ai;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.ServiceUnavailableException;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import org.openmetadata.service.Entity;
import org.openmetadata.service.aicontext.AIContextFinder;
import org.openmetadata.service.aicontext.AIContextFinder.FoundContext;
import org.openmetadata.service.aicontext.AIContextFinderAccess;
import org.openmetadata.service.aicontext.AttachedKnowledgeBatch;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@Path("/v1/ai/context")
@Tag(
    name = "AI Context",
    description =
        "Question-anchored AI context discovery: semantically search the company-knowledge layer "
            + "(glossary terms, metrics, articles) and route each hit to the candidate data assets "
            + "it points to. Asset-anchored context is served per entity at /v1/{entities}/name/{fqn}/context.")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "aiContext")
public class AIContextResource {
  private final Authorizer authorizer;

  public AIContextResource(Authorizer authorizer, Limits limits) {
    this.authorizer = authorizer;
  }

  @GET
  @Path("/find")
  @Operation(
      operationId = "findAiContext",
      summary = "Find company knowledge relevant to a question, routed to candidate assets",
      description =
          "REST surface of the find_context MCP tool. Runs a semantic search over the knowledge "
              + "layer (glossary terms, metrics, articles) and returns the matching definitions "
              + "together with the candidate data assets each item routes to (glossary terms via "
              + "tag usage, metrics via APPLIED_TO, articles via HAS). Candidate assets are "
              + "filtered to those the caller can view.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Knowledge items and the candidate assets they route to",
            content = @Content(schema = @Schema(implementation = FoundContext.class))),
        @ApiResponse(responseCode = "503", description = "Vector embeddings are not enabled")
      })
  public Response find(
      @Context SecurityContext securityContext,
      @Parameter(description = "Natural-language question to find knowledge for")
          @QueryParam("q")
          @NotBlank
          String query,
      @Parameter(description = "Maximum knowledge items to return")
          @QueryParam("size")
          @DefaultValue("10")
          @Min(1)
          @Max(50)
          int size) {
    validateVectorSearchEnabled();
    AIContextFinderAccess.authorizeKnowledgeAccess(authorizer, securityContext);
    SubjectContext subjectContext = DefaultAuthorizer.getSubjectContext(securityContext);
    FoundContext found = new AIContextFinder(subjectContext).find(query, size);
    FoundContext visible =
        AIContextFinderAccess.filterCandidates(found, authorizer, securityContext);
    return Response.ok(visible).build();
  }

  @POST
  @Path("/attachedKnowledge")
  @Consumes(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "getAttachedKnowledgeBatch",
      summary = "Batch-resolve the knowledge attached to a set of assets",
      description =
          "For each asset (fqn + entityType), returns the knowledge linked to it: glossary terms "
              + "from asset and column tags, metrics applied to it, and articles about it. "
              + "Deliberately lightweight (no profile, lineage, or budgeting; item content capped) "
              + "so search layers can annotate a whole result page in one call. Assets the caller "
              + "cannot view are skipped.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Per-asset attached knowledge items",
            content =
                @Content(
                    schema = @Schema(implementation = AttachedKnowledgeBatch.AssetKnowledge.class)))
      })
  public Response attachedKnowledge(
      @Context SecurityContext securityContext,
      @Parameter(description = "Assets to resolve, as {fullyQualifiedName, entityType} pairs")
          @NotNull
          @Size(min = 1, max = AttachedKnowledgeBatch.MAX_ASSETS)
          List<AttachedKnowledgeBatch.AssetKey> assets) {
    AIContextFinderAccess.authorizeKnowledgeAccess(authorizer, securityContext);
    List<AttachedKnowledgeBatch.AssetKey> viewable =
        assets.stream()
            .filter(
                asset ->
                    AIContextFinderAccess.canView(
                        asset.entityType(),
                        asset.fullyQualifiedName(),
                        authorizer,
                        securityContext))
            .toList();
    return Response.ok(AttachedKnowledgeBatch.resolve(viewable)).build();
  }

  private void validateVectorSearchEnabled() {
    if (!Entity.getSearchRepository().isVectorEmbeddingEnabled()) {
      throw new ServiceUnavailableException(
          "Semantic search is not enabled. Configure vector embeddings in the OpenMetadata server settings.");
    }
  }
}
