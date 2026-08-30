/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.resources.ontology;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.SecurityContext;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.api.data.DeleteOntologyResource;
import org.openmetadata.schema.api.data.OntologyDeleteResult;
import org.openmetadata.schema.api.data.OntologyImpactReport;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.ontology.OntologyImpactService;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Path("/v1/ontology/impacts")
@Tag(name = "Ontology Impacts", description = "Version-bound ontology impact analysis.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "ontologyImpacts", order = 9)
public final class OntologyImpactResource {
  private final Authorizer authorizer;
  private final GlossaryTermRepository repository;
  private final OntologyImpactService impactService;

  public OntologyImpactResource(final Authorizer authorizer) {
    this(authorizer, glossaryTermRepository());
  }

  private OntologyImpactResource(
      final Authorizer authorizer, final GlossaryTermRepository repository) {
    this(authorizer, repository, OntologyImpactService.createDefault(repository));
  }

  OntologyImpactResource(
      final Authorizer authorizer,
      final GlossaryTermRepository repository,
      final OntologyImpactService impactService) {
    this.authorizer = Objects.requireNonNull(authorizer);
    this.repository = Objects.requireNonNull(repository);
    this.impactService = Objects.requireNonNull(impactService);
  }

  @GET
  @Path("/glossaryTerms/{id}/delete")
  @Operation(
      operationId = "previewGlossaryTermDeleteImpact",
      summary = "Preview glossary-term deletion impact")
  public OntologyImpactReport previewDelete(
      @Context final SecurityContext securityContext, @PathParam("id") final UUID id) {
    authorizeTerm(securityContext, id, MetadataOperation.DELETE);
    return impactService.previewDelete(id, principal(securityContext));
  }

  @POST
  @Path("/glossaryTerms/{id}/delete")
  @Operation(
      operationId = "deleteGlossaryTermWithImpact",
      summary = "Delete a glossary term using a fresh impact token")
  public OntologyDeleteResult delete(
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @Valid final DeleteOntologyResource request) {
    authorizeTerm(securityContext, id, MetadataOperation.DELETE);
    authorizeReassignment(securityContext, request.getReassignChildrenTo());
    return impactService.delete(id, request, principal(securityContext));
  }

  private void authorizeTerm(
      final SecurityContext securityContext, final UUID id, final MetadataOperation operation) {
    final GlossaryTerm term = repository.get(null, id, repository.getFields(""));
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.GLOSSARY_TERM, operation),
        new ResourceContext<>(Entity.GLOSSARY_TERM, term, repository));
  }

  private void authorizeReassignment(
      final SecurityContext securityContext, final EntityReference target) {
    if (target != null) {
      final String type = target.getType();
      switch (type) {
        case Entity.GLOSSARY, Entity.GLOSSARY_TERM -> authorizer.authorize(
            securityContext,
            new OperationContext(type, MetadataOperation.EDIT_GLOSSARY_TERMS),
            new ResourceContext<>(type, target.getId(), null));
        default -> throw new IllegalArgumentException(
            "Child reassignment target must reference a glossary or glossary term");
      }
    }
  }

  private static String principal(final SecurityContext securityContext) {
    return securityContext.getUserPrincipal().getName();
  }

  private static GlossaryTermRepository glossaryTermRepository() {
    return (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
  }
}
