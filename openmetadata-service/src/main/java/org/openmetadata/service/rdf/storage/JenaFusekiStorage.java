package org.openmetadata.service.rdf.storage;

import java.io.ByteArrayOutputStream;
import java.io.StringWriter;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
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

  private final RDFConnection connection;
  private final String baseUri;

  public JenaFusekiStorage(RdfConfiguration config) {
    this.baseUri =
        config.getBaseUri() != null ? config.getBaseUri().toString() : "https://open-metadata.org/";

    String endpoint =
        config.getRemoteEndpoint() != null && !config.getRemoteEndpoint().toString().isEmpty()
            ? config.getRemoteEndpoint().toString()
            : "http://openmetadata-fuseki:3030/openmetadata";

    // Ensure the dataset exists before connecting
    ensureDatasetExists(endpoint, config.getUsername(), config.getPassword());

    if (config.getUsername() != null && config.getPassword() != null) {
      java.net.http.HttpClient httpClient =
          java.net.http.HttpClient.newBuilder()
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
      this.connection = RDFConnectionFuseki.create().destination(endpoint).build();
    }
    LOG.info("Connected to Apache Jena Fuseki at {}", endpoint);
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
      HttpClient httpClient = HttpClient.newHttpClient();
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
      HttpClient httpClient = HttpClient.newHttpClient();
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

  @Override
  public void storeEntity(String entityType, UUID entityId, Model entityModel) {
    String entityUri = baseUri + "entity/" + entityType + "/" + entityId;
    String deleteQuery =
        String.format("DELETE WHERE { GRAPH <%s> { <%s> ?p ?o } }", KNOWLEDGE_GRAPH, entityUri);

    int maxRetries = 3;
    int retryCount = 0;
    Exception lastException = null;

    while (retryCount < maxRetries) {
      try {
        UpdateRequest deleteRequest = UpdateFactory.create(deleteQuery);
        connection.update(deleteRequest);
        connection.load(KNOWLEDGE_GRAPH, entityModel);
        LOG.debug("Stored entity {} in graph {}", entityId, KNOWLEDGE_GRAPH);
        return;
      } catch (org.apache.jena.atlas.web.HttpException e) {
        if (e.getStatusCode() == 500 && retryCount < maxRetries - 1) {
          lastException = e;
          retryCount++;
          try {
            long waitTime = (long) (100 * Math.pow(2, retryCount - 1));
            LOG.debug(
                "Retrying entity storage after {} ms (attempt {}/{})",
                waitTime,
                retryCount + 1,
                maxRetries);
            Thread.sleep(waitTime);
          } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Interrupted while retrying", ie);
          }
        } else {
          LOG.error("Failed to store entity in Fuseki", e);
          throw new RuntimeException("Failed to store entity in RDF", e);
        }
      } catch (Exception e) {
        LOG.error("Failed to store entity in Fuseki", e);
        throw new RuntimeException("Failed to store entity in RDF", e);
      }
    }

    LOG.error("Failed to store entity after {} retries", maxRetries);
    throw new RuntimeException("Failed to store entity in RDF after retries", lastException);
  }

  @Override
  public void storeRelationship(
      String fromType, UUID fromId, String toType, UUID toId, String relationshipType) {

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
        return; // Success
      } catch (org.apache.jena.atlas.web.HttpException e) {
        if (e.getStatusCode() == 500 && retryCount < maxRetries - 1) {
          lastException = e;
          retryCount++;
          try {
            long waitTime = (long) (100 * Math.pow(2, retryCount - 1));
            LOG.debug(
                "Retrying relationship storage after {} ms (attempt {}/{})",
                waitTime,
                retryCount + 1,
                maxRetries);
            Thread.sleep(waitTime);
          } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Interrupted while retrying", ie);
          }
        } else {
          LOG.error("Failed to store relationship in Fuseki. Query was: {}", deleteInsertQuery, e);
          throw new RuntimeException("Failed to store relationship in RDF", e);
        }
      } catch (Exception e) {
        LOG.error("Failed to store relationship in Fuseki. Query was: {}", deleteInsertQuery, e);
        throw new RuntimeException("Failed to store relationship in RDF", e);
      }
    }

    // If we get here, all retries failed
    LOG.error(
        "Failed to store relationship after {} retries. Query was: {}",
        maxRetries,
        deleteInsertQuery);
    throw new RuntimeException("Failed to store relationship in RDF after retries", lastException);
  }

  @Override
  public void bulkStoreRelationships(List<RelationshipData> relationships) {
    if (relationships.isEmpty()) {
      return;
    }

    // First, delete existing relationships to ensure idempotency
    // This prevents duplicate triples when reindexing
    StringBuilder deleteData = new StringBuilder();
    deleteData.append("PREFIX om: <").append(baseUri).append("ontology/> ");
    deleteData.append("DELETE DATA { GRAPH <").append(KNOWLEDGE_GRAPH).append("> { ");

    for (RelationshipData rel : relationships) {
      deleteData.append(
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
    deleteData.append("} }");

    // Then insert the new relationships
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

    try {
      // Execute delete first (ignore errors if triples don't exist)
      try {
        UpdateRequest deleteRequest = UpdateFactory.create(deleteData.toString());
        connection.update(deleteRequest);
      } catch (Exception e) {
        // Ignore delete errors - triples may not exist on first indexing
        LOG.debug("Delete before insert completed (some triples may not have existed)");
      }

      // Then execute insert
      UpdateRequest insertRequest = UpdateFactory.create(insertData.toString());
      connection.update(insertRequest);
      LOG.info("Bulk stored {} relationships (idempotent)", relationships.size());
    } catch (Exception e) {
      LOG.error("Failed to bulk store relationships in Fuseki", e);
      throw new RuntimeException("Failed to bulk store relationships in RDF", e);
    }
  }

  @Override
  public Model getEntity(String entityType, UUID entityId) {
    String entityUri = baseUri + "entity/" + entityType + "/" + entityId;

    String query =
        String.format(
            "CONSTRUCT { ?s ?p ?o } WHERE { GRAPH <%s> { <%s> ?p ?o . BIND(<%s> as ?s) } }",
            KNOWLEDGE_GRAPH, entityUri, entityUri);

    try {
      Query q = QueryFactory.create(query);
      Model result = connection.queryConstruct(q);
      return result.isEmpty() ? null : result;
    } catch (Exception e) {
      LOG.error("Failed to get entity from Fuseki", e);
      return null;
    }
  }

  @Override
  public void deleteEntity(String entityType, UUID entityId) {
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
    } catch (Exception e) {
      LOG.error("Failed to delete entity from Fuseki", e);
      throw new RuntimeException("Failed to delete entity from RDF", e);
    }
  }

  @Override
  public String executeSparqlQuery(String sparqlQuery, String format) {
    try {
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
    } catch (Exception e) {
      LOG.error("Failed to execute SPARQL query on Fuseki", e);
      throw new RuntimeException("Failed to execute SPARQL query", e);
    }
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
    try {
      UpdateRequest request = UpdateFactory.create(sparqlUpdate);
      connection.update(request);
      LOG.debug("Executed SPARQL update on Fuseki");
    } catch (Exception e) {
      LOG.error("Failed to execute SPARQL update on Fuseki", e);
      throw new RuntimeException("Failed to execute SPARQL update", e);
    }
  }

  @Override
  public void loadTurtleFile(java.io.InputStream turtleStream, String graphUri) {
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
    } catch (Exception e) {
      LOG.error("Failed to load Turtle file into Fuseki", e);
      throw new RuntimeException("Failed to load Turtle file", e);
    }
  }

  @Override
  public List<String> getAllGraphs() {
    String query = "SELECT DISTINCT ?g WHERE { GRAPH ?g { ?s ?p ?o } }";
    List<String> graphs = new ArrayList<>();

    try (QueryExecution qexec = connection.query(query)) {
      ResultSet results = qexec.execSelect();
      results.forEachRemaining(
          qs -> {
            String graphUri = qs.getResource("g").getURI();
            graphs.add(graphUri);
          });
    }

    return graphs;
  }

  @Override
  public long getTripleCount() {
    String query = "SELECT (COUNT(*) as ?count) WHERE { GRAPH ?g { ?s ?p ?o } }";

    try (QueryExecution qexec = connection.query(query)) {
      ResultSet results = qexec.execSelect();
      if (results.hasNext()) {
        return results.next().getLiteral("count").getLong();
      }
    }

    return 0;
  }

  @Override
  public void clearGraph(String graphUri) {
    try {
      connection.delete(graphUri);
      LOG.info("Cleared graph: {}", graphUri);
    } catch (Exception e) {
      LOG.error("Failed to clear graph on Fuseki", e);
      throw new RuntimeException("Failed to clear graph", e);
    }
  }

  @Override
  public boolean testConnection() {
    try {
      // Try a simple ASK query
      String testQuery = "ASK { ?s ?p ?o }";
      connection.queryAsk(testQuery);
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
