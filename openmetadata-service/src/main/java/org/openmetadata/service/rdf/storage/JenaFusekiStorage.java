package org.openmetadata.service.rdf.storage;

import java.io.ByteArrayOutputStream;
import java.io.StringWriter;
import java.net.ConnectException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpConnectTimeoutException;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.channels.ClosedChannelException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.query.Query;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.query.QueryFactory;
import org.apache.jena.query.ResultSet;
import org.apache.jena.query.ResultSetFormatter;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdfconnection.RDFConnection;
import org.apache.jena.rdfconnection.RDFConnectionFuseki;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RDFFormat;
import org.apache.jena.update.UpdateFactory;
import org.apache.jena.update.UpdateRequest;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;

/**
 * Apache Jena Fuseki implementation of RDF storage.
 * Connects to a remote Fuseki server for stateless RDF operations.
 */
@Slf4j
public class JenaFusekiStorage implements RdfStorageInterface {

  private static final String KNOWLEDGE_GRAPH = "https://open-metadata.org/graph/knowledge";
  private static final String METADATA_GRAPH = "https://open-metadata.org/graph/metadata";

  // 2s caps TCP connect only. Once Fuseki accepts the connection, a stalled
  // server can still hang the request — Jena's RDFConnection.update() doesn't
  // expose a per-request timeout we can wire in cleanly. The circuit breaker
  // below + the bounded pendingWrites gate in RdfUpdater contain the blast
  // radius: after CIRCUIT_BREAKER_FAILURE_THRESHOLD slow/failed calls the
  // breaker trips and short-circuits subsequent traffic for the cooldown.
  private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(2);
  private static final int CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
  private static final long CIRCUIT_BREAKER_COOLDOWN_MS = 30_000L;

  private final RDFConnection connection;
  private final String baseUri;
  private final String endpoint;
  private final String username;
  private final String password;

  private final AtomicInteger consecutiveFailures = new AtomicInteger(0);
  private final AtomicLong circuitOpenUntilMs = new AtomicLong(0L);

  public JenaFusekiStorage(RdfConfiguration config) {
    this.baseUri =
        config.getBaseUri() != null ? config.getBaseUri().toString() : "https://open-metadata.org/";

    this.endpoint =
        config.getRemoteEndpoint() != null && !config.getRemoteEndpoint().toString().isEmpty()
            ? config.getRemoteEndpoint().toString()
            : "http://openmetadata-fuseki:3030/openmetadata";
    this.username = config.getUsername();
    this.password = config.getPassword();

    // Best-effort attempt to create the dataset at startup; callers should invoke
    // ensureStorageReady() before running work to recover from later restarts of the RDF server.
    ensureDatasetExists(endpoint, username, password);

    if (username != null && password != null) {
      java.net.http.HttpClient httpClient =
          java.net.http.HttpClient.newBuilder()
              .connectTimeout(CONNECT_TIMEOUT)
              .authenticator(
                  new java.net.Authenticator() {
                    @Override
                    protected java.net.PasswordAuthentication getPasswordAuthentication() {
                      return new java.net.PasswordAuthentication(
                          config.getUsername(), config.getPassword().toCharArray());
                    }
                  })
              .build();

      this.connection =
          RDFConnectionFuseki.create().destination(endpoint).httpClient(httpClient).build();
    } else {
      java.net.http.HttpClient httpClient =
          java.net.http.HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build();
      this.connection =
          RDFConnectionFuseki.create().destination(endpoint).httpClient(httpClient).build();
    }
    LOG.info("Connected to Apache Jena Fuseki at {}", endpoint);
    loadOntology();
  }

  @Override
  public void ensureStorageReady() {
    if (testConnection()) {
      LOG.debug("Fuseki dataset at {} is accessible", endpoint);
      return;
    }

    LOG.warn(
        "Fuseki dataset at {} is not accessible; attempting to (re)create it before running",
        endpoint);
    ensureDatasetExists(endpoint, username, password);

    if (!testConnection()) {
      throw new IllegalStateException(
          String.format(
              "RDF storage is not accessible at %s after attempting dataset creation. "
                  + "Verify the configured RDF endpoint URL, credentials, that the Fuseki dataset "
                  + "exists, and that the configured user has permission to create it.",
              endpoint));
    }
    LOG.info("Fuseki dataset at {} is now ready", endpoint);
    loadOntology();
  }

  /**
   * Ensures the Fuseki dataset exists, creating it if necessary.
   * Parses the endpoint URL to extract the server base URL and dataset name,
   * then checks if the dataset exists and creates it if not.
   */
  private void ensureDatasetExists(String endpoint, String username, String password) {
    try {
      // Parse endpoint to extract server base URL and dataset name
      // Expected format: http://host:port/datasetName
      URI uri = URI.create(endpoint);
      String path = uri.getPath();
      if (path == null || path.isEmpty() || path.equals("/")) {
        LOG.warn("Could not extract dataset name from endpoint: {}", endpoint);
        return;
      }

      // Remove leading slash and get dataset name
      String datasetName = path.startsWith("/") ? path.substring(1) : path;
      // Handle paths like /openmetadata/sparql -> extract just openmetadata
      if (datasetName.contains("/")) {
        datasetName = datasetName.split("/")[0];
      }

      String serverBaseUrl =
          uri.getScheme() + "://" + uri.getHost() + (uri.getPort() > 0 ? ":" + uri.getPort() : "");

      LOG.info("Checking if Fuseki dataset '{}' exists at server {}", datasetName, serverBaseUrl);

      // Check if dataset exists by querying the datasets admin endpoint
      HttpClient httpClient = HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build();
      String adminUrl = serverBaseUrl + "/$/datasets/" + datasetName;

      HttpRequest.Builder requestBuilder = HttpRequest.newBuilder().uri(URI.create(adminUrl)).GET();

      // Add basic auth if credentials provided
      if (username != null && password != null) {
        String auth = username + ":" + password;
        String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes());
        requestBuilder.header("Authorization", "Basic " + encodedAuth);
      }

      HttpResponse<String> response =
          httpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() == 200) {
        LOG.info("Fuseki dataset '{}' already exists", datasetName);
        return;
      }

      if (response.statusCode() == 404) {
        LOG.info("Fuseki dataset '{}' does not exist, creating it...", datasetName);
        createDataset(serverBaseUrl, datasetName, username, password);
      } else {
        LOG.warn(
            "Unexpected response checking dataset existence: {} - {}",
            response.statusCode(),
            response.body());
      }
    } catch (Exception e) {
      LOG.warn(
          "Could not verify/create Fuseki dataset. "
              + "If the dataset doesn't exist, you may need to create it manually. Error: {}",
          e.getMessage());
    }
  }

  /**
   * Creates a new TDB2 dataset in Fuseki using the admin API.
   */
  private void createDataset(
      String serverBaseUrl, String datasetName, String username, String password) {
    try {
      HttpClient httpClient = HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build();
      String adminUrl = serverBaseUrl + "/$/datasets";

      String body = "dbName=" + datasetName + "&dbType=tdb2";

      HttpRequest.Builder requestBuilder =
          HttpRequest.newBuilder()
              .uri(URI.create(adminUrl))
              .header("Content-Type", "application/x-www-form-urlencoded")
              .POST(HttpRequest.BodyPublishers.ofString(body));

      // Add basic auth if credentials provided
      if (username != null && password != null) {
        String auth = username + ":" + password;
        String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes());
        requestBuilder.header("Authorization", "Basic " + encodedAuth);
      }

      HttpResponse<String> response =
          httpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() == 200 || response.statusCode() == 201) {
        LOG.info("Successfully created Fuseki dataset '{}'", datasetName);
      } else {
        LOG.error(
            "Failed to create Fuseki dataset '{}': {} - {}",
            datasetName,
            response.statusCode(),
            response.body());
      }
    } catch (Exception e) {
      LOG.error("Error creating Fuseki dataset '{}': {}", datasetName, e.getMessage());
    }
  }

  private void loadOntology() {
    try {
      String checkQuery = String.format("ASK { GRAPH <%s> { ?s ?p ?o } }", METADATA_GRAPH);
      boolean ontologyExists = false;

      try (QueryExecution qe = connection.query(checkQuery)) {
        ontologyExists = qe.execAsk();
      } catch (Exception e) {
        LOG.debug("Could not check if ontology exists, will attempt to load", e);
      }

      if (ontologyExists) {
        LOG.info("OpenMetadata ontology already exists in Fuseki");
        return;
      }

      Model ontologyModel = ModelFactory.createDefaultModel();
      RDFDataMgr.read(
          ontologyModel,
          Objects.requireNonNull(getClass().getResourceAsStream("/rdf/ontology/openmetadata.ttl")),
          org.apache.jena.riot.Lang.TURTLE);

      connection.load(METADATA_GRAPH, ontologyModel);
      LOG.info("Loaded OpenMetadata ontology to Fuseki");
    } catch (Exception e) {
      LOG.error("Failed to load ontology to Fuseki", e);
    }
  }

  private boolean isCircuitOpen() {
    return System.currentTimeMillis() < circuitOpenUntilMs.get();
  }

  private void throwIfCircuitOpen(String operation) {
    if (isCircuitOpen()) {
      throw new RuntimeException(
          "RDF circuit breaker is open; skipping " + operation + " until Fuseki recovers");
    }
  }

  private void recordSuccess() {
    consecutiveFailures.set(0);
    circuitOpenUntilMs.set(0L);
  }

  private void recordFailure() {
    int failures = consecutiveFailures.incrementAndGet();
    if (failures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
      long until = System.currentTimeMillis() + CIRCUIT_BREAKER_COOLDOWN_MS;
      if (circuitOpenUntilMs.getAndSet(until) < until) {
        LOG.warn(
            "RDF circuit breaker tripped after {} consecutive failures; "
                + "short-circuiting writes for {} ms",
            failures,
            CIRCUIT_BREAKER_COOLDOWN_MS);
      }
    }
  }

  private static boolean isConnectError(Throwable t) {
    Throwable cause = t;
    while (cause != null) {
      if (cause instanceof ConnectException
          || cause instanceof ClosedChannelException
          || cause instanceof HttpConnectTimeoutException) {
        return true;
      }
      Throwable next = cause.getCause();
      if (next == cause) {
        return false;
      }
      cause = next;
    }
    return false;
  }

  @Override
  public void storeEntity(String entityType, UUID entityId, Model entityModel) {
    throwIfCircuitOpen("storeEntity");
    String entityUri = baseUri + "entity/" + entityType + "/" + entityId;
    // Refresh literal-valued triples (name, description, tags, etc.) from the
    // translator, but preserve URI-valued triples — those are inter-entity edges
    // (om:hasOwner, om:belongsToDatabase, om:UPSTREAM, om:hasLineageDetails, …)
    // that are managed by add/removeRelationship and add/removeLineage hooks,
    // not by the translator. A metadata-only update (e.g. PATCH description)
    // doesn't fire relationship hooks, so a blanket DELETE-then-LOAD here would
    // wipe relationships until the next weekly recreate-index. Filtering on
    // !isIRI(?o) keeps every URI object intact; relationship lifecycle is owned
    // by the dedicated hooks, and the LOAD that follows re-adds the translator's
    // URI-typed triples (rdf:type, etc.) idempotently under RDF set semantics.
    String deleteQuery =
        String.format(
            "DELETE { GRAPH <%s> { <%s> ?p ?o } } WHERE { GRAPH <%s> { <%s> ?p ?o . FILTER(!isIRI(?o)) } }",
            KNOWLEDGE_GRAPH, entityUri, KNOWLEDGE_GRAPH, entityUri);

    int maxRetries = 3;
    int retryCount = 0;
    Exception lastException = null;

    while (retryCount < maxRetries) {
      try {
        UpdateRequest deleteRequest = UpdateFactory.create(deleteQuery);
        connection.update(deleteRequest);
        connection.load(KNOWLEDGE_GRAPH, entityModel);
        LOG.debug("Stored entity {} in graph {}", entityId, KNOWLEDGE_GRAPH);
        recordSuccess();
        return;
      } catch (org.apache.jena.atlas.web.HttpException e) {
        lastException = e;
        if (isConnectError(e)) {
          recordFailure();
          LOG.error("Fuseki unreachable storing entity {}; fast-failing without retry", entityId);
          throw new RuntimeException("Failed to store entity in RDF (Fuseki unreachable)", e);
        }
        retryCount++;
        if (retryCount < maxRetries) {
          try {
            long waitTime = (long) (100 * Math.pow(2, retryCount - 1));
            LOG.debug(
                "Retrying entity storage after {} ms (attempt {}/{}, status: {})",
                waitTime,
                retryCount + 1,
                maxRetries,
                e.getStatusCode());
            Thread.sleep(waitTime);
          } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Interrupted while retrying", ie);
          }
        } else {
          LOG.error("Failed to store entity in Fuseki after {} attempts", maxRetries, e);
          recordFailure();
          throw new RuntimeException("Failed to store entity in RDF", e);
        }
      } catch (Exception e) {
        LOG.error("Failed to store entity in Fuseki", e);
        recordFailure();
        throw new RuntimeException("Failed to store entity in RDF", e);
      }
    }

    LOG.error("Failed to store entity after {} retries", maxRetries);
    recordFailure();
    throw new RuntimeException("Failed to store entity in RDF after retries", lastException);
  }

  @Override
  public void storeRelationship(
      String fromType, UUID fromId, String toType, UUID toId, String relationshipType) {
    throwIfCircuitOpen("storeRelationship");

    // Use DELETE/INSERT pattern for idempotency - deletes existing triple before inserting
    String deleteInsertQuery =
        String.format(
            "PREFIX om: <%sontology/> "
                + "DELETE DATA { "
                + "  GRAPH <%s> { "
                + "    <%sentity/%s/%s> om:%s <%sentity/%s/%s> . "
                + "  } "
                + "}; "
                + "INSERT DATA { "
                + "  GRAPH <%s> { "
                + "    <%sentity/%s/%s> om:%s <%sentity/%s/%s> . "
                + "  } "
                + "}",
            baseUri,
            KNOWLEDGE_GRAPH,
            baseUri,
            fromType,
            fromId,
            relationshipType,
            baseUri,
            toType,
            toId,
            KNOWLEDGE_GRAPH,
            baseUri,
            fromType,
            fromId,
            relationshipType,
            baseUri,
            toType,
            toId);

    int maxRetries = 3;
    int retryCount = 0;
    Exception lastException = null;

    while (retryCount < maxRetries) {
      try {
        LOG.debug("SPARQL Update Query: {}", deleteInsertQuery);
        UpdateRequest request = UpdateFactory.create(deleteInsertQuery);
        connection.update(request);
        LOG.debug("Stored relationship (idempotent): {} -{}- {}", fromId, relationshipType, toId);
        recordSuccess();
        return; // Success
      } catch (org.apache.jena.atlas.web.HttpException e) {
        lastException = e;
        if (isConnectError(e)) {
          recordFailure();
          LOG.error(
              "Fuseki unreachable storing relationship {}->{}; fast-failing without retry",
              fromId,
              toId);
          throw new RuntimeException("Failed to store relationship in RDF (Fuseki unreachable)", e);
        }
        retryCount++;
        if (retryCount < maxRetries) {
          try {
            long waitTime = (long) (100 * Math.pow(2, retryCount - 1));
            LOG.debug(
                "Retrying relationship storage after {} ms (attempt {}/{}, status: {})",
                waitTime,
                retryCount + 1,
                maxRetries,
                e.getStatusCode());
            Thread.sleep(waitTime);
          } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Interrupted while retrying", ie);
          }
        } else {
          LOG.error("Failed to store relationship in Fuseki after {} attempts", maxRetries, e);
          recordFailure();
          throw new RuntimeException("Failed to store relationship in RDF", e);
        }
      } catch (Exception e) {
        LOG.error("Failed to store relationship in Fuseki", e);
        recordFailure();
        throw new RuntimeException("Failed to store relationship in RDF", e);
      }
    }

    LOG.error("Failed to store relationship after {} retries", maxRetries);
    recordFailure();
    throw new RuntimeException("Failed to store relationship in RDF after retries", lastException);
  }

  @Override
  public void bulkStoreRelationships(List<RelationshipData> relationships) {
    if (relationships.isEmpty()) {
      return;
    }
    throwIfCircuitOpen("bulkStoreRelationships");

    // Per-source-entity reconciliation: for each (fromType, fromId) in this
    // batch, wipe every outgoing entity-to-entity edge from that source first,
    // EXCEPT lineage edges (UPSTREAM / wasDerivedFrom / hasLineageDetails) which
    // are managed separately by addLineageWithDetails. Then insert the current
    // batch. This ensures relationships that USED to exist for the source but
    // are no longer in the batch get removed — the original implementation only
    // deleted the exact triples in the new batch, so stale edges accumulated.
    Set<String> distinctSources = new LinkedHashSet<>();
    for (RelationshipData rel : relationships) {
      distinctSources.add(baseUri + "entity/" + rel.getFromType() + "/" + rel.getFromId());
    }

    StringBuilder deleteUpdate = new StringBuilder();
    boolean firstDelete = true;
    for (String sourceUri : distinctSources) {
      if (!firstDelete) {
        deleteUpdate.append("; ");
      }
      firstDelete = false;
      deleteUpdate
          .append("DELETE { GRAPH <")
          .append(KNOWLEDGE_GRAPH)
          .append("> { <")
          .append(sourceUri)
          .append("> ?p ?o } } WHERE { GRAPH <")
          .append(KNOWLEDGE_GRAPH)
          .append("> { <")
          .append(sourceUri)
          .append("> ?p ?o . FILTER(isIRI(?o) && STRSTARTS(STR(?o), \"")
          .append(baseUri)
          .append("entity/\") && ?p != <https://open-metadata.org/ontology/UPSTREAM> && ?p")
          .append(
              " != <http://www.w3.org/ns/prov#wasDerivedFrom> && ?p != <https://open-metadata.org/ontology/hasLineageDetails>) } }");
    }

    StringBuilder insertData = new StringBuilder();
    insertData.append("PREFIX om: <").append(baseUri).append("ontology/> ");
    insertData.append("INSERT DATA { GRAPH <").append(KNOWLEDGE_GRAPH).append("> { ");
    for (RelationshipData rel : relationships) {
      insertData.append(
          String.format(
              "<%sentity/%s/%s> om:%s <%sentity/%s/%s> . ",
              baseUri,
              rel.getFromType(),
              rel.getFromId(),
              rel.getRelationshipType(),
              baseUri,
              rel.getToType(),
              rel.getToId()));
    }
    insertData.append("} }");

    // DELETE WHERE on a source with no prior edges is a no-op, not an error,
    // so we no longer swallow non-connect exceptions here — malformed SPARQL,
    // authorization failures, or server-side update errors should fail the
    // batch loudly instead of letting the insert proceed against an
    // unreconciled graph.
    try {
      if (deleteUpdate.length() > 0) {
        UpdateRequest deleteRequest = UpdateFactory.create(deleteUpdate.toString());
        connection.update(deleteRequest);
      }

      UpdateRequest insertRequest = UpdateFactory.create(insertData.toString());
      connection.update(insertRequest);
      LOG.info(
          "Bulk stored {} relationships across {} source entities (reconciled)",
          relationships.size(),
          distinctSources.size());
      recordSuccess();
    } catch (Exception e) {
      LOG.error("Failed to bulk store relationships in Fuseki", e);
      recordFailure();
      throw new RuntimeException("Failed to bulk store relationships in RDF", e);
    }
  }

  @Override
  public Model getEntity(String entityType, UUID entityId) {
    if (isCircuitOpen()) {
      return null;
    }
    String entityUri = baseUri + "entity/" + entityType + "/" + entityId;

    String query =
        String.format(
            "CONSTRUCT { ?s ?p ?o } WHERE { GRAPH <%s> { <%s> ?p ?o . BIND(<%s> as ?s) } }",
            KNOWLEDGE_GRAPH, entityUri, entityUri);

    try {
      Query q = QueryFactory.create(query);
      Model result = connection.queryConstruct(q);
      recordSuccess();
      return result.isEmpty() ? null : result;
    } catch (Exception e) {
      LOG.error("Failed to get entity from Fuseki", e);
      if (isConnectError(e)) {
        recordFailure();
      }
      return null;
    }
  }

  @Override
  public void deleteEntity(String entityType, UUID entityId) {
    throwIfCircuitOpen("deleteEntity");
    String entityUri = baseUri + "entity/" + entityType + "/" + entityId;

    // Delete entity and all its relationships from the knowledge graph
    String deleteQuery =
        String.format(
            "DELETE WHERE { GRAPH <%s> { <%s> ?p ?o } }; "
                + "DELETE WHERE { GRAPH <%s> { ?s ?p <%s> } }",
            KNOWLEDGE_GRAPH, entityUri, KNOWLEDGE_GRAPH, entityUri);

    try {
      UpdateRequest request = UpdateFactory.create(deleteQuery);
      connection.update(request);
      LOG.debug("Deleted entity {} from Fuseki", entityId);
      recordSuccess();
    } catch (Exception e) {
      LOG.error("Failed to delete entity from Fuseki", e);
      if (isConnectError(e)) {
        recordFailure();
      }
      throw new RuntimeException("Failed to delete entity from RDF", e);
    }
  }

  @Override
  public String executeSparqlQuery(String sparqlQuery, String format) {
    throwIfCircuitOpen("executeSparqlQuery");
    try {
      String result = doExecuteSparqlQuery(sparqlQuery, format);
      recordSuccess();
      return result;
    } catch (Exception e) {
      LOG.error("Failed to execute SPARQL query on Fuseki", e);
      if (isConnectError(e)) {
        recordFailure();
      }
      throw new RuntimeException("Failed to execute SPARQL query", e);
    }
  }

  private String doExecuteSparqlQuery(String sparqlQuery, String format) {
    Query query = QueryFactory.create(sparqlQuery);

    if (query.isSelectType()) {
      try (QueryExecution qexec = connection.query(query)) {
        ResultSet results = qexec.execSelect();

        switch (format.toLowerCase()) {
          case "json":
          case "application/json":
          case "application/sparql-results+json":
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ResultSetFormatter.outputAsJSON(out, results);
            return out.toString();
          case "xml":
          case "application/xml":
          case "application/sparql-results+xml":
            return ResultSetFormatter.asXMLString(results);
          case "csv":
          case "text/csv":
            ByteArrayOutputStream csvOut = new ByteArrayOutputStream();
            ResultSetFormatter.outputAsCSV(csvOut, results);
            return csvOut.toString();
          default:
            return ResultSetFormatter.asText(results);
        }
      }
    } else if (query.isConstructType()) {
      Model resultModel = connection.queryConstruct(query);
      return formatModel(resultModel, format);
    } else if (query.isAskType()) {
      boolean result = connection.queryAsk(query);
      LOG.info("ASK query result: {}", result);
      return "{\"head\": {}, \"boolean\": " + result + "}";
    } else if (query.isDescribeType()) {
      Model resultModel = connection.queryDescribe(query);
      return formatModel(resultModel, format);
    }

    return "Unsupported query type";
  }

  private String formatModel(Model model, String format) {
    StringWriter writer = new StringWriter();

    RDFFormat rdfFormat =
        format.equalsIgnoreCase("turtle")
            ? RDFFormat.TURTLE
            : format.equalsIgnoreCase("jsonld")
                ? RDFFormat.JSONLD
                : format.equalsIgnoreCase("ntriples") ? RDFFormat.NTRIPLES : RDFFormat.RDFXML;

    RDFDataMgr.write(writer, model, rdfFormat);
    return writer.toString();
  }

  @Override
  public void executeSparqlUpdate(String sparqlUpdate) {
    throwIfCircuitOpen("executeSparqlUpdate");
    try {
      UpdateRequest request = UpdateFactory.create(sparqlUpdate);
      connection.update(request);
      LOG.debug("Executed SPARQL update on Fuseki");
      recordSuccess();
    } catch (Exception e) {
      LOG.error("Failed to execute SPARQL update on Fuseki", e);
      if (isConnectError(e)) {
        recordFailure();
      }
      throw new RuntimeException("Failed to execute SPARQL update", e);
    }
  }

  @Override
  public void loadTurtleFile(java.io.InputStream turtleStream, String graphUri) {
    throwIfCircuitOpen("loadTurtleFile");
    try {
      Model model = ModelFactory.createDefaultModel();
      model.read(turtleStream, null, "TURTLE");
      try {
        connection.delete(graphUri);
      } catch (org.apache.jena.atlas.web.HttpException e) {
        if (e.getStatusCode() != 404) {
          throw e;
        }
      }

      // Then load the new data
      connection.load(graphUri, model);

      LOG.info("Loaded Turtle file into graph {} with {} triples", graphUri, model.size());
      recordSuccess();
    } catch (Exception e) {
      LOG.error("Failed to load Turtle file into Fuseki", e);
      if (isConnectError(e)) {
        recordFailure();
      }
      throw new RuntimeException("Failed to load Turtle file", e);
    }
  }

  @Override
  public List<String> getAllGraphs() {
    throwIfCircuitOpen("getAllGraphs");
    String query = "SELECT DISTINCT ?g WHERE { GRAPH ?g { ?s ?p ?o } }";
    List<String> graphs = new ArrayList<>();

    try (QueryExecution qexec = connection.query(query)) {
      ResultSet results = qexec.execSelect();
      results.forEachRemaining(
          qs -> {
            String graphUri = qs.getResource("g").getURI();
            graphs.add(graphUri);
          });
      recordSuccess();
    } catch (Exception e) {
      if (isConnectError(e)) {
        recordFailure();
      }
      throw e;
    }

    return graphs;
  }

  @Override
  public long getTripleCount() {
    throwIfCircuitOpen("getTripleCount");
    String query = "SELECT (COUNT(*) as ?count) WHERE { GRAPH ?g { ?s ?p ?o } }";

    try (QueryExecution qexec = connection.query(query)) {
      ResultSet results = qexec.execSelect();
      recordSuccess();
      if (results.hasNext()) {
        return results.next().getLiteral("count").getLong();
      }
    } catch (Exception e) {
      if (isConnectError(e)) {
        recordFailure();
      }
      throw e;
    }

    return 0;
  }

  @Override
  public void clearGraph(String graphUri) {
    throwIfCircuitOpen("clearGraph");
    try {
      connection.delete(graphUri);
      LOG.info("Cleared graph: {}", graphUri);
      recordSuccess();
    } catch (Exception e) {
      LOG.error("Failed to clear graph on Fuseki", e);
      if (isConnectError(e)) {
        recordFailure();
      }
      throw new RuntimeException("Failed to clear graph", e);
    }
  }

  @Override
  public boolean testConnection() {
    // testConnection is the probe used to detect when Fuseki has recovered, so
    // it must bypass the circuit breaker — otherwise we could never re-close it.
    try {
      String testQuery = "ASK { ?s ?p ?o }";
      connection.queryAsk(testQuery);
      recordSuccess();
      return true;
    } catch (Exception e) {
      LOG.error("Connection test failed", e);
      return false;
    }
  }

  @Override
  public String getStorageType() {
    return "Apache Jena Fuseki";
  }

  @Override
  public void close() {
    if (connection != null) {
      connection.close();
      LOG.info("Closed connection to Fuseki server");
    }
  }
}
