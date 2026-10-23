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
import jakarta.json.JsonPatch;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.ServiceUnavailableException;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.net.URI;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.api.data.CreateOntology;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.api.data.OntologyWorkingDiff;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
import org.openmetadata.schema.api.data.PreviewNativeOntologyPack;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyReference;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.OntologyAxiomRepository;
import org.openmetadata.service.jdbi3.OntologyConceptRepository;
import org.openmetadata.service.jdbi3.OntologyPropertyRepository;
import org.openmetadata.service.jdbi3.OntologyReleaseRepository;
import org.openmetadata.service.jdbi3.OntologyRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.ontology.OntologyPackCatalog;
import org.openmetadata.service.ontology.OntologyPackContentLoader;
import org.openmetadata.service.ontology.OntologyPackInstallations;
import org.openmetadata.service.ontology.OntologyReleaseActivation;
import org.openmetadata.service.ontology.OntologyReleaseCapture;
import org.openmetadata.service.ontology.OntologyReleaseComparison;
import org.openmetadata.service.ontology.OntologyReleaseHistory;
import org.openmetadata.service.ontology.OntologyReleaseQuery;
import org.openmetadata.service.rdf.NativeOntologyRdfImporter;
import org.openmetadata.service.rdf.RdfSerializationFormat;
import org.openmetadata.service.rdf.RdfUpdater;
import org.openmetadata.service.rdf.SparqlQueryExecutionGuard;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Path("/v1/ontologies")
@Tag(
    name = "Ontologies",
    description = "Independent ontology definitions governed through approval workflows.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "ontologies", order = 3)
public class OntologyResource extends EntityResource<Ontology, OntologyRepository> {
  public static final String COLLECTION_PATH = "/v1/ontologies/";
  private final OntologyMapper mapper = new OntologyMapper();
  private final OntologyReleaseCapture releaseCapture;
  private final OntologyReleaseActivation releaseActivation;
  private final OntologyReleaseHistory releaseHistory;
  private final OntologyPackCatalog packCatalog;
  private final OntologyPackContentLoader packContentLoader;

  public OntologyResource(final Authorizer authorizer, final Limits limits) {
    super(Entity.ONTOLOGY, authorizer, limits);
    packCatalog = new OntologyPackCatalog(getClass().getClassLoader());
    packContentLoader = new OntologyPackContentLoader(getClass().getClassLoader());
    releaseHistory = new OntologyReleaseHistory(repository.getDaoCollection().ontologyReleaseDAO());
    releaseActivation =
        new OntologyReleaseActivation(
            repository,
            Clock.systemUTC(),
            id -> RdfUpdater.enqueueOntologyGraph(repository.getDaoCollection(), id));
    releaseCapture =
        new OntologyReleaseCapture(
            (OntologyReleaseRepository) Entity.getEntityRepository(Entity.ONTOLOGY_RELEASE),
            repository,
            Map.of(
                MemberKind.CONCEPT,
                (OntologyConceptRepository) Entity.getEntityRepository(Entity.ONTOLOGY_CONCEPT),
                MemberKind.PROPERTY,
                (OntologyPropertyRepository) Entity.getEntityRepository(Entity.ONTOLOGY_PROPERTY),
                MemberKind.AXIOM,
                (OntologyAxiomRepository) Entity.getEntityRepository(Entity.ONTOLOGY_AXIOM)),
            Clock.systemUTC());
  }

  public static class OntologyList extends ResultList<Ontology> {}

  @POST
  @Path("/{id}/sparql")
  @Consumes(MediaType.APPLICATION_JSON)
  @Produces({
    "application/sparql-results+json",
    "application/sparql-results+xml",
    "text/csv",
    "text/tab-separated-values",
    "text/turtle",
    "application/rdf+xml",
    "application/n-triples",
    "application/ld+json"
  })
  @Operation(
      operationId = "queryActiveOntologyRelease",
      summary = "Query the active ontology release",
      description =
          "Runs read-only SPARQL over the active release's verified SQL projection. Requires view access to every captured member and cannot access other graphs or external services. Working edits are excluded.")
  public Response query(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext context,
      @PathParam("id") final UUID id,
      @Valid final SparqlQuery request) {
    getInternal(uriInfo, context, id, "", Include.NON_DELETED, null);
    final var service =
        new OntologyReleaseQuery(
            repository,
            (OntologyReleaseRepository) Entity.getEntityRepository(Entity.ONTOLOGY_RELEASE));
    try {
      final var result =
          SparqlQueryExecutionGuard.shared()
              .execute(
                  user(context),
                  () ->
                      service.query(
                          id,
                          request,
                          definition ->
                              OntologyResourceAccess.requireView(authorizer, context, definition)));
      return Response.ok(result.body(), result.mediaType()).build();
    } catch (SparqlFederationGuard.FederationDisallowedException exception) {
      throw new ForbiddenException(exception.getMessage(), exception);
    } catch (SparqlQueryExecutionGuard.QueryCapacityException exception) {
      throw new ClientErrorException(exception.getMessage(), Response.Status.TOO_MANY_REQUESTS);
    } catch (SparqlQueryExecutionGuard.QueryTimeoutException exception) {
      throw new ServiceUnavailableException(
          Response.status(Response.Status.SERVICE_UNAVAILABLE)
              .entity(exception.getMessage())
              .build(),
          exception);
    }
  }

  @PUT
  @Path("/{id}/activation")
  @Operation(
      operationId = "activateOntologyRelease",
      summary = "Activate an approved ontology release or roll back to an older release")
  public OntologyState activateRelease(
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @Valid final ActivateOntologyRelease request) {
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.ONTOLOGY, MetadataOperation.EDIT_ALL),
        getResourceContextById(id));
    return releaseActivation.activate(
        id,
        request,
        new OntologyReleaseActivation.Access(
            user(securityContext),
            definition ->
                OntologyResourceAccess.requireView(authorizer, securityContext, definition)));
  }

  @GET
  @Path("/{id}/state")
  @Operation(
      operationId = "getOntologyState",
      summary = "Get ontology working and activation revisions")
  public OntologyState getState(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id) {
    getInternal(uriInfo, securityContext, id, "", Include.NON_DELETED, null);
    return repository.getState(id);
  }

  @GET
  @Path("/{id}/working/diff")
  @Operation(
      operationId = "getOntologyWorkingDiff",
      summary = "Preview working ontology changes against the active release")
  public OntologyWorkingDiff workingDiff(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @QueryParam("limit") @DefaultValue("25") @Min(1) @Max(1000) final int limit,
      @QueryParam("after") final String after) {
    getInternal(uriInfo, securityContext, id, "", Include.NON_DELETED, null);
    final var releases =
        (OntologyReleaseRepository) Entity.getEntityRepository(Entity.ONTOLOGY_RELEASE);
    final Consumer<List<? extends OntologyDefinition>> authorize =
        definitions -> OntologyResourceAccess.requireView(authorizer, securityContext, definitions);
    return releaseCapture
        .snapshot()
        .read(
            id,
            authorize,
            working ->
                new OntologyReleaseComparison(releases)
                    .compareWorking(working, limit, after, authorize));
  }

  @POST
  @Path("/{id}/library/{packId}/preview")
  @Operation(
      operationId = "previewNativeOntologyPack",
      summary = "Preview verified library modules as native ontology draft operations")
  public CreateOntologyChangeSet previewLibraryPack(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @PathParam("packId") final String packId,
      @NotNull @Valid final PreviewNativeOntologyPack request) {
    getInternal(uriInfo, securityContext, id, "", Include.NON_DELETED, null);
    final var selected =
        packContentLoader.loadSelected(packCatalog, packId, request.getModuleIds());
    return previewImport(
            uriInfo,
            securityContext,
            id,
            new PreviewNativeOntologyImport()
                .withFormat(PreviewNativeOntologyImport.Format.fromValue(selected.format()))
                .withData(selected.body()))
        .withSourcePack(OntologyPackInstallations.sourcePack(selected));
  }

  @POST
  @Path("/{id}/imports/preview")
  @Operation(
      operationId = "previewNativeOntologyImport",
      summary = "Preview local RDF as native ontology draft operations")
  public CreateOntologyChangeSet previewImport(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @NotNull @Valid final PreviewNativeOntologyImport request) {
    getInternal(uriInfo, securityContext, id, "", Include.NON_DELETED, null);
    final NativeOntologyRdfImporter importer = new NativeOntologyRdfImporter();
    final var model =
        importer.parse(
            request.getData(), RdfSerializationFormat.parse(request.getFormat().value()));
    try {
      return releaseCapture
          .snapshot()
          .read(
              id,
              definitions ->
                  OntologyResourceAccess.requireView(authorizer, securityContext, definitions),
              working -> importer.reconcile(model, working));
    } finally {
      model.close();
    }
  }

  @GET
  @Path("/{id}/references")
  @Operation(
      operationId = "listOntologyReferences",
      summary = "Find working definitions that reference an exact IRI in this ontology")
  public ResultList<OntologyReference> listReferences(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @QueryParam("iri") final URI iri,
      @QueryParam("limit") @DefaultValue("50") @Min(1) @Max(1000) final int limit,
      @QueryParam("after") final String after) {
    getInternal(uriInfo, securityContext, id, "", Include.NON_DELETED, null);
    final ResultList<OntologyReference> references =
        repository.listReferences(id, iri, limit, after);
    for (final OntologyReference reference : references.getData()) {
      final var source = reference.getSource();
      final ResourceContext<?> context =
          new ResourceContext<>(source.getType(), source.getId(), null);
      authorizer.authorize(
          securityContext,
          new OperationContext(source.getType(), MetadataOperation.VIEW_ALL),
          context);
      reference.setSource(context.getEntity().getEntityReference());
    }
    return references;
  }

  @GET
  @Path("/{id}/releases")
  @Operation(
      operationId = "listOntologyReleaseHistory",
      summary = "List this ontology's sealed releases, newest first")
  public ResultList<OntologyRelease> listReleaseHistory(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @QueryParam("limit") @DefaultValue("50") @Min(1) @Max(100) final int limit,
      @QueryParam("after") final String after) {
    getInternal(uriInfo, securityContext, id, "", Include.NON_DELETED, null);
    final ResultList<OntologyRelease> page = releaseHistory.list(id, limit, after);
    OntologyResourceAccess.requireView(authorizer, securityContext, page.getData());
    return page;
  }

  @POST
  @Path("/{id}/releases")
  @Operation(
      operationId = "captureOntologyRelease",
      summary = "Capture immutable ontology release content")
  public Response captureRelease(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @Valid final CaptureOntologyRelease request) {
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.ONTOLOGY, MetadataOperation.EDIT_ALL),
        getResourceContextById(id));
    final OntologyRelease release =
        releaseCapture.capture(
            id,
            request,
            new OntologyReleaseCapture.Access(
                user(securityContext),
                definition ->
                    OntologyResourceAccess.requireView(authorizer, securityContext, definition)));
    final URI location =
        uriInfo
            .getBaseUriBuilder()
            .path("v1/ontologyReleases")
            .path(release.getId().toString())
            .build();
    release.setHref(location);
    return Response.created(location).entity(release).build();
  }

  @GET
  @Operation(operationId = "listOntologies", summary = "List ontology definitions")
  public ResultList<Ontology> list(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @QueryParam("fields") final String fields,
      @QueryParam("limit") @DefaultValue("50") @Min(0) @Max(1000000) final int limit,
      @QueryParam("before") final String before,
      @QueryParam("after") final String after,
      @QueryParam("include") @DefaultValue("non-deleted") final Include include) {
    final ListFilter filter = new ListFilter(include);
    return listInternal(uriInfo, securityContext, fields, filter, limit, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(operationId = "getOntologyById", summary = "Get an ontology")
  public Ontology get(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @QueryParam("fields") final String fields,
      @QueryParam("include") @DefaultValue("non-deleted") final Include include) {
    return getInternal(uriInfo, securityContext, id, fields, include, null);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(operationId = "getOntologyByName", summary = "Get an ontology by name")
  public Ontology getByName(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("fqn") final String fqn,
      @QueryParam("fields") final String fields,
      @QueryParam("include") @DefaultValue("non-deleted") final Include include) {
    return getByNameInternal(uriInfo, securityContext, fqn, fields, include, null);
  }

  @POST
  @Operation(operationId = "createOntology", summary = "Create an ontology")
  public Response create(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @Valid final CreateOntology request) {
    final Ontology entity = mapper.createToEntity(request, user(securityContext));
    return create(uriInfo, securityContext, entity);
  }

  @PUT
  @Operation(operationId = "createOrUpdateOntology", summary = "Create or update an ontology")
  public Response createOrUpdate(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @Valid final CreateOntology request) {
    final Ontology entity = mapper.createToEntity(request, user(securityContext));
    return createOrUpdate(uriInfo, securityContext, entity);
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(operationId = "patchOntology", summary = "Patch an ontology")
  public Response patch(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      final JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(operationId = "listOntologyVersions", summary = "List ontology versions")
  public EntityHistory listVersions(
      @Context final SecurityContext securityContext, @PathParam("id") final UUID id) {
    return listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(operationId = "getOntologyVersion", summary = "Get an ontology version")
  public Ontology getVersion(
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @PathParam("version") final String version) {
    return getVersionInternal(securityContext, id, version);
  }

  @DELETE
  @Path("/{id}")
  @Operation(operationId = "deleteOntology", summary = "Delete an ontology")
  public Response delete(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @QueryParam("recursive") @DefaultValue("false") final boolean recursive,
      @QueryParam("hardDelete") @DefaultValue("false") final boolean hardDelete) {
    return super.delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteOntologyByName",
      summary = "Delete an ontology definition by name")
  public Response deleteByName(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("fqn") final String fqn,
      @QueryParam("recursive") @DefaultValue("false") final boolean recursive,
      @QueryParam("hardDelete") @DefaultValue("false") final boolean hardDelete) {
    return super.deleteByName(uriInfo, securityContext, fqn, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(operationId = "restoreOntology", summary = "Restore an ontology")
  public Response restore(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @Valid final RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private static String user(final SecurityContext securityContext) {
    return securityContext.getUserPrincipal().getName();
  }
}
