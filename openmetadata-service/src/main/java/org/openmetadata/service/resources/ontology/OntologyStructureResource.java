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
import org.openmetadata.schema.api.data.MergeOntologyStructure;
import org.openmetadata.schema.api.data.OntologyStructuralDiff;
import org.openmetadata.schema.api.data.OntologyStructuralDiffRequest;
import org.openmetadata.schema.api.data.OntologyStructuralMergeResult;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.OntologyChangeSetRepository;
import org.openmetadata.service.ontology.OntologyStructuralDiffService;
import org.openmetadata.service.ontology.OntologyStructuralMergeService;
import org.openmetadata.service.ontology.OntologyStructuralMergeService.MergeExecution;
import org.openmetadata.service.ontology.RelationshipTypeResolver;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Path("/v1/ontology/structure")
@Tag(
    name = "Ontology Structure",
    description = "Three-way comparison and selective merge for application ontologies.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "ontologyStructure", order = 11)
public final class OntologyStructureResource {
  private final Authorizer authorizer;
  private final GlossaryRepository glossaryRepository;
  private final OntologyStructuralDiffService diffService;
  private final OntologyStructuralMergeService mergeService;

  public OntologyStructureResource(final Authorizer authorizer) {
    this(authorizer, glossaryRepository(), createServices());
  }

  OntologyStructureResource(
      final Authorizer authorizer,
      final GlossaryRepository glossaryRepository,
      final Services services) {
    this.authorizer = authorizer;
    this.glossaryRepository = glossaryRepository;
    this.diffService = services.diffService();
    this.mergeService = services.mergeService();
  }

  @POST
  @Path("/diff")
  @Operation(
      operationId = "diffOntologyStructure",
      summary = "Compare source changes with an application ontology subset")
  public OntologyStructuralDiff diff(
      @Context final SecurityContext securityContext,
      @Valid final OntologyStructuralDiffRequest request) {
    final Glossaries glossaries =
        glossaries(request.getSourceGlossaryId(), request.getTargetGlossaryId());
    authorize(securityContext, glossaries.source(), MetadataOperation.VIEW_BASIC);
    authorize(securityContext, glossaries.target(), MetadataOperation.VIEW_BASIC);
    return diffService.diff(glossaries.source(), glossaries.target(), request.getSubsetTermIds());
  }

  @POST
  @Path("/merge")
  @Operation(
      operationId = "mergeOntologyStructure",
      summary = "Create a Draft from selected source structure changes")
  public OntologyStructuralMergeResult merge(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @Valid final MergeOntologyStructure request) {
    final Glossaries glossaries =
        glossaries(request.getSourceGlossaryId(), request.getTargetGlossaryId());
    authorize(securityContext, glossaries.source(), MetadataOperation.VIEW_BASIC);
    authorize(securityContext, glossaries.target(), MetadataOperation.EDIT_GLOSSARY_TERMS);
    final MergeExecution execution = new MergeExecution(uriInfo, requireUser(securityContext));
    return mergeService.merge(glossaries.source(), glossaries.target(), request, execution);
  }

  private Glossaries glossaries(final UUID sourceId, final UUID targetId) {
    return new Glossaries(glossary(sourceId), glossary(targetId));
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

  private static Services createServices() {
    final GlossaryTermRepository termRepository = termRepository();
    final OntologyChangeSetRepository changeSetRepository =
        (OntologyChangeSetRepository) Entity.getEntityRepository(Entity.ONTOLOGY_CHANGE_SET);
    final RelationshipTypeResolver relationshipTypes =
        new RelationshipTypeResolver(Entity.getCollectionDAO().relationshipTypeDAO());
    final Clock clock = Clock.systemUTC();
    return new Services(
        OntologyStructuralDiffService.createDefault(termRepository),
        OntologyStructuralMergeService.createDefault(
            termRepository, changeSetRepository, relationshipTypes, clock));
  }

  private static GlossaryRepository glossaryRepository() {
    return (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY);
  }

  private static GlossaryTermRepository termRepository() {
    return (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
  }

  record Services(
      OntologyStructuralDiffService diffService, OntologyStructuralMergeService mergeService) {}

  private record Glossaries(Glossary source, Glossary target) {}
}
