package org.openmetadata.service.resources.rdf;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.util.TestUtils.*;

import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.databases.TableResourceTest;

public class RdfResourceTest extends OpenMetadataApplicationTest {

  protected WebTarget getWebTarget() {
    return client.target(String.format("http://localhost:%d/api/v1", APP.getLocalPort()));
  }

  @Test
  void testSparqlEndpoint(TestInfo test) throws Exception {
    if (!"true".equals(System.getProperty("enableRdf"))) {
      return; // Skip if RDF is not enabled
    }

    // Create a table to query
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable createTable = tableResourceTest.createRequest(test);
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Test SPARQL SELECT query
    String sparql =
        "PREFIX om: <https://open-metadata.org/ontology/> "
            + "SELECT ?table ?name WHERE { "
            + "  ?table a om:Table ; "
            + "         om:fullyQualifiedName ?name . "
            + "} LIMIT 10";

    Response response =
        getWebTarget()
            .path("rdf/sparql")
            .queryParam("query", sparql)
            .request(MediaType.APPLICATION_JSON)
            .header("Authorization", ADMIN_AUTH_HEADERS.get("Authorization"))
            .get();

    assertEquals(200, response.getStatus());
    Map<String, Object> result = response.readEntity(Map.class);
    assertNotNull(result.get("results"));

    // Verify our table is in the results
    Map<String, Object> results = (Map<String, Object>) result.get("results");
    assertNotNull(results.get("bindings"));
  }

  @Test
  void testJsonLdContentNegotiation(TestInfo test) throws Exception {
    if (!"true".equals(System.getProperty("enableRdf"))) {
      return; // Skip if RDF is not enabled
    }

    // Create a table
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable createTable = tableResourceTest.createRequest(test);
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Get table as JSON-LD
    Response response =
        getWebTarget()
            .path("tables/" + table.getId())
            .request("application/ld+json")
            .header("Authorization", ADMIN_AUTH_HEADERS.get("Authorization"))
            .get();

    assertEquals(200, response.getStatus());
    String jsonLd = response.readEntity(String.class);
    assertNotNull(jsonLd);
    assertTrue(jsonLd.contains("@context"));
    assertTrue(jsonLd.contains(table.getFullyQualifiedName()));
  }

  @Test
  void testRdfXmlContentNegotiation(TestInfo test) throws Exception {
    if (!"true".equals(System.getProperty("enableRdf"))) {
      return; // Skip if RDF is not enabled
    }

    // Create a table
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable createTable = tableResourceTest.createRequest(test);
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Get table as RDF/XML
    Response response =
        getWebTarget()
            .path("tables/" + table.getId())
            .request("application/rdf+xml")
            .header("Authorization", ADMIN_AUTH_HEADERS.get("Authorization"))
            .get();

    assertEquals(200, response.getStatus());
    String rdfXml = response.readEntity(String.class);
    assertNotNull(rdfXml);
    assertTrue(rdfXml.contains("rdf:RDF"));
    assertTrue(rdfXml.contains(table.getFullyQualifiedName()));
  }

  @Test
  void testTurtleContentNegotiation(TestInfo test) throws Exception {
    if (!"true".equals(System.getProperty("enableRdf"))) {
      return; // Skip if RDF is not enabled
    }

    // Create a table
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable createTable = tableResourceTest.createRequest(test);
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Get table as Turtle
    Response response =
        getWebTarget()
            .path("tables/" + table.getId())
            .request("text/turtle")
            .header("Authorization", ADMIN_AUTH_HEADERS.get("Authorization"))
            .get();

    assertEquals(200, response.getStatus());
    String turtle = response.readEntity(String.class);
    assertNotNull(turtle);
    assertTrue(turtle.contains("@prefix"));
    assertTrue(turtle.contains(table.getFullyQualifiedName()));
  }

  @Test
  void testSqlToSparqlTranslation() throws Exception {
    if (!"true".equals(System.getProperty("enableRdf"))) {
      return; // Skip if RDF is not enabled
    }

    // Test SQL to SPARQL translation
    String sql = "SELECT name, description FROM tables WHERE deleted = false";

    Response response =
        getWebTarget()
            .path("rdf/sql2sparql")
            .request(MediaType.APPLICATION_JSON)
            .header("Authorization", ADMIN_AUTH_HEADERS.get("Authorization"))
            .post(Entity.json(Map.of("sql", sql)));

    assertEquals(200, response.getStatus());
    Map<String, String> result = response.readEntity(Map.class);
    assertNotNull(result.get("sparql"));

    // Verify SPARQL contains expected elements
    String sparql = result.get("sparql");
    assertTrue(sparql.contains("SELECT"));
    assertTrue(sparql.contains("?name"));
    assertTrue(sparql.contains("?description"));
    assertTrue(sparql.contains("FILTER"));
  }
}
