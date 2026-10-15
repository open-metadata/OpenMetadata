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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotAuthorizedException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.ServiceUnavailableException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.time.Clock;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.openmetadata.schema.api.data.OntologyInferenceExplanation;
import org.openmetadata.schema.api.data.OntologyInferenceExplanationRequest;
import org.openmetadata.schema.api.rdf.RdfOntologyClosure;
import org.openmetadata.schema.api.rdf.RdfOntologyReasoningStatus;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.ontology.OntologyChangeSetEntities;
import org.openmetadata.service.rdf.OntologyClosureSources;
import org.openmetadata.service.rdf.OntologyClosures;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.inference.InferenceExplanationService;
import org.openmetadata.service.rdf.inference.InferenceRuleRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Path("/v1/ontology/reasoning")
@Tag(
    name = "Ontology Reasoning",
    description =
        "Ontology closures for reasoning, their activation and candidate checks, and scoped"
            + " materialized-inference explanations.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "ontologyReasoning", order = 12)
public final class OntologyReasoningResource {
  private final Authorizer authorizer;
  private final GlossaryRepository glossaryRepository;
  private final Supplier<InferenceExplanationService> explanationServiceSupplier;
  private final Supplier<OntologyClosures> closuresSupplier;

  public OntologyReasoningResource(final Authorizer authorizer) {
    this(
        authorizer,
        glossaryRepository(),
        OntologyReasoningResource::createService,
        OntologyReasoningResource::createClosures);
  }

  OntologyReasoningResource(
      final Authorizer authorizer,
      final GlossaryRepository glossaryRepository,
      final InferenceExplanationService explanationService) {
    this(
        authorizer,
        glossaryRepository,
        () -> explanationService,
        OntologyReasoningResource::createClosures);
  }

  OntologyReasoningResource(
      final Authorizer authorizer,
      final GlossaryRepository glossaryRepository,
      final Supplier<InferenceExplanationService> explanationServiceSupplier) {
    this(
        authorizer,
        glossaryRepository,
        explanationServiceSupplier,
        OntologyReasoningResource::createClosures);
  }

  OntologyReasoningResource(
      final Authorizer authorizer,
      final GlossaryRepository glossaryRepository,
      final Supplier<InferenceExplanationService> explanationServiceSupplier,
      final Supplier<OntologyClosures> closuresSupplier) {
    this.authorizer = authorizer;
    this.glossaryRepository = glossaryRepository;
    this.explanationServiceSupplier = explanationServiceSupplier;
    this.closuresSupplier = closuresSupplier;
  }

  @GET
  @Path("/status")
  @Operation(
      operationId = "getOntologyReasoningStatus",
      summary = "Count the ontology graphs production reasoning includes and excludes",
      description =
          "Production reasoning uses Approved axioms and Approved terms only. Reports how many"
              + " axiom and term graphs are included, how many are excluded by reason, and how"
              + " many glossaries have an active closure.")
  public RdfOntologyReasoningStatus status(@Context final SecurityContext securityContext) {
    requireAuthenticated(securityContext);
    return closures().status();
  }

  @GET
  @Path("/closures/{glossaryId}")
  @Operation(
      operationId = "getOntologyClosure",
      summary = "Describe a glossary's Approved ontology closure",
      description =
          "Computes the closure digest, version IRI, members and imports of the glossary's"
              + " Approved closure as the store holds it now, without writing anything.")
  public RdfOntologyClosure closure(
      @Context final SecurityContext securityContext,
      @PathParam("glossaryId") final UUID glossaryId) {
    authorize(securityContext, glossaryId, MetadataOperation.VIEW_BASIC);
    return closures().approved(glossaryId).orElseThrow(() -> notFound(glossaryId));
  }

  @POST
  @Path("/closures/{glossaryId}/activation")
  @Operation(
      operationId = "activateOntologyClosure",
      summary = "Activate a glossary's Approved ontology closure",
      description =
          "Publishes the version manifests of the glossary and the glossaries it imports and makes"
              + " them active. Answers 409 with the closure's problems when an import is missing,"
              + " the imports form a cycle, or the store has not caught up with Approved axioms"
              + " and terms.")
  public Response activate(
      @Context final SecurityContext securityContext,
      @PathParam("glossaryId") final UUID glossaryId) {
    authorize(securityContext, glossaryId, MetadataOperation.EDIT_ALL);
    try {
      return Response.ok(closures().activate(glossaryId).orElseThrow(() -> notFound(glossaryId)))
          .build();
    } catch (OntologyClosures.ActivationRefusedException refused) {
      return Response.status(Response.Status.CONFLICT).entity(refused.closure()).build();
    } catch (OntologyClosures.ClosureChangedException changed) {
      throw new WebApplicationException(changed.getMessage(), Response.Status.CONFLICT);
    }
  }

  @POST
  @Path("/closures/{glossaryId}/candidates")
  @Operation(
      operationId = "publishOntologyCandidateClosure",
      summary = "Publish a candidate closure for Draft and In Review changes",
      description =
          "Adds the Draft and In Review graphs of the given axioms and terms, and of those a change"
              + " set touches, to the glossary's Approved closure, publishes the result as a"
              + " candidate manifest, and returns it with the CHECK request for the store."
              + " Production reasoning and the active closure are not changed.")
  public RdfOntologyClosure candidate(
      @Context final SecurityContext securityContext,
      @PathParam("glossaryId") final UUID glossaryId,
      @Parameter(description = "An ontology change set whose axioms and terms to include")
          @QueryParam("changeSetId")
          final UUID changeSetId,
      @Parameter(description = "An ontology axiom or glossary term to include; repeatable")
          @QueryParam("entityId")
          final List<UUID> entityIds) {
    authorize(securityContext, glossaryId, MetadataOperation.EDIT_ALL);
    final Set<UUID> candidates = new LinkedHashSet<>(listOrEmpty(entityIds));
    if (changeSetId != null) {
      candidates.addAll(OntologyChangeSetEntities.of(changeSet(changeSetId)));
    }
    if (candidates.isEmpty()) {
      throw new BadRequestException("Name a change set or at least one entity to check");
    }
    try {
      return closures().candidate(glossaryId, candidates).orElseThrow(() -> notFound(glossaryId));
    } catch (IllegalArgumentException tooMany) {
      throw new BadRequestException(tooMany.getMessage());
    } catch (OntologyClosures.ClosureChangedException changed) {
      throw new WebApplicationException(changed.getMessage(), Response.Status.CONFLICT);
    }
  }

  private void authorize(
      final SecurityContext securityContext,
      final UUID glossaryId,
      final MetadataOperation operation) {
    final Glossary glossary =
        glossaryRepository.get(null, glossaryId, glossaryRepository.getFields("owners"));
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.GLOSSARY, operation),
        new ResourceContext<>(Entity.GLOSSARY, glossary, glossaryRepository));
  }

  private static void requireAuthenticated(final SecurityContext securityContext) {
    if (securityContext == null
        || securityContext.getUserPrincipal() == null
        || nullOrEmpty(securityContext.getUserPrincipal().getName())) {
      throw new NotAuthorizedException("Authentication is required");
    }
  }

  private static NotFoundException notFound(final UUID glossaryId) {
    return new NotFoundException("Glossary " + glossaryId + " not found");
  }

  private static OntologyChangeSet changeSet(final UUID changeSetId) {
    return Entity.getEntity(
        Entity.ONTOLOGY_CHANGE_SET, changeSetId, "operations,applicationResult", Include.ALL);
  }

  private OntologyClosures closures() {
    return closuresSupplier.get();
  }

  private static OntologyClosures createClosures() {
    final RdfRepository rdfRepository = RdfRepository.getInstanceOrNull();
    if (rdfRepository == null || !rdfRepository.isEnabled()) {
      throw new ServiceUnavailableException("Ontology closures require an enabled RDF store");
    }
    return OntologyClosureSources.forRepository(rdfRepository);
  }

  @POST
  @Path("/explanations")
  @Operation(
      operationId = "explainOntologyInference",
      summary = "Explain a scoped asserted or materialized RDF statement")
  public OntologyInferenceExplanation explain(
      @Context final SecurityContext securityContext,
      @Valid final OntologyInferenceExplanationRequest request) {
    final Glossary glossary = glossary(request);
    authorizeView(securityContext, glossary);
    return explanationServiceSupplier.get().explain(glossary, request);
  }

  private Glossary glossary(final OntologyInferenceExplanationRequest request) {
    return glossaryRepository.get(
        null, request.getGlossaryId(), glossaryRepository.getFields("owners"));
  }

  private void authorizeView(final SecurityContext securityContext, final Glossary glossary) {
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.GLOSSARY, MetadataOperation.VIEW_BASIC),
        new ResourceContext<>(Entity.GLOSSARY, glossary, glossaryRepository));
  }

  private static InferenceExplanationService createService() {
    final RdfRepository rdfRepository = RdfRepository.getInstanceOrNull();
    if (rdfRepository == null || !rdfRepository.isEnabled()) {
      throw new ServiceUnavailableException("RDF inference explanations require an enabled store");
    }
    final InferenceRuleRepository ruleRepository =
        new InferenceRuleRepository(
            Entity.getCollectionDAO().rdfInferenceRuleDAO(),
            Clock.systemUTC(),
            rdfRepository.getBaseUri());
    return new InferenceExplanationService(
        new RepositoryQueryExecutor(rdfRepository),
        ruleRepository::list,
        rdfRepository.getBaseUri());
  }

  private static GlossaryRepository glossaryRepository() {
    return (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY);
  }

  private record RepositoryQueryExecutor(RdfRepository repository)
      implements InferenceExplanationService.QueryExecutor {
    @Override
    public String execute(final String query, final String format) {
      return repository.executeSparqlQueryDirect(query, format);
    }

    @Override
    public boolean isAvailable() {
      return repository.isEnabled();
    }
  }
}
