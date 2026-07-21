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
import jakarta.ws.rs.ServiceUnavailableException;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.SecurityContext;
import java.time.Clock;
import java.util.function.Supplier;
import org.openmetadata.schema.api.data.OntologyInferenceExplanation;
import org.openmetadata.schema.api.data.OntologyInferenceExplanationRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.inference.InferenceExplanationService;
import org.openmetadata.service.rdf.inference.InferenceRuleRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Path("/v1/ontology/reasoning")
@Tag(name = "Ontology Reasoning", description = "Scoped materialized-inference explanations.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "ontologyReasoning", order = 12)
public final class OntologyReasoningResource {
  private final Authorizer authorizer;
  private final GlossaryRepository glossaryRepository;
  private final Supplier<InferenceExplanationService> explanationServiceSupplier;

  public OntologyReasoningResource(final Authorizer authorizer) {
    this(authorizer, glossaryRepository(), OntologyReasoningResource::createService);
  }

  OntologyReasoningResource(
      final Authorizer authorizer,
      final GlossaryRepository glossaryRepository,
      final InferenceExplanationService explanationService) {
    this(authorizer, glossaryRepository, () -> explanationService);
  }

  OntologyReasoningResource(
      final Authorizer authorizer,
      final GlossaryRepository glossaryRepository,
      final Supplier<InferenceExplanationService> explanationServiceSupplier) {
    this.authorizer = authorizer;
    this.glossaryRepository = glossaryRepository;
    this.explanationServiceSupplier = explanationServiceSupplier;
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
