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
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.validation.constraints.NotEmpty;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RDFFormat;
import org.apache.jena.shacl.ValidationReport;
import org.apache.jena.update.UpdateFactory;
import org.openmetadata.schema.api.configuration.rdf.CustomOntology;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.rdf.RdfIriValidator;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.extension.CustomOntologyRegistry;
import org.openmetadata.service.rdf.extension.CustomOntologyValidator;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;
import org.openmetadata.service.rdf.inference.InferenceRuleRegistry;
import org.openmetadata.service.rdf.inference.InferenceRuleValidator;
import org.openmetadata.service.rdf.insights.CentralityComputation;
import org.openmetadata.service.rdf.insights.CoOccurrenceQueryBuilder;
import org.openmetadata.service.rdf.insights.CommunityComputation;
import org.openmetadata.service.rdf.insights.ImportanceQueryBuilder;
import org.openmetadata.service.rdf.insights.LineagePathBuilder;
import org.openmetadata.service.rdf.insights.LineagePathFinder;
import org.openmetadata.service.rdf.insights.RecommendationsQueryBuilder;
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
  private static final int MIN_GRAPH_DEPTH = 1;
  private static final int MAX_GRAPH_DEPTH = 5;
  private volatile RdfRepository rdfRepository;
  private final Authorizer authorizer;
  private volatile SemanticSearchEngine semanticSearchEngine;
  private volatile SparqlFederationGuard federationGuard;
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
  }

  private RdfRepository getRdfRepository() {
    if (rdfRepository == null) {
      rdfRepository = RdfRepository.getInstanceOrNull();
    }
    return rdfRepository;
  }

  private SemanticSearchEngine getSemanticSearchEngine() {
    SemanticSearchEngine local = semanticSearchEngine;
    if (local == null) {
      synchronized (this) {
        local = semanticSearchEngine;
        if (local == null && getRdfRepository() != null) {
          local = new SemanticSearchEngine(getRdfRepository(), Entity.getSearchRepository());
          semanticSearchEngine = local;
        }
      }
    }
    return local;
  }

  public void initialize(OpenMetadataApplicationConfig config) {
    this.config = config;
    // Check if RDF is enabled
    if (config.getRdfConfiguration() == null
        || !Boolean.TRUE.equals(config.getRdfConfiguration().getEnabled())) {
      LOG.info("RDF support is disabled in configuration");
    }
    this.federationGuard = new SparqlFederationGuard(config.getRdfConfiguration());
  }

  private synchronized SparqlFederationGuard getFederationGuard() {
    if (federationGuard == null) {
      // Tests or restarted resource without initialize(); default to closed allowlist.
      federationGuard = new SparqlFederationGuard(null);
    }
    return federationGuard;
  }

  @GET
  @Path("/status")
  @Operation(
      operationId = "getRdfStatus",
      summary = "Get RDF service status",
      description = "Check RDF service status including inference configuration",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "RDF service status with inference information",
            content = @Content(mediaType = MediaType.APPLICATION_JSON))
      })
  public Response getRdfStatus(@Context SecurityContext securityContext) {
    authorizer.authorizeAdmin(securityContext);
    boolean enabled = getRdfRepository() != null && getRdfRepository().isEnabled();
    boolean inferenceEnabled = enabled && getRdfRepository().isInferenceEnabledByDefault();
    String defaultInferenceLevel = enabled ? getRdfRepository().getDefaultInferenceLevel() : "NONE";

    String statusJson =
        String.format(
            """
            {
              "enabled": %s,
              "inference": {
                "enabled": %s,
                "defaultLevel": "%s",
                "availableLevels": ["NONE", "RDFS", "OWL_LITE", "OWL_DL", "CUSTOM"]
              },
              "storageType": "%s"
            }
            """,
            enabled,
            inferenceEnabled,
            defaultInferenceLevel,
            enabled ? getRdfRepository().getConfig().getStorageType() : "N/A");

    return Response.ok().entity(statusJson).type(MediaType.APPLICATION_JSON).build();
  }

  @POST
  @Path("/validate")
  @Produces({TURTLE, JSON_LD, MediaType.APPLICATION_JSON})
  @Operation(
      operationId = "validateGraph",
      summary = "Run SHACL validation against the OpenMetadata knowledge graph",
      description =
          "Loads the canonical SHACL shapes (rdf/shapes/openmetadata-shapes.ttl) and validates either a single entity's subgraph or the entire dataset against them. The endpoint reports violations; it does not mutate the graph or block writes.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description =
                "SHACL validation report (sh:ValidationReport). Conforms field is true when there are no violations.",
            content = {@Content(mediaType = TURTLE), @Content(mediaType = JSON_LD)}),
        @ApiResponse(responseCode = "503", description = "RDF service not enabled")
      })
  public Response validateGraph(
      @Context SecurityContext securityContext,
      @Parameter(
              description =
                  "Optional. Full URI of the entity to scope the validation to (DESCRIBE <uri>). Omit to validate the whole dataset (admin-only, expensive).")
          @QueryParam("entityUri")
          String entityUri,
      @Parameter(description = "Report serialization: turtle (default) or jsonld")
          @QueryParam("format")
          @DefaultValue("turtle")
          String format) {
    authorizer.authorizeAdmin(securityContext);
    if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("{\"error\": \"RDF service not enabled\"}")
          .type(MediaType.APPLICATION_JSON)
          .build();
    }

    String constructQuery;
    if (entityUri != null && !entityUri.isBlank()) {
      String validated = RdfIriValidator.validateEntityIri(entityUri);
      if (validated == null) {
        return Response.status(Response.Status.BAD_REQUEST)
            .entity(buildErrorResponse("entityUri must be an absolute http(s) IRI"))
            .type(MediaType.APPLICATION_JSON)
            .build();
      }
      constructQuery = String.format("DESCRIBE <%s>", validated);
    } else {
      constructQuery = "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }";
    }

    String dataTurtle = getRdfRepository().executeSparqlQueryDirect(constructQuery, "text/turtle");
    Model dataModel = ModelFactory.createDefaultModel();
    try (StringReader reader = new StringReader(dataTurtle)) {
      RDFDataMgr.read(dataModel, reader, getRdfRepository().getBaseUri(), Lang.TURTLE);
    } catch (Exception e) {
      LOG.error("Failed to parse subgraph for SHACL validation", e);
      return Response.serverError()
          .entity("{\"error\": \"failed to load subgraph for validation\"}")
          .type(MediaType.APPLICATION_JSON)
          .build();
    }

    ValidationReport report = RdfShaclValidator.validate(dataModel);

    RDFFormat rdfFormat =
        "jsonld".equalsIgnoreCase(format) ? RDFFormat.JSONLD_PRETTY : RDFFormat.TURTLE_PRETTY;
    String responseMediaType = "jsonld".equalsIgnoreCase(format) ? JSON_LD : TURTLE;

    ByteArrayOutputStream out = new ByteArrayOutputStream();
    RDFDataMgr.write(out, report.getModel(), rdfFormat);
    return Response.ok(out.toString(StandardCharsets.UTF_8))
        .type(responseMediaType)
        .header("OM-SHACL-Conforms", String.valueOf(report.conforms()))
        .build();
  }

  @GET
  @Path("/rules")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "listInferenceRules",
      summary = "List loaded inference rules",
      description =
          "Returns all inference rules loaded into this server, in execution order (priority then name). Includes the shipped starter pack plus any rules that have been upserted at runtime.",
      responses = {
        @ApiResponse(responseCode = "200", description = "List of inference rules"),
        @ApiResponse(responseCode = "403", description = "Forbidden")
      })
  public Response listInferenceRules(@Context SecurityContext securityContext) {
    authorizer.authorizeAdmin(securityContext);
    List<InferenceRule> rules = InferenceRuleRegistry.getInstance().list();
    return Response.ok(JsonUtils.pojoToJson(Map.of("rules", rules))).build();
  }

  @GET
  @Path("/rules/{name}")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "getInferenceRule",
      summary = "Get a single inference rule by name",
      responses = {
        @ApiResponse(responseCode = "200", description = "The rule"),
        @ApiResponse(responseCode = "403", description = "Forbidden"),
        @ApiResponse(responseCode = "404", description = "Rule not found")
      })
  public Response getInferenceRule(
      @Context SecurityContext securityContext, @PathParam("name") String name) {
    authorizer.authorizeAdmin(securityContext);
    return InferenceRuleRegistry.getInstance()
        .get(name)
        .map(rule -> Response.ok(JsonUtils.pojoToJson(rule)).build())
        .orElse(
            Response.status(Response.Status.NOT_FOUND)
                .entity(buildErrorResponse("Inference rule not found: " + name))
                .type(MediaType.APPLICATION_JSON)
                .build());
  }

  @GET
  @Path("/insights/important")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "listImportantEntities",
      summary = "Rank entities by an importance score that blends usage data and lineage topology",
      description =
          "Returns the top-N entities of the given type ranked by a composite importance score. The score blends OpenMetadata's existing usage percentile (real query data — 0.6 weight) with downstream lineage edge count (graph topology — 0.4 weight). Once Phase 3.1.b ships, an om:centralityScore from PageRank will fill in for entities that have no query usage data. Results are SPARQL JSON.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description =
                "Ranked list of entities with usage percentile, downstream count, and composite score"),
        @ApiResponse(responseCode = "400", description = "Invalid entityType, window, or limit"),
        @ApiResponse(responseCode = "503", description = "RDF service not enabled")
      })
  public Response listImportantEntities(
      @Context SecurityContext securityContext,
      @Parameter(
              description =
                  "Entity type to rank (singular: table, dashboard, pipeline, mlmodel, ...). Required.",
              required = true)
          @QueryParam("entityType")
          @NotEmpty
          String entityType,
      @Parameter(description = "Usage window: daily, weekly, or monthly. Defaults to daily.")
          @QueryParam("window")
          @DefaultValue("daily")
          String window,
      @Parameter(description = "Number of results. 1–100, defaults to 20.")
          @QueryParam("limit")
          @DefaultValue("20")
          int limit) {
    authorizer.authorizeAdmin(securityContext);
    if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity(buildErrorResponse("RDF repository is not enabled"))
          .type(MediaType.APPLICATION_JSON)
          .build();
    }
    String sparql;
    try {
      sparql = ImportanceQueryBuilder.build(entityType, window, limit);
    } catch (IllegalArgumentException e) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity(buildErrorResponse(e.getMessage()))
          .type(MediaType.APPLICATION_JSON)
          .build();
    }
    return executeSparqlQuery(sparql, "json", "none");
  }

  @POST
  @Path("/insights/recompute-centrality")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "recomputeCentrality",
      summary = "Run weighted PageRank on the entity graph and persist scores",
      description =
          "Triggers Phase 3.1.b's centrality computation: walks lineage / tagging / containment edges of the requested entity type, runs weighted PageRank, and writes the results to the named graph <om:insights/centrality/{entityType}>. The /v1/rdf/insights/important endpoint blends these scores in for entities without query usage data. Admin-only; expensive — designed to run on a schedule, but exposed for manual triggering.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Centrality computation result"),
        @ApiResponse(responseCode = "400", description = "Invalid entityType"),
        @ApiResponse(responseCode = "503", description = "RDF service not enabled")
      })
  public Response recomputeCentrality(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Entity type to score (e.g. table, dashboard, pipeline). Required.",
              required = true)
          @QueryParam("entityType")
          @NotEmpty
          String entityType) {
    authorizer.authorizeAdmin(securityContext);
    if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity(buildErrorResponse("RDF repository is not enabled"))
          .type(MediaType.APPLICATION_JSON)
          .build();
    }
    try {
      CentralityComputation.Result result =
          new CentralityComputation(getRdfRepository()).computeAndPersist(entityType);
      return Response.ok(JsonUtils.pojoToJson(result)).build();
    } catch (IllegalArgumentException e) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity(buildErrorResponse(e.getMessage()))
          .type(MediaType.APPLICATION_JSON)
          .build();
    }
  }

  @POST
  @Path("/insights/recompute-communities")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "recomputeCommunities",
      summary = "Run Louvain community detection and persist communities",
      description =
          "Phase 3.2: extracts the lineage or tag-co-occurrence graph for the requested entity type, runs Louvain modularity optimization, and persists communities to the named graph <om:insights/communities/{graphType}/{entityType}>. Each community is an om:Community resource with om:hasMember triples and modularity score. Admin-only; designed to be triggered on a schedule.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Community detection result"),
        @ApiResponse(responseCode = "400", description = "Invalid entityType or graphType"),
        @ApiResponse(responseCode = "503", description = "RDF service not enabled")
      })
  public Response recomputeCommunities(
      @Context SecurityContext securityContext,
      @Parameter(description = "Entity type to cluster (e.g. table, dashboard).", required = true)
          @QueryParam("entityType")
          @NotEmpty
          String entityType,
      @Parameter(description = "Source graph: lineage (default) or tagCoOccurrence.")
          @QueryParam("graphType")
          @DefaultValue("lineage")
          String graphType) {
    authorizer.authorizeAdmin(securityContext);
    if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity(buildErrorResponse("RDF repository is not enabled"))
          .type(MediaType.APPLICATION_JSON)
          .build();
    }
    try {
      CommunityComputation.Result result =
          new CommunityComputation(getRdfRepository()).computeAndPersist(entityType, graphType);
      return Response.ok(JsonUtils.pojoToJson(result)).build();
    } catch (IllegalArgumentException e) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity(buildErrorResponse(e.getMessage()))
          .type(MediaType.APPLICATION_JSON)
          .build();
    }
  }

  @GET
  @Path("/insights/communities")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "listCommunities",
      summary = "List communities discovered by the latest community-detection run",
      description =
          "Returns a SPARQL SELECT JSON document with rows of (community, size, modularity, member) for the named graph populated by /insights/recompute-communities. Communities are ordered by size descending; one row per (community, member) pair so the caller can group as needed.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Communities + members"),
        @ApiResponse(responseCode = "400", description = "Invalid entityType or graphType"),
        @ApiResponse(responseCode = "503", description = "RDF service not enabled")
      })
  public Response listCommunities(
      @Context SecurityContext securityContext,
      @Parameter(description = "Entity type whose community partition you want.", required = true)
          @QueryParam("entityType")
          @NotEmpty
          String entityType,
      @Parameter(description = "Source graph: lineage (default) or tagCoOccurrence.")
          @QueryParam("graphType")
          @DefaultValue("lineage")
          String graphType) {
    authorizer.authorizeAdmin(securityContext);
    if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity(buildErrorResponse("RDF repository is not enabled"))
          .type(MediaType.APPLICATION_JSON)
          .build();
    }
    String sparql;
    try {
      sparql = CommunityComputation.listingSparql(entityType, graphType);
    } catch (IllegalArgumentException e) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity(buildErrorResponse(e.getMessage()))
          .type(MediaType.APPLICATION_JSON)
          .build();
    }
    return executeSparqlQuery(sparql, "json", "none");
  }

  @GET
  @Path("/insights/path")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "findLineagePath",
      summary = "Find the shortest lineage path between two entities",
      description =
          "BFS over the lineage graph (prov:wasDerivedFrom, om:upstream, om:downstream) returning the shortest path between two URIs. Use direction=upstream to walk from entity to its sources, downstream to walk to derived entities, both for either. Each hop returns the URI, the predicate that connected it, and any om:* rdf:type values. Useful for explain-lineage UIs and impact-analysis tooling.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Path between the two entities (or found=false)"),
        @ApiResponse(
            responseCode = "400",
            description = "Invalid from/to URI, direction, or maxHops"),
        @ApiResponse(responseCode = "503", description = "RDF service not enabled")
      })
  public Response findLineagePath(
      @Context SecurityContext securityContext,
      @Parameter(description = "Starting entity URI (absolute http(s)).", required = true)
          @QueryParam("from")
          @NotEmpty
          String from,
      @Parameter(description = "Target entity URI (absolute http(s)).", required = true)
          @QueryParam("to")
          @NotEmpty
          String to,
      @Parameter(description = "Walk direction: upstream (default), downstream, or both.")
          @QueryParam("direction")
          @DefaultValue("upstream")
          String direction,
      @Parameter(description = "Max hops to explore. 1–25, defaults to 6.") @QueryParam("maxHops")
          Integer maxHops) {
    authorizer.authorizeAdmin(securityContext);
    if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity(buildErrorResponse("RDF repository is not enabled"))
          .type(MediaType.APPLICATION_JSON)
          .build();
    }
    try {
      LineagePathBuilder.Direction dir = LineagePathBuilder.Direction.parse(direction);
      LineagePathFinder.Path path =
          new LineagePathFinder(getRdfRepository()).findPath(from, to, dir, maxHops);
      return Response.ok(JsonUtils.pojoToJson(path)).build();
    } catch (IllegalArgumentException e) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity(buildErrorResponse(e.getMessage()))
          .type(MediaType.APPLICATION_JSON)
          .build();
    }
  }

  @GET
  @Path("/insights/recommendations")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "datasetRecommendations",
      summary = "Recommend related entities for a given seed URI",
      description =
          "Phase 3.4: ranks every other entity by graph-topology similarity to the given seed — overlap on tags, glossary terms, and direct lineage neighbours. Pure SPARQL, no precomputation. Score formula: 1.0 · tagOverlap + 1.5 · glossaryOverlap + 2.0 · lineageOverlap.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Ranked recommendations"),
        @ApiResponse(responseCode = "400", description = "Invalid entityUri or limit"),
        @ApiResponse(responseCode = "503", description = "RDF service not enabled")
      })
  public Response datasetRecommendations(
      @Context SecurityContext securityContext,
      @Parameter(description = "Seed entity URI (absolute http(s)).", required = true)
          @QueryParam("entityUri")
          @NotEmpty
          String entityUri,
      @Parameter(description = "Number of recommendations. 1–50, default 10.")
          @QueryParam("limit")
          @DefaultValue("10")
          int limit) {
    authorizer.authorizeAdmin(securityContext);
    if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity(buildErrorResponse("RDF repository is not enabled"))
          .type(MediaType.APPLICATION_JSON)
          .build();
    }
    String sparql;
    try {
      sparql = RecommendationsQueryBuilder.build(entityUri, limit);
    } catch (IllegalArgumentException e) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity(buildErrorResponse(e.getMessage()))
          .type(MediaType.APPLICATION_JSON)
          .build();
    }
    return executeSparqlQuery(sparql, "json", "none");
  }

  @GET
  @Path("/insights/tag-cooccurrence")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "tagCoOccurrence",
      summary = "Pairs of tags applied to the same entities",
      description =
          "Phase 3.5: returns pairs of tags that appear together on the same entity, sorted by overlap count descending. Surfaces governance signals like 'PII and Confidential are almost always co-applied'. Pure SPARQL aggregate over om:hasTag — no precomputation required.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Tag pair counts"),
        @ApiResponse(responseCode = "503", description = "RDF service not enabled")
      })
  public Response tagCoOccurrence(
      @Context SecurityContext securityContext,
      @Parameter(description = "Minimum number of shared entities. 1+, default 2.")
          @QueryParam("minCount")
          @DefaultValue("2")
          int minCount,
      @Parameter(description = "Number of pairs to return. 1–100, default 20.")
          @QueryParam("limit")
          @DefaultValue("20")
          int limit) {
    authorizer.authorizeAdmin(securityContext);
    if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity(buildErrorResponse("RDF repository is not enabled"))
          .type(MediaType.APPLICATION_JSON)
          .build();
    }
    return executeSparqlQuery(
        CoOccurrenceQueryBuilder.tagCoOccurrence(minCount, limit), "json", "none");
  }

  @GET
  @Path("/insights/glossary-reach")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "glossaryReach",
      summary = "Glossary terms ranked by domain reach",
      description =
          "Phase 3.5: returns glossary terms ordered by the number of distinct domains in which they're used, surfacing the most cross-cutting concepts. Pure SPARQL aggregate over om:hasGlossaryTerm × om:hasDomain.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Term reach counts"),
        @ApiResponse(responseCode = "503", description = "RDF service not enabled")
      })
  public Response glossaryReach(
      @Context SecurityContext securityContext,
      @Parameter(description = "Minimum number of domains. 1+, default 2.")
          @QueryParam("minDomains")
          @DefaultValue("2")
          int minDomains,
      @Parameter(description = "Number of terms to return. 1–100, default 20.")
          @QueryParam("limit")
          @DefaultValue("20")
          int limit) {
    authorizer.authorizeAdmin(securityContext);
    if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity(buildErrorResponse("RDF repository is not enabled"))
          .type(MediaType.APPLICATION_JSON)
          .build();
    }
    return executeSparqlQuery(
        CoOccurrenceQueryBuilder.glossaryReach(minDomains, limit), "json", "none");
  }

  @GET
  @Path("/insights/tag-popularity")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "tagPopularity",
      summary = "Tags ranked by number of tagged entities",
      description =
          "Phase 3.5: returns tags ordered by the number of distinct entities they're applied to. Companion to /insights/tag-cooccurrence — useful for triaging tag taxonomy bloat.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Tag entity counts"),
        @ApiResponse(responseCode = "503", description = "RDF service not enabled")
      })
  public Response tagPopularity(
      @Context SecurityContext securityContext,
      @Parameter(description = "Number of tags to return. 1–100, default 20.")
          @QueryParam("limit")
          @DefaultValue("20")
          int limit) {
    authorizer.authorizeAdmin(securityContext);
    if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity(buildErrorResponse("RDF repository is not enabled"))
          .type(MediaType.APPLICATION_JSON)
          .build();
    }
    return executeSparqlQuery(CoOccurrenceQueryBuilder.tagPopularity(limit), "json", "none");
  }

  @GET
  @Path("/ontology/extensions")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "listCustomOntologyExtensions",
      summary = "List user-authored ontology extensions",
      description =
          "Returns every ontology extension registered with this server. Each extension is a bundle of custom OWL classes and properties under the om-extension namespace.",
      responses = {@ApiResponse(responseCode = "200", description = "Extension list")})
  public Response listCustomOntologyExtensions(@Context SecurityContext securityContext) {
    authorizer.authorizeAdmin(securityContext);
    return Response.ok(
            JsonUtils.pojoToJson(Map.of("extensions", CustomOntologyRegistry.getInstance().list())))
        .build();
  }

  @GET
  @Path("/ontology/extensions/{name}")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "getCustomOntologyExtension",
      summary = "Get a single custom ontology extension by name",
      responses = {
        @ApiResponse(responseCode = "200", description = "The extension"),
        @ApiResponse(responseCode = "404", description = "Extension not found")
      })
  public Response getCustomOntologyExtension(
      @Context SecurityContext securityContext, @PathParam("name") String name) {
    authorizer.authorizeAdmin(securityContext);
    return CustomOntologyRegistry.getInstance()
        .get(name)
        .map(ext -> Response.ok(JsonUtils.pojoToJson(ext)).build())
        .orElse(
            Response.status(Response.Status.NOT_FOUND)
                .entity(buildErrorResponse("Custom ontology extension not found: " + name))
                .type(MediaType.APPLICATION_JSON)
                .build());
  }

  @POST
  @Path("/ontology/extensions/validate")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "validateCustomOntologyExtension",
      summary = "Validate a candidate ontology extension without persisting it",
      description =
          "Runs the same validator that admin writes are gated on (URIs in om-extension namespace, no redefinition of canonical classes, no cycles, valid domain/range references) and returns the list of errors.",
      responses = {@ApiResponse(responseCode = "200", description = "Validation result")})
  public Response validateCustomOntologyExtension(
      @Context SecurityContext securityContext, CustomOntology candidate) {
    authorizer.authorizeAdmin(securityContext);
    List<String> errors = CustomOntologyValidator.validate(candidate);
    Map<String, Object> body = new java.util.LinkedHashMap<>();
    body.put("valid", errors.isEmpty());
    body.put("errors", errors);
    return Response.ok(JsonUtils.pojoToJson(body)).build();
  }

  @POST
  @Path("/rules/validate")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "validateInferenceRule",
      summary = "Validate a candidate inference rule without persisting it",
      description =
          "Runs the same validator that admin writes are gated on (CONSTRUCT-only, no SERVICE clauses, syntactically well-formed) and returns the list of errors. Useful for an admin UI that wants live feedback while editing a rule.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Validation result"),
        @ApiResponse(responseCode = "403", description = "Forbidden")
      })
  public Response validateInferenceRule(
      @Context SecurityContext securityContext, InferenceRule candidate) {
    authorizer.authorizeAdmin(securityContext);
    List<String> errors = InferenceRuleValidator.validate(candidate);
    Map<String, Object> body = new java.util.LinkedHashMap<>();
    body.put("valid", errors.isEmpty());
    body.put("errors", errors);
    return Response.ok(JsonUtils.pojoToJson(body)).build();
  }

  @GET
  @Path("/ontology")
  @Produces({TURTLE, RDF_XML, N_TRIPLES, JSON_LD, MediaType.WILDCARD})
  @Operation(
      operationId = "getOntology",
      summary = "Download the OpenMetadata ontology",
      description =
          "Returns the canonical OpenMetadata OWL ontology and its PROV-aligned extension as a single document. The ontology imports DCAT, PROV-O, and SKOS by reference. Format is selected via the Accept header or the format query param: turtle (default), rdfxml, ntriples, jsonld.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Ontology document in the requested serialization",
            content = {
              @Content(mediaType = TURTLE),
              @Content(mediaType = RDF_XML),
              @Content(mediaType = N_TRIPLES),
              @Content(mediaType = JSON_LD)
            }),
        @ApiResponse(responseCode = "500", description = "Ontology resource missing or unreadable")
      })
  public Response getOntology(
      @Parameter(
              description =
                  "Output serialization. One of: turtle, rdfxml, ntriples, jsonld. Defaults to turtle.")
          @QueryParam("format")
          @DefaultValue("turtle")
          String format) {
    return OntologyDocument.serve(format);
  }

  @GET
  @Path("/debug/glossary-relations")
  @Operation(
      operationId = "debugGlossaryRelations",
      summary = "Debug glossary term relations in RDF",
      description =
          "Diagnostic endpoint to inspect what predicates are stored between glossary terms in the RDF store",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Debug information about glossary term relations",
            content = @Content(mediaType = MediaType.APPLICATION_JSON)),
        @ApiResponse(responseCode = "503", description = "RDF service not enabled")
      })
  public Response debugGlossaryRelations(@Context SecurityContext securityContext) {
    authorizer.authorizeAdmin(securityContext);
    if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("{\"error\": \"RDF service not enabled\"}")
          .build();
    }

    String result = getRdfRepository().debugGlossaryTermRelations();
    return Response.ok(result, MediaType.APPLICATION_JSON).build();
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
    authorizer.authorizeAdmin(securityContext);
    try {
      if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
        return Response.status(Response.Status.SERVICE_UNAVAILABLE)
            .entity("{\"error\": \"RDF service not enabled\"}")
            .build();
      }

      String result;
      MediaType mediaType =
          switch (format.toLowerCase()) {
            case "turtle", "ttl" -> {
              result = getRdfRepository().getEntityAsRdf(entityType, id, "turtle");
              yield MediaType.valueOf(TURTLE);
            }
            case "rdfxml", "xml" -> {
              result = getRdfRepository().getEntityAsRdf(entityType, id, "rdfxml");
              yield MediaType.valueOf(RDF_XML);
            }
            case "ntriples", "nt" -> {
              result = getRdfRepository().getEntityAsRdf(entityType, id, "ntriples");
              yield MediaType.valueOf(N_TRIPLES);
            }
            default -> {
              result = getRdfRepository().getEntityAsJsonLd(entityType, id);
              yield MediaType.valueOf(JSON_LD);
            }
          };

      return Response.ok(result, mediaType).build();

    } catch (IOException e) {
      LOG.error("Error retrieving entity as RDF", e);
      return Response.serverError().entity("{\"error\": \"An internal error occurred\"}").build();
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
          int depth,
      @Parameter(description = "Comma-separated entity types to keep in the graph")
          @QueryParam("entityTypes")
          String entityTypes,
      @Parameter(description = "Comma-separated relationship types to keep in the graph")
          @QueryParam("relationshipTypes")
          String relationshipTypes) {
    // Admin-only by design: graph node hydration (RdfRepository.getEntityGraph)
    // resolves entity details with Include.ALL and does NOT re-apply the
    // caller's per-entity view authorization. Relaxing this to non-admins would
    // require RBAC-aware filtering of the returned nodes/edges first, otherwise
    // the graph could leak entities the caller cannot otherwise see.
    authorizer.authorizeAdmin(securityContext);
    try {
      String validatedEntityType = validateEntityType(entityType);
      int clampedDepth = clampGraphDepth(depth);
      if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
        return Response.status(Response.Status.SERVICE_UNAVAILABLE)
            .entity(buildErrorResponse("RDF service not enabled"))
            .build();
      }

      String graphData =
          getRdfRepository()
              .getEntityGraph(
                  entityId,
                  validatedEntityType,
                  clampedDepth,
                  parseCsvFilter(entityTypes),
                  parseCsvFilter(relationshipTypes));
      return Response.ok(graphData, MediaType.APPLICATION_JSON).build();
    } catch (IllegalArgumentException e) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity(buildErrorResponse(e.getMessage()))
          .build();
    } catch (Exception e) {
      LOG.error("Error exploring entity graph", e);
      return Response.serverError()
          .entity(buildErrorResponse("An internal error occurred"))
          .build();
    }
  }

  @GET
  @Path("/graph/explore/export")
  @Produces({JSON_LD, TURTLE, MediaType.APPLICATION_JSON})
  @Operation(
      operationId = "exportEntityGraph",
      summary = "Export explored entity graph",
      description = "Export the currently explored entity graph in Turtle or JSON-LD format",
      responses = {
        @ApiResponse(responseCode = "200", description = "Entity graph exported successfully"),
        @ApiResponse(responseCode = "400", description = "Invalid request"),
        @ApiResponse(responseCode = "503", description = "RDF service not enabled")
      })
  public Response exportEntityGraph(
      @Context SecurityContext securityContext,
      @Parameter(description = "Entity ID", required = true) @QueryParam("entityId") UUID entityId,
      @Parameter(description = "Entity type", required = true) @QueryParam("entityType")
          String entityType,
      @Parameter(description = "Depth of relationships to explore")
          @QueryParam("depth")
          @DefaultValue("2")
          int depth,
      @Parameter(description = "Comma-separated entity types to keep in the graph")
          @QueryParam("entityTypes")
          String entityTypes,
      @Parameter(description = "Comma-separated relationship types to keep in the graph")
          @QueryParam("relationshipTypes")
          String relationshipTypes,
      @Parameter(description = "Export format: turtle or jsonld")
          @QueryParam("format")
          @DefaultValue("turtle")
          String format) {
    authorizer.authorizeAdmin(securityContext);
    try {
      String validatedEntityType = validateEntityType(entityType);
      int clampedDepth = clampGraphDepth(depth);
      String normalizedFormat = RdfRepository.normalizeEntityGraphExportFormat(format);
      if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
        return Response.status(Response.Status.SERVICE_UNAVAILABLE)
            .entity(buildErrorResponse("RDF service not enabled"))
            .build();
      }

      String result =
          getRdfRepository()
              .exportEntityGraph(
                  entityId,
                  validatedEntityType,
                  clampedDepth,
                  parseCsvFilter(entityTypes),
                  parseCsvFilter(relationshipTypes),
                  normalizedFormat);

      MediaType mediaType =
          switch (normalizedFormat) {
            case "JSON-LD" -> MediaType.valueOf(JSON_LD);
            default -> MediaType.valueOf(TURTLE);
          };

      return Response.ok(result, mediaType).build();
    } catch (IllegalArgumentException e) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity(buildErrorResponse(e.getMessage()))
          .build();
    } catch (Exception e) {
      LOG.error("Error exporting entity graph", e);
      return Response.serverError()
          .entity(buildErrorResponse("An internal error occurred"))
          .build();
    }
  }

  private String validateEntityType(String entityType) {
    if (entityType == null || entityType.isBlank()) {
      throw new IllegalArgumentException("Entity type is required");
    }

    String trimmedEntityType = entityType.trim();
    if (!trimmedEntityType.matches("[A-Za-z][A-Za-z0-9]*")
        || !Entity.hasEntityRepository(trimmedEntityType)) {
      throw new IllegalArgumentException("Invalid entity type");
    }

    return trimmedEntityType;
  }

  private String buildErrorResponse(String message) {
    return JsonUtils.pojoToJson(Map.of("error", message));
  }

  static int clampGraphDepth(int depth) {
    return Math.min(Math.max(depth, MIN_GRAPH_DEPTH), MAX_GRAPH_DEPTH);
  }

  private Set<String> parseCsvFilter(String values) {
    if (values == null || values.isBlank()) {
      return Set.of();
    }

    return Arrays.stream(values.split(","))
        .map(String::trim)
        .filter(value -> !value.isEmpty())
        .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
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
      @Context SecurityContext securityContext,
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
    authorizer.authorizeAdmin(securityContext);
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
  public Response querySparqlPost(
      @Context SecurityContext securityContext, SparqlQuery sparqlQuery) {
    authorizer.authorizeAdmin(securityContext);
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
      @Context SecurityContext securityContext,
      @Parameter(description = "SPARQL UPDATE query", required = true) SparqlQuery sparqlQuery) {
    authorizer.authorizeAdmin(securityContext);
    if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("RDF repository is not enabled")
          .build();
    }

    String query = sparqlQuery.getQuery();
    if (query == null || query.isBlank()) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity(buildErrorResponse("SPARQL update body is required"))
          .type(MediaType.APPLICATION_JSON)
          .build();
    }

    // Validate with Jena's parser, which understands PREFIX / BASE prologues, comments, and
    // whitespace. The prior implementation matched the first keyword as a substring after
    // upper-casing the body — that rejected legitimate updates beginning with `PREFIX …` and
    // could be bypassed by injecting whitespace or comments. UpdateFactory throws if the body
    // doesn't parse as a SPARQL UPDATE (which includes SELECT/ASK/CONSTRUCT/DESCRIBE — those
    // belong on the read endpoint).
    try {
      UpdateFactory.create(query);
    } catch (Exception e) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity(buildErrorResponse("Invalid SPARQL UPDATE: " + e.getMessage()))
          .type(MediaType.APPLICATION_JSON)
          .build();
    }

    try {
      getRdfRepository().executeSparqlUpdate(query);
      return Response.ok().entity("{\"status\": \"success\"}").build();
    } catch (Exception e) {
      LOG.error("Error executing SPARQL update", e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("{\"error\": \"An internal error occurred\"}")
          .build();
    }
  }

  private Response executeSparqlQuery(String query, String format, String inference) {
    if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("RDF repository is not enabled")
          .build();
    }

    try {
      getFederationGuard().enforce(query);
    } catch (SparqlFederationGuard.FederationDisallowedException e) {
      LOG.warn("Rejected SPARQL with disallowed SERVICE clause: {}", e.getBlockedEndpoint());
      return Response.status(Response.Status.FORBIDDEN)
          .entity(buildErrorResponse(e.getMessage()))
          .type(MediaType.APPLICATION_JSON)
          .build();
    }

    try {
      String mimeType = getMimeTypeForFormat(format);
      String results;
      if (!"none".equalsIgnoreCase(inference)) {
        results = getRdfRepository().executeSparqlQueryWithInference(query, mimeType, inference);
      } else {
        results = getRdfRepository().executeSparqlQuery(query, mimeType);
      }
      return Response.ok(results).type(mimeType).build();
    } catch (IllegalArgumentException e) {
      LOG.error("Invalid SPARQL query: {}", query, e);
      return Response.status(Response.Status.BAD_REQUEST)
          .entity("{\"error\": \"Invalid SPARQL query\"}")
          .build();
    } catch (Exception e) {
      LOG.error("Error executing SPARQL query", e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("{\"error\": \"An internal error occurred\"}")
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
      @Context SecurityContext securityContext,
      @Parameter(description = "Entity ID", required = true) @PathParam("entityId") UUID entityId,
      @Parameter(description = "Entity type", required = true) @QueryParam("entityType")
          String entityType,
      @Parameter(
              description = "Direction (upstream, downstream, both)",
              schema = @Schema(defaultValue = "both"))
          @QueryParam("direction")
          @DefaultValue("both")
          String direction) {
    authorizer.authorizeAdmin(securityContext);
    try {
      String validatedEntityType = validateEntityType(entityType);
      if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
        return Response.status(Response.Status.SERVICE_UNAVAILABLE)
            .entity(buildErrorResponse("RDF service not enabled"))
            .build();
      }

      String query =
          buildLineageQuery(
              entityId, validatedEntityType, direction, getRdfRepository().getBaseUri());
      String results =
          getRdfRepository().executeSparqlQueryWithInference(query, SPARQL_JSON, "custom");
      return Response.ok(results).build();
    } catch (IllegalArgumentException e) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity(buildErrorResponse(e.getMessage()))
          .build();
    } catch (Exception e) {
      LOG.error("Error getting lineage with inference", e);
      return Response.serverError()
          .entity(buildErrorResponse("An internal error occurred"))
          .build();
    }
  }

  private String buildLineageQuery(
      UUID entityId, String entityType, String direction, String baseUri) {
    String normalizedBaseUri = baseUri.endsWith("/") ? baseUri : baseUri + "/";
    String entityUri = normalizedBaseUri + "entity/" + entityType + "/" + entityId;

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
  @Path("/glossary/graph")
  @Operation(
      operationId = "getGlossaryTermGraph",
      summary = "Get glossary term relationship graph",
      description =
          "Get all glossary terms and their relationships as a graph. "
              + "Supports filtering by glossary, by a glossary term and its direct neighbors, "
              + "or by both. When both glossaryId and glossaryTermId are provided, the selected "
              + "term must belong to the glossary and direct cross-glossary neighbors can still "
              + "be returned.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Graph data with nodes and edges",
            content = @Content(mediaType = MediaType.APPLICATION_JSON)),
        @ApiResponse(responseCode = "503", description = "RDF service not enabled")
      })
  public Response getGlossaryTermGraph(
      @Context SecurityContext securityContext,
      @Parameter(description = "Filter primary terms by glossary ID (UUID)")
          @QueryParam("glossaryId")
          UUID glossaryId,
      @Parameter(
              description =
                  "Filter to a glossary term ID (UUID) and its direct incoming/outgoing neighbors")
          @QueryParam("glossaryTermId")
          UUID glossaryTermId,
      @Parameter(description = "Filter by relation types (comma-separated)")
          @QueryParam("relationTypes")
          String relationTypes,
      @Parameter(
              description = "Maximum number of terms to return",
              schema = @Schema(defaultValue = "500"))
          @QueryParam("limit")
          @DefaultValue("500")
          int limit,
      @Parameter(description = "Offset for pagination", schema = @Schema(defaultValue = "0"))
          @QueryParam("offset")
          @DefaultValue("0")
          int offset,
      @Parameter(description = "Include isolated terms (terms without relations)")
          @QueryParam("includeIsolated")
          @DefaultValue("true")
          boolean includeIsolated) {
    authorizer.authorizeAdmin(securityContext);
    try {
      if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
        return Response.status(Response.Status.SERVICE_UNAVAILABLE)
            .entity("{\"error\": \"RDF service not enabled\"}")
            .build();
      }

      String graphData =
          getRdfRepository()
              .getGlossaryTermGraph(
                  glossaryId, glossaryTermId, relationTypes, limit, offset, includeIsolated);
      return Response.ok(graphData, MediaType.APPLICATION_JSON).build();

    } catch (Exception e) {
      LOG.error("Error getting glossary term graph", e);
      return Response.serverError().entity("{\"error\": \"An internal error occurred\"}").build();
    }
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
    authorizer.authorizeAdmin(securityContext);
    if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("{\"error\": \"RDF service not enabled\"}")
          .build();
    }

    try {
      var results = getSemanticSearchEngine().semanticSearch(query, entityType, limit);
      return Response.ok(results).build();
    } catch (Exception e) {
      LOG.error("Semantic search failed", e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("{\"error\": \"An internal error occurred\"}")
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
    authorizer.authorizeAdmin(securityContext);
    if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("{\"error\": \"RDF service not enabled\"}")
          .build();
    }

    try {
      var results = getSemanticSearchEngine().findSimilarEntities(id.toString(), entityType, limit);
      return Response.ok(results).build();
    } catch (Exception e) {
      LOG.error("Similar entity search failed", e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("{\"error\": \"An internal error occurred\"}")
          .build();
    }
  }

  @GET
  @Path("/glossary/{id}/export")
  @Operation(
      operationId = "exportGlossaryAsOntology",
      summary = "Export glossary as ontology",
      description =
          "Export a glossary with all its terms and relationships as an ontology "
              + "in RDF format (Turtle, RDF/XML, N-Triples, or JSON-LD). "
              + "Includes SKOS vocabulary for semantic interoperability.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Glossary exported as ontology",
            content = {
              @Content(mediaType = TURTLE),
              @Content(mediaType = RDF_XML),
              @Content(mediaType = N_TRIPLES),
              @Content(mediaType = JSON_LD)
            }),
        @ApiResponse(responseCode = "404", description = "Glossary not found"),
        @ApiResponse(responseCode = "503", description = "RDF service not enabled")
      })
  @Produces({TURTLE, RDF_XML, N_TRIPLES, JSON_LD})
  public Response exportGlossaryAsOntology(
      @Context SecurityContext securityContext,
      @Parameter(description = "Glossary ID", required = true) @PathParam("id") UUID id,
      @Parameter(description = "RDF format (turtle, rdfxml, ntriples, jsonld)")
          @QueryParam("format")
          @DefaultValue("turtle")
          String format,
      @Parameter(description = "Include term relations")
          @QueryParam("includeRelations")
          @DefaultValue("true")
          boolean includeRelations) {
    authorizer.authorizeAdmin(securityContext);
    try {
      if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
        return Response.status(Response.Status.SERVICE_UNAVAILABLE)
            .entity("{\"error\": \"RDF service not enabled\"}")
            .build();
      }

      String result = getRdfRepository().exportGlossaryAsOntology(id, format, includeRelations);
      String mediaType =
          switch (format.toLowerCase()) {
            case "rdfxml", "xml" -> RDF_XML;
            case "ntriples", "nt" -> N_TRIPLES;
            case "jsonld", "json-ld" -> JSON_LD;
            default -> TURTLE;
          };

      String filename = "glossary-" + id + "." + getFileExtension(format);
      return Response.ok(result, mediaType)
          .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
          .build();

    } catch (Exception e) {
      LOG.error("Error exporting glossary as ontology", e);
      return Response.serverError().entity("{\"error\": \"An internal error occurred\"}").build();
    }
  }

  private String getFileExtension(String format) {
    return switch (format.toLowerCase()) {
      case "rdfxml", "xml" -> "rdf";
      case "ntriples", "nt" -> "nt";
      case "jsonld", "json-ld" -> "jsonld";
      default -> "ttl";
    };
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
    authorizer.authorizeAdmin(securityContext);
    if (getRdfRepository() == null || !getRdfRepository().isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("{\"error\": \"RDF service not enabled\"}")
          .build();
    }

    try {
      var results =
          getSemanticSearchEngine().getRecommendations(userId.toString(), entityType, limit);
      return Response.ok(results).build();
    } catch (Exception e) {
      LOG.error("Recommendation generation failed", e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("{\"error\": \"An internal error occurred\"}")
          .build();
    }
  }
}
