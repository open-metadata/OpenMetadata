package org.openmetadata.service.resources.rdf;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.UUID;
import javax.validation.constraints.NotNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;

@Path("/v1/rdf")
@Tag(name = "RDF", description = "APIs for RDF and SPARQL operations")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "rdf", order = 9)
@Slf4j
public class RdfResource {
  public static final String COLLECTION_PATH = "/v1/rdf";
  private final RdfRepository rdfRepository;
  private final Authorizer authorizer;
  private OpenMetadataApplicationConfig config;

  public static final String RDF_XML = "application/rdf+xml";
  public static final String TURTLE = "text/turtle";
  public static final String N_TRIPLES = "application/n-triples";
  public static final String JSON_LD = "application/ld+json";
  public static final String SPARQL_JSON = "application/sparql-results+json";
  public static final String SPARQL_XML = "application/sparql-results+xml";
  public static final String SPARQL_CSV = "text/csv";

  public RdfResource(Authorizer authorizer) {
    this.authorizer = authorizer;
    this.rdfRepository = RdfRepository.getInstance();
  }

  public void initialize(OpenMetadataApplicationConfig config) {
    this.config = config;
    // Check if RDF is enabled
    if (config.getRdfConfiguration() == null
        || !Boolean.TRUE.equals(config.getRdfConfiguration().getEnabled())) {
      LOG.info("RDF support is disabled in configuration");
    }
  }

  @GET
  @Path("/status")
  @Operation(
      operationId = "getRdfStatus",
      summary = "Get RDF service status",
      description = "Check if RDF service is enabled",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "RDF service status",
            content = @Content(mediaType = MediaType.APPLICATION_JSON))
      })
  public Response getRdfStatus(@Context SecurityContext securityContext) {
    return Response.ok()
        .entity("{\"enabled\": " + rdfRepository.isEnabled() + "}")
        .type(MediaType.APPLICATION_JSON)
        .build();
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

  @GET
  @Path("/graph/explore")
  @Operation(
      operationId = "exploreEntityGraph",
      summary = "Explore entity graph",
      description = "Get graph data for an entity with relationships up to specified depth",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Graph data with nodes and edges",
            content = @Content(mediaType = MediaType.APPLICATION_JSON)),
        @ApiResponse(responseCode = "404", description = "Entity not found"),
        @ApiResponse(responseCode = "503", description = "RDF service not enabled")
      })
  public Response exploreEntityGraph(
      @Context SecurityContext securityContext,
      @Parameter(description = "Entity ID", required = true) @QueryParam("entityId") UUID entityId,
      @Parameter(description = "Entity type", required = true) @QueryParam("entityType")
          String entityType,
      @Parameter(description = "Depth of relationships to explore")
          @QueryParam("depth")
          @DefaultValue("2")
          int depth) {

    try {
      if (!rdfRepository.isEnabled()) {
        return Response.status(Response.Status.SERVICE_UNAVAILABLE)
            .entity("{\"error\": \"RDF service not enabled\"}")
            .build();
      }

      String graphData = rdfRepository.getEntityGraph(entityId, entityType, depth);
      return Response.ok(graphData, MediaType.APPLICATION_JSON).build();

    } catch (Exception e) {
      LOG.error("Error exploring entity graph", e);
      return Response.serverError().entity("{\"error\": \"" + e.getMessage() + "\"}").build();
    }
  }
}
