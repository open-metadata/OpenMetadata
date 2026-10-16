package org.openmetadata.service.resources.ontology;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.UUID;
import org.openmetadata.schema.api.data.OntologyReleaseDiff;
import org.openmetadata.schema.api.data.OntologyReleaseStructureReport;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyReleaseEvent;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.OntologyReleaseRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.ontology.OntologyReleaseComparison;
import org.openmetadata.service.ontology.OntologyReleaseReader;
import org.openmetadata.service.ontology.OntologyReleaseStructure;
import org.openmetadata.service.rdf.OntologyReleaseExporter;
import org.openmetadata.service.rdf.RdfSerializationFormat;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;

@Path("/v1/ontologyReleases")
@Tag(
    name = "Ontology Releases",
    description = "Immutable captured ontology definitions and their workflow status.")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "ontologyReleases", order = 4)
public final class OntologyReleaseResource
    extends EntityResource<OntologyRelease, OntologyReleaseRepository> {
  private final OntologyReleaseExporter exporter;
  private final OntologyReleaseStructure structure;
  private final OntologyReleaseComparison comparison;

  public OntologyReleaseResource(final Authorizer authorizer, final Limits limits) {
    super(Entity.ONTOLOGY_RELEASE, authorizer, limits);
    exporter = new OntologyReleaseExporter(repository);
    structure = new OntologyReleaseStructure(repository);
    comparison = new OntologyReleaseComparison(repository);
  }

  public static class OntologyReleaseList extends ResultList<OntologyRelease> {}

  @GET
  @Operation(operationId = "listOntologyReleases", summary = "List sealed ontology releases")
  public ResultList<OntologyRelease> list(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @QueryParam("ontologyId") final UUID ontologyId,
      @QueryParam("limit") @DefaultValue("50") @Min(1) @Max(1000) final int limit,
      @QueryParam("after") final String after) {
    final ListFilter filter = new ListFilter(Include.NON_DELETED);
    if (ontologyId != null) {
      filter.addQueryParam("ontologyId", ontologyId.toString());
    }
    return listInternal(uriInfo, securityContext, "owners,reviewers", filter, limit, null, after);
  }

  @GET
  @Path("/{id}")
  @Operation(operationId = "getOntologyRelease", summary = "Get a sealed ontology release")
  public OntologyRelease get(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id) {
    return getInternal(uriInfo, securityContext, id, "owners,reviewers", Include.NON_DELETED, null);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getOntologyReleaseVersion",
      summary = "Read the release header version submitted to an approval workflow")
  public OntologyRelease getVersion(
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @PathParam("version") final String version) {
    return getVersionInternal(securityContext, id, version);
  }

  @GET
  @Path("/{id}/diff")
  @Operation(
      operationId = "compareOntologyReleases",
      summary = "Compare governed definitions and import pins across two sealed release closures",
      description =
          "Omitting the base compares with an empty ontology. Both closures must be readable and belong to the same ontology. Workflow-only changes are excluded; this does not compute logical equivalence or inferred impact.")
  public OntologyReleaseDiff diff(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @QueryParam("baseReleaseId") final UUID baseReleaseId,
      @QueryParam("limit") @DefaultValue("50") @Min(1) @Max(1000) final int limit,
      @QueryParam("after") final String after) {
    final OntologyRelease release = get(uriInfo, securityContext, id);
    final OntologyRelease base =
        baseReleaseId == null ? null : get(uriInfo, securityContext, baseReleaseId);
    return comparison.compare(
        release,
        base,
        limit,
        after,
        definition -> OntologyResourceAccess.requireView(authorizer, securityContext, definition));
  }

  @GET
  @Path("/{id}/structure")
  @Operation(
      operationId = "getOntologyReleaseStructure",
      summary = "Check property declarations and axiom structure across a sealed import closure",
      description =
          "Returns structural diagnostics over frozen SQL members. It does not run the complete OWL 2 DL profile or logical checks, approve a release, or change publication state.")
  public OntologyReleaseStructureReport structure(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id) {
    final OntologyRelease release = get(uriInfo, securityContext, id);
    return structure.report(
        release,
        definition -> OntologyResourceAccess.requireView(authorizer, securityContext, definition));
  }

  @GET
  @Path("/{id}/export")
  @Produces({"text/turtle", "application/rdf+xml", "application/n-triples", "application/ld+json"})
  @Operation(
      operationId = "exportOntologyRelease",
      summary = "Export the asserted content of a sealed ontology release",
      description =
          "Exports the captured definitions, independently of working edits and RDF service availability. Export does not approve or activate a candidate.")
  public Response export(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @QueryParam("format") @DefaultValue("turtle") final String requestedFormat) {
    final OntologyRelease release = get(uriInfo, securityContext, id);
    final RdfSerializationFormat format = RdfSerializationFormat.parse(requestedFormat);
    final String content =
        exporter.export(
            release,
            format,
            definition ->
                OntologyResourceAccess.requireView(authorizer, securityContext, definition));
    return Response.ok(content, format.mediaType())
        .header(
            "Content-Disposition",
            "attachment; filename=\"ontology-release-" + id + "." + format.extension() + "\"")
        .build();
  }

  @GET
  @Path("/{id}/events")
  @Operation(
      operationId = "listOntologyReleaseEvents",
      summary = "Read durable release capture and workflow decisions")
  public ResultList<OntologyReleaseEvent> listEvents(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @QueryParam("limit") @DefaultValue("50") @Min(1) @Max(1000) final int limit,
      @QueryParam("after") final String after) {
    get(uriInfo, securityContext, id);
    return repository.listEvents(id, limit, after);
  }

  @GET
  @Path("/{id}/members/{kind}/{memberId}")
  @Operation(operationId = "getOntologyReleaseMember", summary = "Read an immutable release member")
  public OntologyReleaseMember getMember(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @PathParam("kind") final MemberKind kind,
      @PathParam("memberId") final UUID memberId) {
    get(uriInfo, securityContext, id);
    final OntologyReleaseMember member = repository.getMember(id, kind, memberId);
    authorizeMember(securityContext, member);
    return member;
  }

  @GET
  @Path("/{id}/members/{kind}")
  @Operation(
      operationId = "listOntologyReleaseMembers",
      summary = "Page through one release's immutable members")
  public ResultList<OntologyReleaseMember> listMembers(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @PathParam("id") final UUID id,
      @PathParam("kind") final MemberKind kind,
      @QueryParam("limit") @DefaultValue("50") @Min(1) @Max(1000) final int limit,
      @QueryParam("after") final String after) {
    get(uriInfo, securityContext, id);
    final ResultList<OntologyReleaseMember> members =
        repository.listMembers(id, kind, limit, after);
    members.getData().forEach(member -> authorizeMember(securityContext, member));
    return members;
  }

  private void authorizeMember(
      final SecurityContext securityContext, final OntologyReleaseMember member) {
    OntologyResourceAccess.requireView(
        authorizer, securityContext, OntologyReleaseReader.definition(member));
  }
}
