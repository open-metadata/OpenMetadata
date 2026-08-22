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
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.security.Principal;
import java.util.Optional;
import org.openmetadata.schema.api.data.InstallOntologyPack;
import org.openmetadata.schema.api.data.OntologyPackInstallResult;
import org.openmetadata.schema.api.data.OntologyPackList;
import org.openmetadata.schema.api.data.OntologyPackManifest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.ontology.OntologyPackInstaller;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Path("/v1/ontologyPacks")
@Tag(name = "Ontology Packs", description = "Verified Ontology Studio library catalogue.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "ontologyPacks", order = 6)
public final class OntologyPackResource {
  private final Authorizer authorizer;
  private final OntologyPackInstaller installer;

  public OntologyPackResource(final Authorizer authorizer) {
    this(
        authorizer,
        OntologyPackInstaller.createDefault(OntologyPackResource.class.getClassLoader()));
  }

  OntologyPackResource(final Authorizer authorizer, final OntologyPackInstaller installer) {
    this.authorizer = authorizer;
    this.installer = installer;
  }

  @GET
  @Operation(operationId = "listOntologyPacks", summary = "List ontology library packs")
  public OntologyPackList list(@Context final SecurityContext securityContext) {
    requireUser(securityContext);
    return new OntologyPackList().withPacks(installer.catalog().list());
  }

  @GET
  @Path("/{packId}")
  @Operation(operationId = "getOntologyPack", summary = "Get an ontology library pack")
  public OntologyPackManifest get(
      @Context final SecurityContext securityContext, @PathParam("packId") final String packId) {
    requireUser(securityContext);
    return installer.catalog().require(packId);
  }

  @POST
  @Path("/{packId}/install")
  @Operation(
      operationId = "installOntologyPack",
      summary = "Dry-run or install selected ontology pack modules")
  public OntologyPackInstallResult install(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("packId") final String packId,
      @Valid final InstallOntologyPack request) {
    final String user = requireUser(securityContext);
    final String targetGlossary = OntologyPackInstaller.validatedTargetGlossary(request);
    authorizeTarget(securityContext, targetGlossary);
    final boolean canManageTypes = DefaultAuthorizer.getSubjectContext(securityContext).isAdmin();
    final OntologyPackInstaller.InstallationContext context =
        new OntologyPackInstaller.InstallationContext(uriInfo, user, canManageTypes);
    return installer.install(packId, request, context);
  }

  private void authorizeTarget(
      final SecurityContext securityContext, final String targetGlossaryName) {
    final GlossaryRepository repository =
        (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY);
    final Glossary existing = repository.findByNameOrNull(targetGlossaryName, Include.ALL);
    if (existing == null) {
      authorizeCreate(securityContext, targetGlossaryName);
    } else {
      authorizeEdit(securityContext, repository, existing);
    }
  }

  private void authorizeCreate(
      final SecurityContext securityContext, final String targetGlossaryName) {
    final Glossary candidate =
        new Glossary().withName(targetGlossaryName).withFullyQualifiedName(targetGlossaryName);
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.GLOSSARY, MetadataOperation.CREATE),
        new CreateResourceContext<>(Entity.GLOSSARY, candidate));
  }

  private void authorizeEdit(
      final SecurityContext securityContext,
      final GlossaryRepository repository,
      final Glossary glossary) {
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.GLOSSARY, MetadataOperation.EDIT_ALL),
        new ResourceContext<>(Entity.GLOSSARY, glossary, repository));
  }

  private static String requireUser(final SecurityContext securityContext) {
    return Optional.ofNullable(securityContext)
        .map(SecurityContext::getUserPrincipal)
        .map(Principal::getName)
        .filter(name -> !name.isBlank())
        .orElseThrow(() -> new NotAuthorizedException("Authentication is required"));
  }
}
