package org.openmetadata.service.resources.rdf;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.util.UUID;
import javax.validation.constraints.NotNull;
import javax.ws.rs.Consumes;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.security.Authorizer;

@Path("/v1/rdf")
@Tag(name = "RDF", description = "APIs for RDF and SPARQL operations")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Slf4j
public class RdfResource {

  private final RdfRepository rdfRepository;
  private final Authorizer authorizer;

  public static final String RDF_XML = "application/rdf+xml";
  public static final String TURTLE = "text/turtle";
  public static final String N_TRIPLES = "application/n-triples";
  public static final String JSON_LD = "application/ld+json";
  public static final String SPARQL_JSON = "application/sparql-results+json";
  public static final String SPARQL_XML = "application/sparql-results+xml";
  public static final String SPARQL_CSV = "text/csv";

  public RdfResource(Authorizer authorizer, OpenMetadataApplicationConfig config) {
    this.authorizer = authorizer;
    this.rdfRepository = RdfRepository.getInstance();
  }

  @GET
  @Path("/entity/{entityType}/{id}")
  @Operation(
      operationId = "getEntityAsRdf",
      summary = "Get entity as RDF",
      description = "Retrieve an entity in RDF format (JSON-LD, Turtle, RDF/XML, N-Triples)",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity in requested RDF format",
            content = {
              @Content(mediaType = JSON_LD),
              @Content(mediaType = TURTLE),
              @Content(mediaType = RDF_XML),
              @Content(mediaType = N_TRIPLES)
            }),
        @ApiResponse(responseCode = "404", description = "Entity not found"),
        @ApiResponse(responseCode = "503", description = "RDF service not enabled")
      })
  @Produces({JSON_LD, TURTLE, RDF_XML, N_TRIPLES, MediaType.APPLICATION_JSON})
  public Response getEntityAsRdf(
      @Context SecurityContext securityContext,
      @Context UriInfo uriInfo,
      @Parameter(description = "Entity type", required = true) @PathParam("entityType")
          String entityType,
      @Parameter(description = "Entity id", required = true) @PathParam("id") UUID id,
      @Parameter(description = "RDF format") @QueryParam("format") @DefaultValue("jsonld")
          String format) {

    try {
      if (!rdfRepository.isEnabled()) {
        return Response.status(Response.Status.SERVICE_UNAVAILABLE)
            .entity("{\"error\": \"RDF service not enabled\"}")
            .build();
      }

      String result;
      MediaType mediaType;

      switch (format.toLowerCase()) {
        case "turtle":
        case "ttl":
          result = rdfRepository.getEntityAsRdf(entityType, id, "turtle");
          mediaType = MediaType.valueOf(TURTLE);
          break;
        case "rdfxml":
        case "xml":
          result = rdfRepository.getEntityAsRdf(entityType, id, "rdfxml");
          mediaType = MediaType.valueOf(RDF_XML);
          break;
        case "ntriples":
        case "nt":
          result = rdfRepository.getEntityAsRdf(entityType, id, "ntriples");
          mediaType = MediaType.valueOf(N_TRIPLES);
          break;
        case "jsonld":
        case "json-ld":
        default:
          result = rdfRepository.getEntityAsJsonLd(entityType, id);
          mediaType = MediaType.valueOf(JSON_LD);
          break;
      }

      return Response.ok(result, mediaType).build();

    } catch (IOException e) {
      LOG.error("Error retrieving entity as RDF", e);
      return Response.serverError().entity("Error retrieving entity: " + e.getMessage()).build();
    }
  }

  @POST
  @Path("/sparql")
  @Operation(
      operationId = "executeSparqlQuery",
      summary = "Execute SPARQL query",
      description = "Execute a SPARQL SELECT, CONSTRUCT, ASK, or DESCRIBE query",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Query results",
            content = {
              @Content(mediaType = SPARQL_JSON),
              @Content(mediaType = SPARQL_XML),
              @Content(mediaType = SPARQL_CSV),
              @Content(mediaType = TURTLE),
              @Content(mediaType = JSON_LD)
            }),
        @ApiResponse(responseCode = "400", description = "Invalid SPARQL query"),
        @ApiResponse(responseCode = "503", description = "RDF service not enabled")
      })
  @Consumes({MediaType.TEXT_PLAIN, MediaType.APPLICATION_FORM_URLENCODED})
  @Produces({SPARQL_JSON, SPARQL_XML, SPARQL_CSV, JSON_LD, TURTLE, MediaType.TEXT_PLAIN})
  public Response executeSparqlQuery(
      @Context SecurityContext securityContext,
      @NotNull String query,
      @Parameter(description = "Result format") @QueryParam("format") @DefaultValue("json")
          String format) {

    try {
      if (!rdfRepository.isEnabled()) {
        return Response.status(Response.Status.SERVICE_UNAVAILABLE)
            .entity("{\"error\": \"RDF service not enabled\"}")
            .build();
      }

      String result = rdfRepository.executeSparqlQuery(query, format);

      MediaType mediaType;
      switch (format.toLowerCase()) {
        case "xml":
          mediaType = MediaType.valueOf(SPARQL_XML);
          break;
        case "csv":
          mediaType = MediaType.valueOf(SPARQL_CSV);
          break;
        case "turtle":
        case "ttl":
          mediaType = MediaType.valueOf(TURTLE);
          break;
        case "jsonld":
          mediaType = MediaType.valueOf(JSON_LD);
          break;
        case "json":
        default:
          mediaType = MediaType.valueOf(SPARQL_JSON);
          break;
      }

      return Response.ok(result, mediaType).build();

    } catch (Exception e) {
      LOG.error("Error executing SPARQL query", e);
      return Response.status(Response.Status.BAD_REQUEST)
          .entity("{\"error\": \"" + e.getMessage() + "\"}")
          .build();
    }
  }
}
