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
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.SecurityContext;
import java.time.Clock;
import java.util.Objects;
import org.openmetadata.schema.api.data.OntologyDomainDraftRequest;
import org.openmetadata.schema.api.data.OntologyDomainDraftResult;
import org.openmetadata.schema.api.data.OntologyMappingSuggestionList;
import org.openmetadata.schema.api.data.OntologyMappingSuggestionRequest;
import org.openmetadata.schema.api.data.OntologyNaturalLanguageQueryRequest;
import org.openmetadata.schema.api.data.OntologyNaturalLanguageQueryResult;
import org.openmetadata.schema.api.data.OntologyRelationshipSuggestionList;
import org.openmetadata.schema.api.data.OntologyRelationshipSuggestionRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.RelationshipTypeRepository;
import org.openmetadata.service.llm.LLMClientHolder;
import org.openmetadata.service.ontology.LlmOntologyAiCompletionGateway;
import org.openmetadata.service.ontology.OntologyAiService;
import org.openmetadata.service.ontology.OpenMetadataOntologyAiCatalog;
import org.openmetadata.service.rdf.OntologySparqlQueryValidator;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Path("/v1/ontology/ai")
@Tag(name = "Ontology AI", description = "Optional, review-gated AI proposals for Ontology Studio.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "ontologyAi", order = 7)
public final class OntologyAiResource {
  private final Authorizer authorizer;
  private volatile OntologyAiService service;
  private volatile GlossaryRepository glossaryRepository;

  public OntologyAiResource(final Authorizer authorizer) {
    this.authorizer = Objects.requireNonNull(authorizer);
  }

  OntologyAiResource(
      final Authorizer authorizer,
      final OntologyAiService service,
      final GlossaryRepository glossaryRepository) {
    this.authorizer = Objects.requireNonNull(authorizer);
    this.service = Objects.requireNonNull(service);
    this.glossaryRepository = Objects.requireNonNull(glossaryRepository);
  }

  public void initialize(final OpenMetadataApplicationConfig config) {
    final GlossaryRepository glossaries =
        (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY);
    final GlossaryTermRepository terms =
        (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
    final RelationshipTypeRepository relationshipTypes =
        (RelationshipTypeRepository) Entity.getEntityRepository(Entity.RELATIONSHIP_TYPE);
    final boolean enabled = isEnabled(config);
    glossaryRepository = glossaries;
    service =
        new OntologyAiService(
            enabled,
            new LlmOntologyAiCompletionGateway(LLMClientHolder.get()),
            new OpenMetadataOntologyAiCatalog(glossaries, terms, relationshipTypes),
            new OntologySparqlQueryValidator(new SparqlFederationGuard(null)),
            Clock.systemUTC());
  }

  @POST
  @Path("/relationships/suggestions")
  @Operation(
      operationId = "suggestOntologyRelationships",
      summary = "Propose reviewable ontology relationships")
  public OntologyRelationshipSuggestionList suggestRelationships(
      @Context final SecurityContext securityContext,
      @Valid final OntologyRelationshipSuggestionRequest request) {
    final OntologyAiService ontologyAiService = service();
    ontologyAiService.requireAvailable();
    authorizeGlossary(securityContext, request.getGlossary(), MetadataOperation.VIEW_BASIC);
    return ontologyAiService.suggestRelationships(request);
  }

  @POST
  @Path("/mappings/suggestions")
  @Operation(
      operationId = "suggestOntologyMappings",
      summary = "Propose reviewable external concept mappings")
  public OntologyMappingSuggestionList suggestMappings(
      @Context final SecurityContext securityContext,
      @Valid final OntologyMappingSuggestionRequest request) {
    final OntologyAiService ontologyAiService = service();
    ontologyAiService.requireAvailable();
    authorizeGlossary(securityContext, request.getGlossary(), MetadataOperation.VIEW_BASIC);
    return ontologyAiService.suggestMappings(request);
  }

  @POST
  @Path("/sparql")
  @Operation(
      operationId = "generateOntologySparql",
      summary = "Generate a visible read-only SPARQL query")
  public OntologyNaturalLanguageQueryResult generateSparql(
      @Context final SecurityContext securityContext,
      @Valid final OntologyNaturalLanguageQueryRequest request) {
    final OntologyAiService ontologyAiService = service();
    ontologyAiService.requireAvailable();
    request
        .getGlossaries()
        .forEach(
            glossary -> authorizeGlossary(securityContext, glossary, MetadataOperation.VIEW_BASIC));
    return ontologyAiService.generateSparql(request);
  }

  @POST
  @Path("/drafts")
  @Operation(
      operationId = "generateOntologyDomainDraft",
      summary = "Generate a reviewable ontology change-set Draft")
  public OntologyDomainDraftResult generateDomainDraft(
      @Context final SecurityContext securityContext,
      @Valid final OntologyDomainDraftRequest request) {
    final OntologyAiService ontologyAiService = service();
    ontologyAiService.requireAvailable();
    authorizeGlossary(
        securityContext, request.getGlossary(), MetadataOperation.EDIT_GLOSSARY_TERMS);
    return ontologyAiService.generateDomainDraft(request);
  }

  private void authorizeGlossary(
      final SecurityContext securityContext,
      final String fullyQualifiedName,
      final MetadataOperation operation) {
    final GlossaryRepository repository = glossaryRepository();
    final Glossary glossary =
        repository.getByName(null, fullyQualifiedName, repository.getFields(""));
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.GLOSSARY, operation),
        new ResourceContext<>(Entity.GLOSSARY, glossary, repository));
  }

  private OntologyAiService service() {
    return Objects.requireNonNull(service, "Ontology AI resource is not initialized");
  }

  private GlossaryRepository glossaryRepository() {
    return Objects.requireNonNull(glossaryRepository, "Ontology AI resource is not initialized");
  }

  private static boolean isEnabled(final OpenMetadataApplicationConfig config) {
    return config.getRdfConfiguration() != null
        && Boolean.TRUE.equals(config.getRdfConfiguration().getAskCollateEnabled())
        && LLMClientHolder.isEnabled();
  }
}
