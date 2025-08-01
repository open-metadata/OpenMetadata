package org.openmetadata.service.resources.rdf;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
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
import javax.validation.constraints.NotEmpty;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.semantic.SemanticSearchEngine;
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
  private final SemanticSearchEngine semanticSearchEngine;
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
    this.semanticSearchEngine =
        new SemanticSearchEngine(rdfRepository, Entity.getSearchRepository());
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
      MediaType mediaType = switch (format.toLowerCase()) {
        case "turtle", "ttl" -> {
          result = rdfRepository.getEntityAsRdf(entityType, id, "turtle");
          yield MediaType.valueOf(TURTLE);
        }
        case "rdfxml", "xml" -> {
          result = rdfRepository.getEntityAsRdf(entityType, id, "rdfxml");
          yield MediaType.valueOf(RDF_XML);
        }
        case "ntriples", "nt" -> {
          result = rdfRepository.getEntityAsRdf(entityType, id, "ntriples");
          yield MediaType.valueOf(N_TRIPLES);
        }
        default -> {
          result = rdfRepository.getEntityAsJsonLd(entityType, id);
          yield MediaType.valueOf(JSON_LD);
        }
      };

      return Response.ok(result, mediaType).build();

    } catch (IOException e) {
      LOG.error("Error retrieving entity as RDF", e);
      return Response.serverError().entity("Error retrieving entity: " + e.getMessage()).build();
    }
  }

  // This method is now handled by querySparqlPost which takes a SparqlQuery object

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

  @GET
  @Path("/sparql")
  @Operation(
      operationId = "querySparqlGet",
      summary = "Execute SPARQL query via GET",
      description = "Execute a SPARQL query against the RDF store using GET method",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Query executed successfully",
            content = @Content(mediaType = MediaType.APPLICATION_JSON)),
        @ApiResponse(responseCode = "400", description = "Invalid query"),
        @ApiResponse(responseCode = "500", description = "Internal server error")
      })
  public Response querySparqlGet(
      @Parameter(description = "SPARQL query string", required = true)
          @QueryParam("query")
          @NotEmpty
          String query,
      @Parameter(
              description = "Response format (json, xml, csv, tsv)",
              schema = @Schema(defaultValue = "json"))
          @QueryParam("format")
          @DefaultValue("json")
          String format,
      @Parameter(
              description = "Enable inference/reasoning (none, rdfs, owl, custom)",
              schema = @Schema(defaultValue = "none"))
          @QueryParam("inference")
          @DefaultValue("none")
          String inference) {
    return executeSparqlQuery(query, format, inference);
  }

  @POST
  @Path("/sparql")
  @Operation(
      operationId = "querySparqlPost",
      summary = "Execute SPARQL query via POST",
      description = "Execute a SPARQL query against the RDF store using POST method",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Query executed successfully",
            content = @Content(mediaType = MediaType.APPLICATION_JSON)),
        @ApiResponse(responseCode = "400", description = "Invalid query"),
        @ApiResponse(responseCode = "500", description = "Internal server error")
      })
  public Response querySparqlPost(SparqlQuery sparqlQuery) {
    String inference =
        sparqlQuery.getInference() != null ? sparqlQuery.getInference().toString() : "none";
    String format = sparqlQuery.getFormat() != null ? sparqlQuery.getFormat().toString() : "json";
    return executeSparqlQuery(sparqlQuery.getQuery(), format, inference);
  }

  @POST
  @Path("/sparql/update")
  @Operation(
      operationId = "updateSparql",
      summary = "Execute SPARQL UPDATE",
      description = "Execute a SPARQL UPDATE operation (INSERT, DELETE, etc.)",
      responses = {
        @ApiResponse(responseCode = "200", description = "Update executed successfully"),
        @ApiResponse(responseCode = "400", description = "Invalid update query"),
        @ApiResponse(responseCode = "403", description = "Forbidden - insufficient permissions"),
        @ApiResponse(responseCode = "500", description = "Internal server error")
      })
  public Response updateSparql(
      @Parameter(description = "SPARQL UPDATE query", required = true) SparqlQuery sparqlQuery) {

    if (!rdfRepository.isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("RDF repository is not enabled")
          .build();
    }

    try {
      String query = sparqlQuery.getQuery().trim().toUpperCase();
      if (!query.startsWith("INSERT")
          && !query.startsWith("DELETE")
          && !query.startsWith("LOAD")
          && !query.startsWith("CLEAR")
          && !query.startsWith("CREATE")
          && !query.startsWith("DROP")) {
        return Response.status(Response.Status.BAD_REQUEST)
            .entity("Only SPARQL UPDATE operations are allowed on this endpoint")
            .build();
      }

      rdfRepository.executeSparqlUpdate(sparqlQuery.getQuery());
      return Response.ok().entity("{\"status\": \"success\"}").build();

    } catch (Exception e) {
      LOG.error("Error executing SPARQL update", e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("Error executing SPARQL update: " + e.getMessage())
          .build();
    }
  }

  private Response executeSparqlQuery(String query, String format, String inference) {
    if (!rdfRepository.isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("RDF repository is not enabled")
          .build();
    }

    try {
      String mimeType = getMimeTypeForFormat(format);
      String results;
      if (!"none".equalsIgnoreCase(inference)) {
        results = rdfRepository.executeSparqlQueryWithInference(query, mimeType, inference);
      } else {
        results = rdfRepository.executeSparqlQuery(query, mimeType);
      }
      return Response.ok(results).type(mimeType).build();
    } catch (IllegalArgumentException e) {
      LOG.error("Invalid SPARQL query: {}", query, e);
      return Response.status(Response.Status.BAD_REQUEST)
          .entity("Invalid SPARQL query: " + e.getMessage())
          .build();
    } catch (Exception e) {
      LOG.error("Error executing SPARQL query", e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("Error executing query: " + e.getMessage())
          .build();
    }
  }

  private String getMimeTypeForFormat(String format) {
    return switch (format.toLowerCase()) {
      case "json" -> SPARQL_JSON;
      case "xml" -> SPARQL_XML;
      case "csv" -> SPARQL_CSV;
      case "tsv" -> "text/tab-separated-values";
      case "turtle" -> TURTLE;
      case "rdfxml" -> RDF_XML;
      case "ntriples" -> N_TRIPLES;
      case "jsonld" -> JSON_LD;
      default -> SPARQL_JSON;
    };
  }

  @GET
  @Path("/inference/lineage/{entityId}")
  @Operation(
      operationId = "getFullLineage",
      summary = "Get full lineage with inference",
      description =
          "Get complete upstream and downstream lineage including transitive relationships",
      responses = {
        @ApiResponse(responseCode = "200", description = "Lineage retrieved successfully"),
        @ApiResponse(responseCode = "404", description = "Entity not found")
      })
  public Response getFullLineage(
      @Parameter(description = "Entity ID", required = true) @PathParam("entityId") UUID entityId,
      @Parameter(description = "Entity type", required = true) @QueryParam("entityType")
          String entityType,
      @Parameter(
              description = "Direction (upstream, downstream, both)",
              schema = @Schema(defaultValue = "both"))
          @QueryParam("direction")
          @DefaultValue("both")
          String direction) {

    try {
      String query = buildLineageQuery(entityId, entityType, direction);
      String results = rdfRepository.executeSparqlQueryWithInference(query, SPARQL_JSON, "custom");
      return Response.ok(results).build();
    } catch (Exception e) {
      LOG.error("Error getting lineage with inference", e);
      return Response.serverError().entity("Error: " + e.getMessage()).build();
    }
  }

  private String buildLineageQuery(UUID entityId, String entityType, String direction) {
    String entityUri = "https://open-metadata.org/entity/" + entityType + "/" + entityId;

    return switch (direction.toLowerCase()) {
      case "upstream" -> String.format(
          """
          PREFIX om: <https://open-metadata.org/ontology/>
          SELECT DISTINCT ?entity ?name ?type ?distance
          WHERE {
            <%s> om:upstream+ ?entity .
            ?entity om:name ?name .
            ?entity a ?type .
            BIND(1 as ?distance)
          }
          ORDER BY ?distance ?name
          """,
          entityUri);

      case "downstream" -> String.format(
          """
          PREFIX om: <https://open-metadata.org/ontology/>
          SELECT DISTINCT ?entity ?name ?type ?distance
          WHERE {
            <%s> om:downstream+ ?entity .
            ?entity om:name ?name .
            ?entity a ?type .
            BIND(1 as ?distance)
          }
          ORDER BY ?distance ?name
          """,
          entityUri);

      default -> String.format(
          """
          PREFIX om: <https://open-metadata.org/ontology/>
          SELECT DISTINCT ?entity ?name ?type ?relationship
          WHERE {
            {
              <%s> om:upstream+ ?entity .
              BIND("upstream" as ?relationship)
            } UNION {
              <%s> om:downstream+ ?entity .
              BIND("downstream" as ?relationship)
            }
            ?entity om:name ?name .
            ?entity a ?type .
          }
          ORDER BY ?relationship ?name
          """,
          entityUri, entityUri);
    };
  }

  @GET
  @Path("/search/semantic")
  @Operation(
      operationId = "semanticSearch",
      summary = "Semantic search across entities",
      description = "Search for entities using semantic understanding and graph relationships",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Search results",
            content = @Content(mediaType = MediaType.APPLICATION_JSON)),
        @ApiResponse(responseCode = "400", description = "Invalid request"),
        @ApiResponse(responseCode = "503", description = "Service unavailable")
      })
  public Response semanticSearch(
      @Context SecurityContext securityContext,
      @Parameter(description = "Search query", required = true) @QueryParam("q") @NotEmpty
          String query,
      @Parameter(description = "Entity type to search", example = "table") @QueryParam("type")
          String entityType,
      @Parameter(description = "Maximum number of results", schema = @Schema(defaultValue = "10"))
          @QueryParam("limit")
          @DefaultValue("10")
          int limit) {

    if (!rdfRepository.isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("RDF repository is not enabled")
          .build();
    }

    try {
      var results = semanticSearchEngine.semanticSearch(query, entityType, limit);
      return Response.ok(results).build();
    } catch (Exception e) {
      LOG.error("Semantic search failed", e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("Search failed: " + e.getMessage())
          .build();
    }
  }

  @GET
  @Path("/search/similar/{entityType}/{id}")
  @Operation(
      operationId = "findSimilarEntities",
      summary = "Find similar entities",
      description = "Find entities similar to the given entity using semantic analysis",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Similar entities",
            content = @Content(mediaType = MediaType.APPLICATION_JSON)),
        @ApiResponse(responseCode = "404", description = "Entity not found"),
        @ApiResponse(responseCode = "503", description = "Service unavailable")
      })
  public Response findSimilar(
      @Context SecurityContext securityContext,
      @Parameter(description = "Entity type", required = true) @PathParam("entityType")
          String entityType,
      @Parameter(description = "Entity ID", required = true) @PathParam("id") UUID id,
      @Parameter(description = "Maximum number of results", schema = @Schema(defaultValue = "10"))
          @QueryParam("limit")
          @DefaultValue("10")
          int limit) {

    if (!rdfRepository.isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("RDF repository is not enabled")
          .build();
    }

    try {
      var results = semanticSearchEngine.findSimilarEntities(id.toString(), entityType, limit);
      return Response.ok(results).build();
    } catch (Exception e) {
      LOG.error("Similar entity search failed", e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("Search failed: " + e.getMessage())
          .build();
    }
  }

  @GET
  @Path("/search/recommendations/{userId}")
  @Operation(
      operationId = "getRecommendations",
      summary = "Get personalized recommendations",
      description = "Get entity recommendations based on user's interaction history",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Recommended entities",
            content = @Content(mediaType = MediaType.APPLICATION_JSON)),
        @ApiResponse(responseCode = "404", description = "User not found"),
        @ApiResponse(responseCode = "503", description = "Service unavailable")
      })
  public Response getRecommendations(
      @Context SecurityContext securityContext,
      @Parameter(description = "User ID", required = true) @PathParam("userId") UUID userId,
      @Parameter(description = "Entity type for recommendations") @QueryParam("type")
          String entityType,
      @Parameter(description = "Maximum number of results", schema = @Schema(defaultValue = "10"))
          @QueryParam("limit")
          @DefaultValue("10")
          int limit) {

    if (!rdfRepository.isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("RDF repository is not enabled")
          .build();
    }

    try {
      var results = semanticSearchEngine.getRecommendations(userId.toString(), entityType, limit);
      return Response.ok(results).build();
    } catch (Exception e) {
      LOG.error("Recommendation generation failed", e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("Recommendation failed: " + e.getMessage())
          .build();
    }
  }
}
