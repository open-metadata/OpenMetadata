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
import java.util.UUID;
import org.openmetadata.schema.api.data.BuildOntologySubset;
import org.openmetadata.schema.api.data.OntologySubsetResult;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.OntologyChangeSetRepository;
import org.openmetadata.service.ontology.OntologySubsetService;
import org.openmetadata.service.ontology.RelationshipTypeResolver;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Path("/v1/ontology/subsets")
@Tag(name = "Ontology Subsets", description = "Version-pinned application ontology subset builder.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "ontologySubsets", order = 10)
public final class OntologySubsetResource {
  private final Authorizer authorizer;
  private final GlossaryRepository glossaryRepository;
  private final OntologySubsetService service;

  public OntologySubsetResource(final Authorizer authorizer) {
    this(authorizer, glossaryRepository(), createService());
  }

  OntologySubsetResource(
      final Authorizer authorizer,
      final GlossaryRepository glossaryRepository,
      final OntologySubsetService service) {
    this.authorizer = authorizer;
    this.glossaryRepository = glossaryRepository;
    this.service = service;
  }

  @POST
  @Operation(
      operationId = "buildOntologySubset",
      summary = "Create a Draft application ontology subset")
  public OntologySubsetResult build(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @Valid final BuildOntologySubset request) {
    final Glossary source = glossary(request.getSourceGlossaryId());
    final Glossary target = glossary(request.getTargetGlossaryId());
    authorize(securityContext, source, MetadataOperation.VIEW_BASIC);
    authorize(securityContext, target, MetadataOperation.EDIT_GLOSSARY_TERMS);
    return service.build(uriInfo, source, target, request, requireUser(securityContext));
  }

  private Glossary glossary(final UUID id) {
    return glossaryRepository.get(null, id, glossaryRepository.getFields(""));
  }

  private void authorize(
      final SecurityContext securityContext,
      final Glossary glossary,
      final MetadataOperation operation) {
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.GLOSSARY, operation),
        new ResourceContext<>(Entity.GLOSSARY, glossary, glossaryRepository));
  }

  private static String requireUser(final SecurityContext securityContext) {
    return Optional.ofNullable(securityContext)
        .map(SecurityContext::getUserPrincipal)
        .map(Principal::getName)
        .filter(name -> !name.isBlank())
        .orElseThrow(() -> new NotAuthorizedException("Authentication is required"));
  }

  private static OntologySubsetService createService() {
    final GlossaryTermRepository termRepository =
        (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
    final OntologyChangeSetRepository changeSetRepository =
        (OntologyChangeSetRepository) Entity.getEntityRepository(Entity.ONTOLOGY_CHANGE_SET);
    final RelationshipTypeResolver relationshipTypes =
        new RelationshipTypeResolver(Entity.getCollectionDAO().relationshipTypeDAO());
    return OntologySubsetService.createDefault(
        termRepository, changeSetRepository, relationshipTypes, Clock.systemUTC());
  }

  private static GlossaryRepository glossaryRepository() {
    return (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY);
  }
}
