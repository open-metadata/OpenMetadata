package org.openmetadata.service.resources.rdf;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.InternalServerErrorException;
import jakarta.ws.rs.NotAuthorizedException;
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
import java.io.IOException;
import java.net.URI;
import java.security.Principal;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import javax.validation.constraints.NotEmpty;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.rdf.CustomOntology;
import org.openmetadata.schema.api.configuration.rdf.InferenceMaterializationResult;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleList;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleStatus;
import org.openmetadata.schema.api.data.RdfEntityDiff;
import org.openmetadata.schema.api.rdf.RdfInferenceStatus;
import org.openmetadata.schema.api.rdf.RdfProjectionState;
import org.openmetadata.schema.api.rdf.RdfStatus;
import org.openmetadata.schema.api.rdf.SavedSparqlQueries;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.schema.configuration.SparqlQuerySettings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.DocumentRepository;
import org.openmetadata.service.llm.LLMClientHolder;
import org.openmetadata.service.rdf.OntologyDocument;
import org.openmetadata.service.rdf.RdfEntityDiffService;
import org.openmetadata.service.rdf.RdfEntityTypeValidator;
import org.openmetadata.service.rdf.RdfGraphService;
import org.openmetadata.service.rdf.RdfProjectionStateResolver;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.RdfSparqlService;
import org.openmetadata.service.rdf.RdfValidationService;
import org.openmetadata.service.rdf.SavedSparqlQueryService;
import org.openmetadata.service.rdf.SavedSparqlQueryStore;
import org.openmetadata.service.rdf.SparqlQueryExecutionGuard;
import org.openmetadata.service.rdf.extension.CustomOntologyRegistry;
import org.openmetadata.service.rdf.extension.CustomOntologyValidator;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;
import org.openmetadata.service.rdf.inference.InferenceMaterializer;
import org.openmetadata.service.rdf.inference.InferenceRuleRepository;
import org.openmetadata.service.rdf.inference.InferenceRuleService;
import org.openmetadata.service.rdf.inference.InferenceRuleValidator;
import org.openmetadata.service.rdf.insights.RdfInsightsService;
import org.openmetadata.service.rdf.semantic.SemanticSearchEngine;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Path("/v1/rdf")
@Tag(name = "RDF", description = "APIs for RDF and SPARQL operations")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "rdf", order = 9)
@Slf4j
public class RdfResource {
  public static final String COLLECTION_PATH = "/v1/rdf";
  private static final String DEFAULT_RDF_BASE_URI = "https://open-metadata.org/";
  private static final SparqlQueryExecutionGuard SPARQL_EXECUTION_GUARD =
      SparqlQueryExecutionGuard.shared();
  private volatile SavedSparqlQueryStore savedSparqlQueryStore;
  private volatile InferenceRuleService inferenceRuleService;
  private final Authorizer authorizer;
  private final Supplier<RdfRepository> repositorySupplier;
  private final Supplier<RdfProjectionState> projectionStateSupplier;
  private volatile RdfEntityDiffService entityDiffService;
  private volatile SemanticSearchEngine semanticSearchEngine;
  private volatile SparqlFederationGuard federationGuard;
  private volatile boolean askCollateEnabled;
  private volatile String configuredBaseUri = DEFAULT_RDF_BASE_URI;

  public static final String RDF_XML = "application/rdf+xml";
  public static final String TURTLE = "text/turtle";
  public static final String N_TRIPLES = "application/n-triples";
  public static final String JSON_LD = "application/ld+json";
  public static final String SPARQL_JSON = "application/sparql-results+json";
  public static final String SPARQL_XML = "application/sparql-results+xml";
  public static final String SPARQL_CSV = "text/csv";
  public static final String SPARQL_TSV = "text/tab-separated-values";
  public static final String INFERENCE_WARNING_HEADER = "X-OpenMetadata-Inference-Warning";

  public RdfResource(Authorizer authorizer) {
    this(
        authorizer,
        RdfRepository::getInstanceOrNull,
        null,
        null,
        RdfResource::configuredProjectionState);
  }

  RdfResource(Authorizer authorizer, Supplier<RdfRepository> repositorySupplier) {
    this(authorizer, repositorySupplier, null, null, () -> RdfProjectionState.READY);
  }

  RdfResource(
      Authorizer authorizer,
      Supplier<RdfRepository> repositorySupplier,
      RdfEntityDiffService entityDiffService) {
    this(authorizer, repositorySupplier, entityDiffService, null, () -> RdfProjectionState.READY);
  }

  RdfResource(
      final Authorizer authorizer,
      final Supplier<RdfRepository> repositorySupplier,
      final RdfEntityDiffService entityDiffService,
      final InferenceRuleService inferenceRuleService) {
    this(
        authorizer,
        repositorySupplier,
        entityDiffService,
        inferenceRuleService,
        () -> RdfProjectionState.READY);
  }

  RdfResource(
      final Authorizer authorizer,
      final Supplier<RdfRepository> repositorySupplier,
      final RdfEntityDiffService entityDiffService,
      final InferenceRuleService inferenceRuleService,
      final Supplier<RdfProjectionState> projectionStateSupplier) {
    this.authorizer = Objects.requireNonNull(authorizer);
    this.repositorySupplier = Objects.requireNonNull(repositorySupplier);
    this.entityDiffService = entityDiffService;
    this.inferenceRuleService = inferenceRuleService;
    this.projectionStateSupplier = Objects.requireNonNull(projectionStateSupplier);
  }

  private static RdfProjectionState configuredProjectionState() {
    final RdfProjectionStateResolver resolver =
        new RdfProjectionStateResolver(Entity.getCollectionDAO().appExtensionTimeSeriesDao());
    return resolver.resolve();
  }

  private RdfRepository getRdfRepository() {
    return repositorySupplier.get();
  }

  private RdfRepository requireRdfRepository() {
    RdfRepository repository = getRdfRepository();
    if (repository == null || !repository.isEnabled()) {
      throw new ServiceUnavailableException("RDF repository is not enabled");
    }
    return repository;
  }

  private RdfInsightsService insightsService() {
    return new RdfInsightsService(requireRdfRepository());
  }

  private RdfGraphService graphService() {
    return new RdfGraphService(requireRdfRepository());
  }

  private RdfSparqlService sparqlService() {
    return new RdfSparqlService(requireRdfRepository(), getFederationGuard());
  }

  private SavedSparqlQueryStore getSavedSparqlQueryStore() {
    if (savedSparqlQueryStore == null) {
      final DocumentRepository documentRepository =
          (DocumentRepository) Entity.getEntityRepository(Entity.DOCUMENT);
      savedSparqlQueryStore = new SavedSparqlQueryStore(documentRepository);
    }
    return savedSparqlQueryStore;
  }

  private SavedSparqlQueryService savedSparqlQueryService() {
    return new SavedSparqlQueryService(getSavedSparqlQueryStore());
  }

  private InferenceRuleService inferenceRuleService() {
    InferenceRuleService local = inferenceRuleService;
    if (local == null) {
      synchronized (this) {
        local = inferenceRuleService;
        if (local == null) {
          local = createInferenceRuleService();
          inferenceRuleService = local;
        }
      }
    }
    return local;
  }

  private InferenceRuleService createInferenceRuleService() {
    final RdfRepository repository = requireRdfRepository();
    final Clock clock = Clock.systemUTC();
    final InferenceRuleRepository ruleRepository =
        new InferenceRuleRepository(
            Entity.getCollectionDAO().rdfInferenceRuleDAO(), clock, repository.getBaseUri());
    return new InferenceRuleService(
        ruleRepository, new InferenceMaterializer(repository, ruleRepository, clock));
  }

  private SemanticSearchEngine getSemanticSearchEngine() {
    RdfRepository repository = requireRdfRepository();
    SemanticSearchEngine local = semanticSearchEngine;
    if (local == null) {
      synchronized (this) {
        local = semanticSearchEngine;
        if (local == null) {
          local = new SemanticSearchEngine(repository, Entity.getSearchRepository());
          semanticSearchEngine = local;
        }
      }
    }
    return local;
  }

  public void initialize(OpenMetadataApplicationConfig config) {
    if (config.getRdfConfiguration() == null
        || !Boolean.TRUE.equals(config.getRdfConfiguration().getEnabled())) {
      LOG.info("RDF support is disabled in configuration");
    }
    this.federationGuard = new SparqlFederationGuard(config.getRdfConfiguration());
    this.configuredBaseUri = rdfBaseUri(config);
    this.entityDiffService = new RdfEntityDiffService(configuredBaseUri);
    this.askCollateEnabled =
        config.getRdfConfiguration() != null
            && Boolean.TRUE.equals(config.getRdfConfiguration().getAskCollateEnabled())
            && LLMClientHolder.isEnabled();
  }

  private static String rdfBaseUri(final OpenMetadataApplicationConfig config) {
    final String baseUri =
        config.getRdfConfiguration() == null || config.getRdfConfiguration().getBaseUri() == null
            ? DEFAULT_RDF_BASE_URI
            : config.getRdfConfiguration().getBaseUri().toString();
    return baseUri;
  }

  private RdfEntityDiffService entityDiffService() {
    return Objects.requireNonNull(
        entityDiffService, "RDF entity diff service has not been initialized");
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
    requireAuthenticatedUserName(securityContext);
    return Response.ok(rdfStatus()).build();
  }

  private RdfStatus rdfStatus() {
    final RdfRepository repository = getRdfRepository();
    final boolean enabled = repository != null && repository.isEnabled();
    final RdfInferenceStatus inferenceStatus = inferenceStatus(repository, enabled);
    final String storageType = enabled ? repository.getConfig().getStorageType().toString() : "N/A";
    final RdfProjectionState projectionState = projectionState(enabled);
    return new RdfStatus()
        .withBaseUri(URI.create(configuredBaseUri))
        .withEnabled(enabled)
        .withStorageType(storageType)
        .withInference(inferenceStatus)
        .withProjectionState(projectionState)
        .withAskCollateEnabled(askCollateEnabled);
  }

  private RdfProjectionState projectionState(final boolean enabled) {
    return enabled ? projectionStateSupplier.get() : RdfProjectionState.DISABLED;
  }

  private static RdfInferenceStatus inferenceStatus(
      final RdfRepository repository, final boolean enabled) {
    return new RdfInferenceStatus()
        .withEnabled(enabled && repository.isInferenceEnabledByDefault())
        .withDefaultLevel(enabled ? repository.getDefaultInferenceLevel() : "NONE")
        .withAvailableLevels(Set.of("NONE", "RDFS", "OWL_LITE", "OWL_DL", "CUSTOM"));
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
    RdfValidationService.ValidationResult result =
        new RdfValidationService(requireRdfRepository()).validate(entityUri, format);
    return Response.ok(result.report())
        .type(result.mediaType())
        .header("OM-SHACL-Conforms", String.valueOf(result.conforms()))
        .build();
  }

  @GET
  @Path("/rules")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "listInferenceRules",
      summary = "List durable inference rules and materialization state",
      description =
          "Returns the shipped starter pack and custom rules with their durable dirty state, inferred graph URI, last materialization result, and execution order.",
      responses = {
        @ApiResponse(responseCode = "200", description = "List of inference rules"),
        @ApiResponse(responseCode = "403", description = "Forbidden")
      })
  public Response listInferenceRules(@Context SecurityContext securityContext) {
    authorizer.authorizeAdmin(securityContext);
    return Response.ok(new InferenceRuleList().withRules(inferenceRuleService().list())).build();
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
    return Response.ok(inferenceRuleService().get(name)).build();
  }

  @PUT
  @Path("/rules/{name}")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "upsertInferenceRule",
      summary = "Create or update an inference rule",
      responses = {
        @ApiResponse(responseCode = "200", description = "Rule saved and marked dirty"),
        @ApiResponse(responseCode = "400", description = "Invalid rule"),
        @ApiResponse(responseCode = "403", description = "Forbidden")
      })
  public Response upsertInferenceRule(
      @Context final SecurityContext securityContext,
      @PathParam("name") final String name,
      @Valid final InferenceRule rule) {
    authorizer.authorizeAdmin(securityContext);
    final InferenceRuleStatus status = inferenceRuleService().upsert(name, rule);
    return Response.ok(status).build();
  }

  @DELETE
  @Path("/rules/{name}")
  @Operation(
      operationId = "deleteInferenceRule",
      summary = "Delete a custom inference rule and its materialized graph",
      responses = {
        @ApiResponse(responseCode = "204", description = "Rule deleted"),
        @ApiResponse(responseCode = "400", description = "System rules cannot be deleted"),
        @ApiResponse(responseCode = "403", description = "Forbidden")
      })
  public Response deleteInferenceRule(
      @Context final SecurityContext securityContext, @PathParam("name") final String name) {
    authorizer.authorizeAdmin(securityContext);
    inferenceRuleService().delete(name);
    return Response.noContent().build();
  }

  @POST
  @Path("/rules/materialize")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "materializeInferenceRules",
      summary = "Materialize dirty inference rules inside Fuseki",
      responses = {
        @ApiResponse(responseCode = "200", description = "Materialization completed"),
        @ApiResponse(responseCode = "403", description = "Forbidden"),
        @ApiResponse(responseCode = "503", description = "Materialized inference is disabled")
      })
  public Response materializeInferenceRules(
      @Context final SecurityContext securityContext,
      @QueryParam("force") @DefaultValue("false") final boolean force,
      @QueryParam("ruleName") final String ruleName) {
    authorizer.authorizeAdmin(securityContext);
    final InferenceMaterializationResult result =
        inferenceRuleService().materialize(force, ruleName);
    return Response.ok(result).build();
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
    return sparqlJson(insightsService().listImportantEntities(entityType, window, limit));
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
    return Response.ok(insightsService().recomputeCentrality(entityType)).build();
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
    return Response.ok(insightsService().recomputeCommunities(entityType, graphType)).build();
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
    return sparqlJson(insightsService().listCommunities(entityType, graphType));
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
    return Response.ok(insightsService().findLineagePath(from, to, direction, maxHops)).build();
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
    return sparqlJson(insightsService().datasetRecommendations(entityUri, limit));
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
    return sparqlJson(insightsService().tagCoOccurrence(minCount, limit));
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
    return sparqlJson(insightsService().glossaryReach(minDomains, limit));
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
    return sparqlJson(insightsService().tagPopularity(limit));
  }

  private Response sparqlJson(String result) {
    return Response.ok(result).type(SPARQL_JSON).build();
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
    return Response.ok(new CustomOntologyList(CustomOntologyRegistry.getInstance().list())).build();
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
        .map(extension -> Response.ok(extension).build())
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
    return Response.ok(DefinitionValidationResult.from(errors)).build();
  }

  @POST
  @Path("/rules/validate")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "validateInferenceRule",
      summary = "Validate a candidate inference rule without persisting it",
      description =
          "Runs the same validator used by durable writes. Materializable rules must be CONSTRUCT queries without SERVICE, dataset clauses, result modifiers, or unsupported grouping constructs.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Validation result"),
        @ApiResponse(responseCode = "403", description = "Forbidden")
      })
  public Response validateInferenceRule(
      @Context SecurityContext securityContext, InferenceRule candidate) {
    authorizer.authorizeAdmin(securityContext);
    List<String> errors = InferenceRuleValidator.validate(candidate);
    return Response.ok(DefinitionValidationResult.from(errors)).build();
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
    OntologyDocument.SerializedOntology ontology = OntologyDocument.serialize(format);
    return Response.ok(ontology.body())
        .type(ontology.mediaType())
        .header(
            "Content-Disposition", "inline; filename=openmetadata-ontology." + ontology.extension())
        .build();
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
    return Response.ok(graphService().debugGlossaryRelations(), MediaType.APPLICATION_JSON).build();
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
      @Parameter(description = "Entity type", required = true) @PathParam("entityType")
          String entityType,
      @Parameter(description = "Entity id", required = true) @PathParam("id") UUID id,
      @Parameter(description = "RDF format") @QueryParam("format") @DefaultValue("jsonld")
          String format) {
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_ALL),
        new ResourceContext<>(entityType, id, null));
    RdfGraphService.Representation representation =
        executeGraphOperation(
            "retrieving an entity as RDF", () -> graphService().entity(entityType, id, format));
    return Response.ok(representation.body(), representation.mediaType()).build();
  }

  @GET
  @Path("/entity/{entityType}/{id}/diff")
  @Operation(
      operationId = "getEntityRdfDiff",
      summary = "Diff two RDF entity versions",
      description =
          "Returns deterministic typed RDF statements added and removed between two database "
              + "entity versions. This endpoint remains available when RDF storage is disabled.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Canonical RDF entity diff",
            content =
                @Content(
                    mediaType = MediaType.APPLICATION_JSON,
                    schema = @Schema(implementation = RdfEntityDiff.class))),
        @ApiResponse(responseCode = "400", description = "Invalid entity type or version"),
        @ApiResponse(responseCode = "404", description = "Entity version not found")
      })
  public Response getEntityRdfDiff(
      @Context final SecurityContext securityContext,
      @PathParam("entityType") final String requestedEntityType,
      @PathParam("id") final UUID entityId,
      @QueryParam("fromVersion") final Double fromVersion,
      @QueryParam("toVersion") final Double toVersion) {
    final String entityType = RdfEntityTypeValidator.requireKnown(requestedEntityType);
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_ALL),
        new ResourceContext<>(entityType, entityId, null));
    final RdfEntityDiff diff =
        entityDiffService().diff(entityType, entityId, fromVersion, toVersion);
    return Response.ok(diff).build();
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
    String graph =
        executeGraphOperation(
            "exploring an entity graph",
            () -> {
              RdfGraphService.GraphRequest request =
                  RdfGraphService.GraphRequest.from(
                      entityId, entityType, depth, entityTypes, relationshipTypes);
              return graphService().explore(request);
            });
    return Response.ok(graph, MediaType.APPLICATION_JSON).build();
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
    RdfGraphService.Representation representation =
        executeGraphOperation(
            "exporting an entity graph",
            () -> {
              RdfGraphService.GraphRequest graph =
                  RdfGraphService.GraphRequest.from(
                      entityId, entityType, depth, entityTypes, relationshipTypes);
              RdfGraphService.GraphExportRequest exportRequest =
                  new RdfGraphService.GraphExportRequest(graph, format);
              return graphService().export(exportRequest);
            });
    return Response.ok(representation.body(), representation.mediaType()).build();
  }

  private ErrorResponse buildErrorResponse(String message) {
    return new ErrorResponse(message);
  }

  private <T> T executeGraphOperation(String operation, GraphOperation<T> graphOperation) {
    try {
      return graphOperation.execute();
    } catch (IllegalArgumentException exception) {
      throw new BadRequestException(exception.getMessage(), exception);
    } catch (IOException exception) {
      LOG.error("Error {}", operation, exception);
      throw new InternalServerErrorException("Unable to complete RDF operation", exception);
    }
  }

  @GET
  @Path("/queries/saved")
  @Operation(
      operationId = "listSavedSparqlQueries",
      summary = "List the authenticated user's saved SPARQL queries",
      responses = {
        @ApiResponse(responseCode = "200", description = "Private saved query library"),
        @ApiResponse(responseCode = "401", description = "Authentication required")
      })
  public SavedSparqlQueries listSavedSparqlQueries(@Context SecurityContext securityContext) {
    UUID currentUserId = getCurrentUserId(securityContext);
    return savedSparqlQueryService().get(currentUserId);
  }

  @PUT
  @Path("/queries/saved")
  @Operation(
      operationId = "replaceSavedSparqlQueries",
      summary = "Replace the authenticated user's saved SPARQL queries",
      responses = {
        @ApiResponse(responseCode = "200", description = "Updated private saved query library"),
        @ApiResponse(responseCode = "400", description = "Invalid saved query library"),
        @ApiResponse(responseCode = "401", description = "Authentication required")
      })
  public SavedSparqlQueries replaceSavedSparqlQueries(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid SavedSparqlQueries savedQueries) {
    final String userName = requireAuthenticatedUserName(securityContext);
    final UUID currentUserId = getCurrentUserId(userName);
    return savedSparqlQueryService().replace(uriInfo, currentUserId, userName, savedQueries);
  }

  @GET
  @Path("/queries/templates")
  @Operation(
      operationId = "listSparqlQueryTemplates",
      summary = "List administrator-managed installation query templates",
      responses = {
        @ApiResponse(responseCode = "200", description = "Installation query templates")
      })
  public SparqlQuerySettings listSparqlQueryTemplates() {
    return SettingsCache.getSettingOrDefault(
        SettingsType.SPARQL_QUERY_SETTINGS,
        new SparqlQuerySettings().withQueryTemplates(new ArrayList<>()),
        SparqlQuerySettings.class);
  }

  private UUID getCurrentUserId(SecurityContext securityContext) {
    final String userName = requireAuthenticatedUserName(securityContext);
    return getCurrentUserId(userName);
  }

  private static UUID getCurrentUserId(final String userName) {
    return Entity.getEntityReferenceByName(Entity.USER, userName, Include.NON_DELETED).getId();
  }

  private static String requireAuthenticatedUserName(SecurityContext securityContext) {
    return Optional.ofNullable(securityContext)
        .map(SecurityContext::getUserPrincipal)
        .map(Principal::getName)
        .filter(name -> !nullOrEmpty(name) && !name.isBlank())
        .orElseThrow(() -> new NotAuthorizedException("Authentication is required"));
  }

  @GET
  @Path("/sparql")
  @Produces({
    SPARQL_JSON,
    SPARQL_XML,
    SPARQL_CSV,
    SPARQL_TSV,
    TURTLE,
    RDF_XML,
    N_TRIPLES,
    JSON_LD,
    MediaType.APPLICATION_JSON
  })
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
    return executeSparqlQuery(
        requireAuthenticatedUserName(securityContext), query, format, inference);
  }

  @POST
  @Path("/sparql")
  @Produces({
    SPARQL_JSON,
    SPARQL_XML,
    SPARQL_CSV,
    SPARQL_TSV,
    TURTLE,
    RDF_XML,
    N_TRIPLES,
    JSON_LD,
    MediaType.APPLICATION_JSON
  })
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
    return executeSparqlQuery(
        requireAuthenticatedUserName(securityContext), sparqlQuery.getQuery(), format, inference);
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
    sparqlService().update(sparqlQuery.getQuery());
    return Response.ok(new SparqlUpdateResult("success")).build();
  }

  private Response executeSparqlQuery(
      String principal, String query, String format, String inference) {
    try {
      RdfSparqlService.QueryResult result =
          SPARQL_EXECUTION_GUARD.execute(
              principal, () -> sparqlService().query(query, format, inference));
      Response.ResponseBuilder response = Response.ok(result.body()).type(result.mediaType());
      Optional.ofNullable(result.warning())
          .ifPresent(warning -> response.header(INFERENCE_WARNING_HEADER, warning));
      return response.build();
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

  private record SparqlUpdateResult(String status) {}

  private record CustomOntologyList(List<CustomOntology> extensions) {
    private CustomOntologyList {
      extensions = List.copyOf(extensions);
    }
  }

  private record DefinitionValidationResult(boolean valid, List<String> errors) {
    private DefinitionValidationResult {
      errors = List.copyOf(errors);
    }

    private static DefinitionValidationResult from(List<String> errors) {
      return new DefinitionValidationResult(errors.isEmpty(), errors);
    }
  }

  private record ErrorResponse(String error) {}

  @FunctionalInterface
  private interface GraphOperation<T> {
    T execute() throws IOException;
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
    String lineage =
        executeGraphOperation(
            "retrieving inferred lineage",
            () -> {
              RdfGraphService.LineageRequest request =
                  RdfGraphService.LineageRequest.from(entityId, entityType, direction);
              return graphService().fullLineage(request);
            });
    return Response.ok(lineage, SPARQL_JSON).build();
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
    String graph =
        executeGraphOperation(
            "retrieving a glossary graph",
            () ->
                graphService()
                    .glossaryGraph(
                        new RdfGraphService.GlossaryGraphRequest(
                            glossaryId,
                            glossaryTermId,
                            relationTypes,
                            limit,
                            offset,
                            includeIsolated)));
    return Response.ok(graph, MediaType.APPLICATION_JSON).build();
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
    return Response.ok(getSemanticSearchEngine().semanticSearch(query, entityType, limit)).build();
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
    return Response.ok(
            getSemanticSearchEngine().findSimilarEntities(id.toString(), entityType, limit))
        .build();
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
    RdfGraphService.Download download =
        executeGraphOperation(
            "exporting a glossary",
            () -> graphService().exportGlossary(id, format, includeRelations));
    return Response.ok(download.body(), download.mediaType())
        .header("Content-Disposition", "attachment; filename=\"" + download.fileName() + "\"")
        .build();
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
    return Response.ok(
            getSemanticSearchEngine().getRecommendations(userId.toString(), entityType, limit))
        .build();
  }
}
