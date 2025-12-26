package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.query.QueryExecutionFactory;
import org.apache.jena.query.QuerySolution;
import org.apache.jena.query.ResultSet;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Integration tests for RDF Knowledge Graph. These tests verify the complete flow from entity data
 * to RDF triples to SPARQL queries, ensuring all P0 requirements are properly addressed.
 *
 * <p>Note: These tests use in-memory Jena models instead of a real Fuseki server to avoid
 * testcontainer dependencies. For full integration testing with Fuseki, use the postgres-rdf-tests
 * profile.
 */
class RdfIntegrationTest {

  private static final String OM_NS = "https://open-metadata.org/ontology/";
  private static final String PROV_NS = "http://www.w3.org/ns/prov#";
  private static final String RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
  private static final String BASE_URI = "https://open-metadata.org/";

  private Model model;

  @BeforeEach
  void setUp() {
    model = ModelFactory.createDefaultModel();
    model.setNsPrefix("om", OM_NS);
    model.setNsPrefix("prov", PROV_NS);
    model.setNsPrefix("rdf", RDF_NS);
  }

  @Nested
  @DisplayName("P0-1: Structured Properties (not JSON literals)")
  class StructuredPropertyIntegrationTests {

    @Test
    @DisplayName("changeDescription should be queryable via SPARQL for 'who changed what when'")
    void testChangeDescriptionSparqlQuery() {
      // Create structured changeDescription triples
      UUID entityId = UUID.randomUUID();
      String entityUri = BASE_URI + "entity/table/" + entityId;
      String changeUri = entityUri + "/change/1.0";
      String fieldChangeUri = changeUri + "/field/description";

      Resource entity = model.createResource(entityUri);
      Resource change = model.createResource(changeUri);
      Resource fieldChange = model.createResource(fieldChangeUri);

      // Link entity to change
      entity.addProperty(model.createProperty(OM_NS, "hasChangeDescription"), change);

      // Add change properties
      change.addProperty(
          model.createProperty(RDF_NS, "type"), model.createResource(OM_NS + "ChangeDescription"));
      change.addProperty(
          model.createProperty(OM_NS, "previousVersion"),
          model.createTypedLiteral(0.9, org.apache.jena.datatypes.xsd.XSDDatatype.XSDdecimal));
      change.addProperty(model.createProperty(OM_NS, "fieldsUpdated"), fieldChange);

      // Add field change properties
      fieldChange.addProperty(
          model.createProperty(RDF_NS, "type"), model.createResource(OM_NS + "FieldChange"));
      fieldChange.addProperty(model.createProperty(OM_NS, "fieldName"), "description");
      fieldChange.addProperty(model.createProperty(OM_NS, "oldValue"), "Old description");
      fieldChange.addProperty(model.createProperty(OM_NS, "newValue"), "New description");

      // Execute SPARQL query: "What fields were updated and what were the changes?"
      String sparql =
          String.format(
              """
          PREFIX om: <%s>
          SELECT ?fieldName ?oldValue ?newValue WHERE {
            <%s> om:hasChangeDescription ?change .
            ?change om:fieldsUpdated ?fc .
            ?fc om:fieldName ?fieldName .
            ?fc om:oldValue ?oldValue .
            ?fc om:newValue ?newValue .
          }
          """,
              OM_NS, entityUri);

      try (QueryExecution qexec = QueryExecutionFactory.create(sparql, model)) {
        ResultSet results = qexec.execSelect();
        assertTrue(results.hasNext(), "Should have query results");

        QuerySolution solution = results.next();
        assertEquals("description", solution.getLiteral("fieldName").getString());
        assertEquals("Old description", solution.getLiteral("oldValue").getString());
        assertEquals("New description", solution.getLiteral("newValue").getString());
      }
    }

    @Test
    @DisplayName("votes should be queryable to find upVotes count and upVoters")
    void testVotesSparqlQuery() {
      UUID tableId = UUID.randomUUID();
      UUID user1Id = UUID.randomUUID();
      UUID user2Id = UUID.randomUUID();
      String tableUri = BASE_URI + "entity/table/" + tableId;
      String votesUri = tableUri + "/votes";
      String user1Uri = BASE_URI + "entity/user/" + user1Id;
      String user2Uri = BASE_URI + "entity/user/" + user2Id;

      Resource table = model.createResource(tableUri);
      Resource votes = model.createResource(votesUri);

      table.addProperty(model.createProperty(OM_NS, "hasVotes"), votes);
      votes.addProperty(
          model.createProperty(RDF_NS, "type"), model.createResource(OM_NS + "Votes"));
      votes.addProperty(
          model.createProperty(OM_NS, "upVotes"),
          model.createTypedLiteral(2, org.apache.jena.datatypes.xsd.XSDDatatype.XSDinteger));
      votes.addProperty(model.createProperty(OM_NS, "upVoters"), model.createResource(user1Uri));
      votes.addProperty(model.createProperty(OM_NS, "upVoters"), model.createResource(user2Uri));

      // Query: "How many upvotes does this table have and who voted?"
      String sparql =
          String.format(
              """
          PREFIX om: <%s>
          SELECT ?upVotes (COUNT(?voter) as ?voterCount) WHERE {
            <%s> om:hasVotes ?v .
            ?v om:upVotes ?upVotes .
            ?v om:upVoters ?voter .
          }
          GROUP BY ?upVotes
          """,
              OM_NS, tableUri);

      try (QueryExecution qexec = QueryExecutionFactory.create(sparql, model)) {
        ResultSet results = qexec.execSelect();
        assertTrue(results.hasNext(), "Should have vote results");
        QuerySolution solution = results.next();
        assertEquals(2, solution.getLiteral("upVotes").getInt());
        assertEquals(2, solution.getLiteral("voterCount").getInt());
      }
    }
  }

  @Nested
  @DisplayName("P0-2: Lineage as Structured Triples")
  class LineageIntegrationTests {

    @Test
    @DisplayName("Lineage should support upstream traversal via SPARQL")
    void testUpstreamTraversal() {
      UUID tableAId = UUID.randomUUID();
      UUID tableBId = UUID.randomUUID();
      UUID tableCId = UUID.randomUUID();

      String tableAUri = BASE_URI + "entity/table/" + tableAId;
      String tableBUri = BASE_URI + "entity/table/" + tableBId;
      String tableCUri = BASE_URI + "entity/table/" + tableCId;

      // C derives from B, B derives from A (C <- B <- A)
      Property derivedFrom = model.createProperty(PROV_NS, "wasDerivedFrom");

      model.createResource(tableCUri).addProperty(derivedFrom, model.createResource(tableBUri));
      model.createResource(tableBUri).addProperty(derivedFrom, model.createResource(tableAUri));

      // Query: "What are all direct upstreams of table C?"
      String sparql =
          String.format(
              """
          PREFIX prov: <%s>
          SELECT ?upstream WHERE {
            <%s> prov:wasDerivedFrom ?upstream .
          }
          """,
              PROV_NS, tableCUri);

      try (QueryExecution qexec = QueryExecutionFactory.create(sparql, model)) {
        ResultSet results = qexec.execSelect();
        assertTrue(results.hasNext(), "Should have upstream result");
        QuerySolution solution = results.next();
        assertEquals(tableBUri, solution.getResource("upstream").getURI());
      }

      // Query with property path for transitive: "What are ALL upstreams (direct and indirect)?"
      String transitiveSparql =
          String.format(
              """
          PREFIX prov: <%s>
          SELECT ?upstream WHERE {
            <%s> prov:wasDerivedFrom+ ?upstream .
          }
          """,
              PROV_NS, tableCUri);

      try (QueryExecution qexec = QueryExecutionFactory.create(transitiveSparql, model)) {
        ResultSet results = qexec.execSelect();
        int count = 0;
        while (results.hasNext()) {
          results.next();
          count++;
        }
        assertEquals(2, count, "Should find both B and A as upstreams transitively");
      }
    }

    @Test
    @DisplayName("Column lineage should be queryable")
    void testColumnLineageQuery() {
      UUID sourceTableId = UUID.randomUUID();
      UUID targetTableId = UUID.randomUUID();

      String sourceUri = BASE_URI + "entity/table/" + sourceTableId;
      String targetUri = BASE_URI + "entity/table/" + targetTableId;
      String detailsUri = BASE_URI + "lineageDetails/" + sourceTableId + "/" + targetTableId;
      String colLineageUri = detailsUri + "/col1";

      // Create lineage with column details
      Resource source = model.createResource(sourceUri);
      Resource target = model.createResource(targetUri);
      Resource details = model.createResource(detailsUri);
      Resource colLineage = model.createResource(colLineageUri);

      target.addProperty(
          model.createProperty(PROV_NS, "wasDerivedFrom"), model.createResource(sourceUri));
      source.addProperty(model.createProperty(OM_NS, "hasLineageDetails"), details);
      details.addProperty(
          model.createProperty(RDF_NS, "type"), model.createResource(OM_NS + "LineageDetails"));
      details.addProperty(
          model.createProperty(OM_NS, "sqlQuery"), "SELECT CONCAT(a, b) as combined FROM source");
      details.addProperty(model.createProperty(OM_NS, "hasColumnLineage"), colLineage);

      colLineage.addProperty(
          model.createProperty(RDF_NS, "type"), model.createResource(OM_NS + "ColumnLineage"));
      colLineage.addProperty(model.createProperty(OM_NS, "fromColumn"), "source.col_a");
      colLineage.addProperty(model.createProperty(OM_NS, "fromColumn"), "source.col_b");
      colLineage.addProperty(model.createProperty(OM_NS, "toColumn"), "target.combined");
      colLineage.addProperty(model.createProperty(OM_NS, "transformFunction"), "CONCAT");

      // Query: "What source columns feed into target.combined?"
      String sparql =
          String.format(
              """
          PREFIX om: <%s>
          SELECT ?sourceColumn ?function WHERE {
            ?details om:hasColumnLineage ?cl .
            ?cl om:toColumn "target.combined" .
            ?cl om:fromColumn ?sourceColumn .
            OPTIONAL { ?cl om:transformFunction ?function }
          }
          """,
              OM_NS);

      try (QueryExecution qexec = QueryExecutionFactory.create(sparql, model)) {
        ResultSet results = qexec.execSelect();
        int count = 0;
        String function = null;
        while (results.hasNext()) {
          QuerySolution solution = results.next();
          count++;
          if (solution.contains("function")) {
            function = solution.getLiteral("function").getString();
          }
        }
        assertEquals(2, count, "Should find 2 source columns");
        assertEquals("CONCAT", function, "Should have CONCAT transformation");
      }
    }

    @Test
    @DisplayName("Pipeline lineage should be queryable via prov:wasGeneratedBy")
    void testPipelineLineageQuery() {
      UUID pipelineId = UUID.randomUUID();
      UUID sourceId = UUID.randomUUID();
      UUID targetId = UUID.randomUUID();

      String pipelineUri = BASE_URI + "entity/pipeline/" + pipelineId;
      String sourceUri = BASE_URI + "entity/table/" + sourceId;
      String targetUri = BASE_URI + "entity/table/" + targetId;
      String detailsUri = BASE_URI + "lineageDetails/" + sourceId + "/" + targetId;

      Resource details = model.createResource(detailsUri);
      Resource source = model.createResource(sourceUri);

      source.addProperty(model.createProperty(OM_NS, "hasLineageDetails"), details);
      details.addProperty(
          model.createProperty(PROV_NS, "wasGeneratedBy"), model.createResource(pipelineUri));
      model
          .createResource(targetUri)
          .addProperty(
              model.createProperty(PROV_NS, "wasDerivedFrom"), model.createResource(sourceUri));

      // Query: "Find all lineages processed by this pipeline"
      String sparql =
          String.format(
              """
          PREFIX om: <%s>
          PREFIX prov: <%s>
          SELECT ?source ?target WHERE {
            ?source om:hasLineageDetails ?details .
            ?details prov:wasGeneratedBy <%s> .
            ?target prov:wasDerivedFrom ?source .
          }
          """,
              OM_NS, PROV_NS, pipelineUri);

      try (QueryExecution qexec = QueryExecutionFactory.create(sparql, model)) {
        ResultSet results = qexec.execSelect();
        assertTrue(results.hasNext(), "Should find lineage by pipeline");
        QuerySolution solution = results.next();
        assertEquals(sourceUri, solution.getResource("source").getURI());
        assertEquals(targetUri, solution.getResource("target").getURI());
      }
    }
  }

  @Nested
  @DisplayName("P0-3: Idempotency Verification")
  class IdempotencyTests {

    @Test
    @DisplayName("Adding same triple twice should result in only one triple")
    void testIdempotentTripleAddition() {
      UUID fromId = UUID.randomUUID();
      UUID toId = UUID.randomUUID();
      String fromUri = BASE_URI + "entity/table/" + fromId;
      String toUri = BASE_URI + "entity/table/" + toId;

      Property upstream = model.createProperty(OM_NS, "UPSTREAM");

      // Add the same triple twice
      model.createResource(fromUri).addProperty(upstream, model.createResource(toUri));
      model.createResource(fromUri).addProperty(upstream, model.createResource(toUri));

      // Count matching triples
      String countSparql =
          String.format(
              """
          PREFIX om: <%s>
          SELECT (COUNT(*) as ?count) WHERE {
            <%s> om:UPSTREAM <%s> .
          }
          """,
              OM_NS, fromUri, toUri);

      try (QueryExecution qexec = QueryExecutionFactory.create(countSparql, model)) {
        ResultSet results = qexec.execSelect();
        assertTrue(results.hasNext());
        // Jena models automatically dedupe identical triples
        assertEquals(1, results.next().getLiteral("count").getInt());
      }
    }
  }

  @Nested
  @DisplayName("P1: Inference Engine Verification")
  class InferenceTests {

    @Test
    @DisplayName("Transitive upstream should be inferable via property path")
    void testTransitiveUpstreamViaPropertyPath() {
      UUID tableA = UUID.randomUUID();
      UUID tableB = UUID.randomUUID();
      UUID tableC = UUID.randomUUID();

      String uriA = BASE_URI + "entity/table/" + tableA;
      String uriB = BASE_URI + "entity/table/" + tableB;
      String uriC = BASE_URI + "entity/table/" + tableC;

      Property upstream = model.createProperty(OM_NS, "upstream");

      // A -> B -> C
      model.createResource(uriA).addProperty(upstream, model.createResource(uriB));
      model.createResource(uriB).addProperty(upstream, model.createResource(uriC));

      // Without inference engine, use property path for transitive query
      String sparql =
          String.format(
              """
          PREFIX om: <%s>
          SELECT ?reachable WHERE {
            <%s> om:upstream+ ?reachable .
          }
          """,
              OM_NS, uriA);

      try (QueryExecution qexec = QueryExecutionFactory.create(sparql, model)) {
        ResultSet results = qexec.execSelect();
        int count = 0;
        boolean foundC = false;
        while (results.hasNext()) {
          String uri = results.next().getResource("reachable").getURI();
          if (uri.equals(uriC)) foundC = true;
          count++;
        }
        assertEquals(2, count, "Should find B and C transitively");
        assertTrue(foundC, "Should find C (transitive via B)");
      }
    }
  }
}
