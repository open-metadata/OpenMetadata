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
import jakarta.ws.rs.NotAuthorizedException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.security.Principal;
import java.time.Clock;
import java.util.Optional;
import org.openmetadata.schema.api.data.InstantiateOntologyPattern;
import org.openmetadata.schema.api.data.OntologyPatternInstantiationResult;
import org.openmetadata.schema.api.data.OntologyPatternList;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.OntologyChangeSetRepository;
import org.openmetadata.service.ontology.OntologyPatternCatalog;
import org.openmetadata.service.ontology.OntologyPatternInstantiationService;
import org.openmetadata.service.ontology.RelationshipTypeResolver;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Path("/v1/ontology/patterns")
@Tag(name = "Ontology Patterns", description = "Governed Ontology Studio modeling patterns.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "ontologyPatterns", order = 9)
public final class OntologyPatternResource {
  private final Authorizer authorizer;
  private final OntologyPatternCatalog catalog;
  private final OntologyPatternInstantiationService service;
  private final GlossaryRepository glossaryRepository;

  public OntologyPatternResource(final Authorizer authorizer) {
    this(authorizer, new OntologyPatternCatalog(), glossaryRepository(), createService());
  }

  OntologyPatternResource(
      final Authorizer authorizer,
      final OntologyPatternCatalog catalog,
      final GlossaryRepository glossaryRepository,
      final OntologyPatternInstantiationService service) {
    this.authorizer = authorizer;
    this.catalog = catalog;
    this.glossaryRepository = glossaryRepository;
    this.service = service;
  }

  @GET
  @Operation(operationId = "listOntologyPatterns", summary = "List ontology modeling patterns")
  public OntologyPatternList list(@Context final SecurityContext securityContext) {
    requireUser(securityContext);
    return catalog.list();
  }

  @POST
  @Path("/instantiate")
  @Operation(
      operationId = "instantiateOntologyPattern",
      summary = "Create a Draft change set from a modeling pattern")
  public OntologyPatternInstantiationResult instantiate(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @Valid final InstantiateOntologyPattern request) {
    final Glossary glossary =
        glossaryRepository.get(null, request.getGlossaryId(), glossaryRepository.getFields(""));
    authorizeEdit(securityContext, glossary);
    return service.instantiate(uriInfo, glossary, request, requireUser(securityContext));
  }

  private void authorizeEdit(final SecurityContext securityContext, final Glossary glossary) {
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.GLOSSARY, MetadataOperation.EDIT_GLOSSARY_TERMS),
        new ResourceContext<>(Entity.GLOSSARY, glossary, glossaryRepository));
  }

  private static String requireUser(final SecurityContext securityContext) {
    return Optional.ofNullable(securityContext)
        .map(SecurityContext::getUserPrincipal)
        .map(Principal::getName)
        .filter(name -> !name.isBlank())
        .orElseThrow(() -> new NotAuthorizedException("Authentication is required"));
  }

  private static OntologyPatternInstantiationService createService() {
    final RelationshipTypeResolver relationshipTypes =
        new RelationshipTypeResolver(Entity.getCollectionDAO().relationshipTypeDAO());
    return OntologyPatternInstantiationService.createDefault(
        changeSetRepository(), relationshipTypes, Clock.systemUTC());
  }

  private static GlossaryRepository glossaryRepository() {
    return (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY);
  }

  private static OntologyChangeSetRepository changeSetRepository() {
    return (OntologyChangeSetRepository) Entity.getEntityRepository(Entity.ONTOLOGY_CHANGE_SET);
  }
}
