package org.openmetadata.service.rdf.storage;

import java.io.ByteArrayOutputStream;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.List;
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

  private static final String DEFAULT_GRAPH = "https://open-metadata.org/graph/default";
  private static final String METADATA_GRAPH = "https://open-metadata.org/graph/metadata";

  private final RDFConnection connection;
  private final String baseUri;
  private final String endpoint;

  public JenaFusekiStorage(RdfConfiguration config) {
    this.baseUri =
        config.getBaseUri() != null ? config.getBaseUri().toString() : "https://open-metadata.org/";

    // Default to Kubernetes service name if no endpoint specified
    this.endpoint =
        config.getRemoteEndpoint() != null && !config.getRemoteEndpoint().toString().isEmpty()
            ? config.getRemoteEndpoint().toString()
            : "http://openmetadata-fuseki:3030/openmetadata";

    // Create connection with authentication if provided
    if (config.getUsername() != null && config.getPassword() != null) {
      // Create authenticated connection using Java 11 HttpClient
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

    // Load ontology on startup
    loadOntology();
  }

  private void loadOntology() {
    try {
      Model ontologyModel = ModelFactory.createDefaultModel();
      RDFDataMgr.read(
          ontologyModel,
          getClass().getResourceAsStream("/rdf/ontology/openmetadata-complete.ttl"),
          org.apache.jena.riot.Lang.TURTLE);

      // Upload ontology to remote server
      connection.load(METADATA_GRAPH, ontologyModel);
      LOG.info("Loaded OpenMetadata ontology to Fuseki");
    } catch (Exception e) {
      LOG.warn("Failed to load ontology to Fuseki (may already exist)", e);
    }
  }

  @Override
  public void storeEntity(String entityType, UUID entityId, Model entityModel) {
    String graphUri = baseUri + "graph/" + entityType;

    try {
      // Clear existing data for this entity
      String entityUri = baseUri + "entity/" + entityType + "/" + entityId;
      String deleteQuery =
          String.format("DELETE WHERE { GRAPH <%s> { <%s> ?p ?o } }", graphUri, entityUri);

      UpdateRequest deleteRequest = UpdateFactory.create(deleteQuery);
      connection.update(deleteRequest);

      // Load new data
      connection.load(graphUri, entityModel);
      LOG.debug("Stored entity {} in graph {}", entityId, graphUri);
    } catch (Exception e) {
      LOG.error("Failed to store entity in Fuseki", e);
      throw new RuntimeException("Failed to store entity in RDF", e);
    }
  }

  @Override
  public void storeRelationship(
      String fromType, UUID fromId, String toType, UUID toId, String relationshipType) {

    String updateQuery =
        String.format(
            "PREFIX om: <%sontology/> "
                + "INSERT DATA { "
                + "  GRAPH <%s> { "
                + "    <%sentity/%s/%s> om:%s <%sentity/%s/%s> . "
                + "  } "
                + "}",
            baseUri,
            DEFAULT_GRAPH,
            baseUri,
            fromType,
            fromId,
            relationshipType,
            baseUri,
            toType,
            toId);

    try {
      UpdateRequest request = UpdateFactory.create(updateQuery);
      connection.update(request);
      LOG.debug("Stored relationship: {} -{}- {}", fromId, relationshipType, toId);
    } catch (Exception e) {
      LOG.error("Failed to store relationship in Fuseki", e);
      throw new RuntimeException("Failed to store relationship in RDF", e);
    }
  }

  @Override
  public void bulkStoreRelationships(List<RelationshipData> relationships) {
    StringBuilder insertData = new StringBuilder();
    insertData.append("PREFIX om: <").append(baseUri).append("ontology/> ");
    insertData.append("INSERT DATA { GRAPH <").append(DEFAULT_GRAPH).append("> { ");

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
      UpdateRequest request = UpdateFactory.create(insertData.toString());
      connection.update(request);
      LOG.info("Bulk stored {} relationships", relationships.size());
    } catch (Exception e) {
      LOG.error("Failed to bulk store relationships in Fuseki", e);
      throw new RuntimeException("Failed to bulk store relationships in RDF", e);
    }
  }

  @Override
  public Model getEntity(String entityType, UUID entityId) {
    String graphUri = baseUri + "graph/" + entityType;
    String entityUri = baseUri + "entity/" + entityType + "/" + entityId;

    String query =
        String.format(
            "CONSTRUCT { ?s ?p ?o } WHERE { GRAPH <%s> { <%s> ?p ?o . BIND(<%s> as ?s) } }",
            graphUri, entityUri, entityUri);

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
    String graphUri = baseUri + "graph/" + entityType;
    String entityUri = baseUri + "entity/" + entityType + "/" + entityId;

    // Delete entity from its graph and all relationships
    String deleteQuery =
        String.format(
            "DELETE WHERE { GRAPH <%s> { <%s> ?p ?o } }; "
                + "DELETE WHERE { GRAPH ?g { ?s ?p <%s> } }; "
                + "DELETE WHERE { GRAPH ?g { <%s> ?p ?o } }",
            graphUri, entityUri, entityUri, entityUri);

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
              ByteArrayOutputStream out = new ByteArrayOutputStream();
              ResultSetFormatter.outputAsJSON(out, results);
              return out.toString();
            case "xml":
              return ResultSetFormatter.asXMLString(results);
            case "csv":
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
        // Return standard SPARQL JSON format for ASK queries
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
