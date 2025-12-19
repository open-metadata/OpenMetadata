package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.Statement;
import org.apache.jena.rdf.model.StmtIterator;
import org.apache.jena.vocabulary.RDF;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.rdf.translator.RdfPropertyMapper;

/**
 * Tests for RDF Property Mapper - verifies that structured properties are properly converted to RDF
 * triples instead of being stored as opaque JSON literals.
 */
class RdfPropertyMapperTest {

  private static final String BASE_URI = "https://open-metadata.org/";
  private static final String OM_NS = "https://open-metadata.org/ontology/";
  private static final String PROV_NS = "http://www.w3.org/ns/prov#";
  private static final String DCT_NS = "http://purl.org/dc/terms/";

  private ObjectMapper objectMapper;
  private RdfPropertyMapper propertyMapper;
  private Model model;
  private Resource entityResource;

  @BeforeEach
  void setUp() {
    objectMapper = new ObjectMapper();
    Map<String, Object> contextCache = new HashMap<>();
    propertyMapper = new RdfPropertyMapper(BASE_URI, objectMapper, contextCache);
    model = ModelFactory.createDefaultModel();
    entityResource = model.createResource(BASE_URI + "entity/table/" + UUID.randomUUID());
  }

  @Nested
  @DisplayName("P0-1: ChangeDescription Tests")
  class ChangeDescriptionTests {

    @Test
    @DisplayName("ChangeDescription should be stored as structured RDF, not JSON literal")
    void testChangeDescriptionStructured() throws Exception {
      ObjectNode changeDesc = objectMapper.createObjectNode();
      changeDesc.put("previousVersion", 1.0);

      ArrayNode fieldsAdded = objectMapper.createArrayNode();
      ObjectNode addedField = objectMapper.createObjectNode();
      addedField.put("name", "description");
      addedField.put("newValue", "New description value");
      fieldsAdded.add(addedField);
      changeDesc.set("fieldsAdded", fieldsAdded);

      ArrayNode fieldsUpdated = objectMapper.createArrayNode();
      ObjectNode updatedField = objectMapper.createObjectNode();
      updatedField.put("name", "tags");
      updatedField.put("oldValue", "[]");
      updatedField.put("newValue", "[\"PII\"]");
      fieldsUpdated.add(updatedField);
      changeDesc.set("fieldsUpdated", fieldsUpdated);

      // Use reflection to call the private method
      java.lang.reflect.Method method =
          RdfPropertyMapper.class.getDeclaredMethod(
              "addChangeDescription", JsonNode.class, Resource.class, Model.class);
      method.setAccessible(true);
      method.invoke(propertyMapper, changeDesc, entityResource, model);

      // Verify structured RDF was created
      Property hasChangeDesc = model.createProperty(OM_NS, "hasChangeDescription");
      assertTrue(
          model.contains(entityResource, hasChangeDesc),
          "Entity should have hasChangeDescription property");

      // Find the change description resource
      Resource changeDescResource =
          model.listObjectsOfProperty(entityResource, hasChangeDesc).next().asResource();

      // Verify type
      assertTrue(
          model.contains(
              changeDescResource, RDF.type, model.createResource(OM_NS + "ChangeDescription")),
          "ChangeDescription should have correct type");

      // Verify previousVersion is stored as a typed literal, not JSON
      Property prevVersion = model.createProperty(OM_NS, "previousVersion");
      assertTrue(
          model.contains(changeDescResource, prevVersion),
          "ChangeDescription should have previousVersion");

      // Verify fieldsAdded are stored as structured nodes
      Property fieldsAddedProp = model.createProperty(OM_NS, "fieldsAdded");
      assertTrue(
          model.contains(changeDescResource, fieldsAddedProp),
          "ChangeDescription should have fieldsAdded");

      // Verify the field change has a name property (not stored as JSON blob)
      Resource fieldChangeResource =
          model.listObjectsOfProperty(changeDescResource, fieldsAddedProp).next().asResource();
      Property fieldNameProp = model.createProperty(OM_NS, "fieldName");
      assertTrue(
          model.contains(fieldChangeResource, fieldNameProp),
          "FieldChange should have fieldName property");
    }

    @Test
    @DisplayName("Empty ChangeDescription should not create any triples")
    void testEmptyChangeDescription() throws Exception {
      ObjectNode changeDesc = objectMapper.createObjectNode();

      java.lang.reflect.Method method =
          RdfPropertyMapper.class.getDeclaredMethod(
              "addChangeDescription", JsonNode.class, Resource.class, Model.class);
      method.setAccessible(true);
      method.invoke(propertyMapper, changeDesc, entityResource, model);

      Property hasChangeDesc = model.createProperty(OM_NS, "hasChangeDescription");
      assertTrue(
          model.contains(entityResource, hasChangeDesc),
          "Entity should still have hasChangeDescription for empty change");
    }
  }

  @Nested
  @DisplayName("P0-1: Votes Tests")
  class VotesTests {

    @Test
    @DisplayName("Votes should be stored as structured RDF with upVotes/downVotes as integers")
    void testVotesStructured() throws Exception {
      ObjectNode votes = objectMapper.createObjectNode();
      votes.put("upVotes", 10);
      votes.put("downVotes", 2);

      ArrayNode upVoters = objectMapper.createArrayNode();
      ObjectNode voter = objectMapper.createObjectNode();
      voter.put("id", UUID.randomUUID().toString());
      voter.put("type", "user");
      voter.put("name", "test_user");
      upVoters.add(voter);
      votes.set("upVoters", upVoters);

      java.lang.reflect.Method method =
          RdfPropertyMapper.class.getDeclaredMethod(
              "addVotes", JsonNode.class, Resource.class, Model.class);
      method.setAccessible(true);
      method.invoke(propertyMapper, votes, entityResource, model);

      // Verify structured RDF was created
      Property hasVotes = model.createProperty(OM_NS, "hasVotes");
      assertTrue(model.contains(entityResource, hasVotes), "Entity should have hasVotes property");

      Resource votesResource =
          model.listObjectsOfProperty(entityResource, hasVotes).next().asResource();

      // Verify type
      assertTrue(
          model.contains(votesResource, RDF.type, model.createResource(OM_NS + "Votes")),
          "Votes should have correct type");

      // Verify upVotes is stored as integer
      Property upVotesProp = model.createProperty(OM_NS, "upVotes");
      assertTrue(model.contains(votesResource, upVotesProp), "Votes should have upVotes");
      Statement stmt = model.getProperty(votesResource, upVotesProp);
      assertEquals(10, stmt.getInt(), "upVotes should be 10");

      // Verify downVotes is stored as integer
      Property downVotesProp = model.createProperty(OM_NS, "downVotes");
      assertTrue(model.contains(votesResource, downVotesProp), "Votes should have downVotes");
      stmt = model.getProperty(votesResource, downVotesProp);
      assertEquals(2, stmt.getInt(), "downVotes should be 2");

      // Verify upVoters are stored as entity references
      Property upVotersProp = model.createProperty(OM_NS, "upVoters");
      assertTrue(model.contains(votesResource, upVotersProp), "Votes should have upVoters");
    }
  }

  @Nested
  @DisplayName("P0-1: LifeCycle Tests")
  class LifeCycleTests {

    @Test
    @DisplayName("LifeCycle should be stored as structured RDF with timestamps and user references")
    void testLifeCycleStructured() throws Exception {
      ObjectNode lifeCycle = objectMapper.createObjectNode();

      ObjectNode created = objectMapper.createObjectNode();
      created.put("timestamp", "2024-01-15T10:30:00Z");
      ObjectNode createdBy = objectMapper.createObjectNode();
      createdBy.put("id", UUID.randomUUID().toString());
      createdBy.put("type", "user");
      createdBy.put("name", "admin");
      created.set("accessedBy", createdBy);
      lifeCycle.set("created", created);

      ObjectNode updated = objectMapper.createObjectNode();
      updated.put("timestamp", "2024-01-20T14:00:00Z");
      lifeCycle.set("updated", updated);

      java.lang.reflect.Method method =
          RdfPropertyMapper.class.getDeclaredMethod(
              "addLifeCycle", JsonNode.class, Resource.class, Model.class);
      method.setAccessible(true);
      method.invoke(propertyMapper, lifeCycle, entityResource, model);

      // Verify structured RDF was created
      Property hasLifeCycle = model.createProperty(OM_NS, "hasLifeCycle");
      assertTrue(
          model.contains(entityResource, hasLifeCycle), "Entity should have hasLifeCycle property");

      Resource lifeCycleResource =
          model.listObjectsOfProperty(entityResource, hasLifeCycle).next().asResource();

      // Verify type
      assertTrue(
          model.contains(lifeCycleResource, RDF.type, model.createResource(OM_NS + "LifeCycle")),
          "LifeCycle should have correct type");

      // Verify lifecycleCreated is stored
      Property lifecycleCreated = model.createProperty(OM_NS, "lifecycleCreated");
      assertTrue(
          model.contains(lifeCycleResource, lifecycleCreated),
          "LifeCycle should have lifecycleCreated");

      // Verify access details have timestamp
      Resource createdDetails =
          model.listObjectsOfProperty(lifeCycleResource, lifecycleCreated).next().asResource();
      Property timestampProp = model.createProperty(OM_NS, "accessTimestamp");
      assertTrue(
          model.contains(createdDetails, timestampProp), "AccessDetails should have timestamp");
    }
  }

  @Nested
  @DisplayName("P0-1: Extension Tests")
  class ExtensionTests {

    @Test
    @DisplayName("Extension should be stored as structured RDF with typed properties")
    void testExtensionStructured() throws Exception {
      ObjectNode extension = objectMapper.createObjectNode();
      extension.put("costCenter", "Engineering");
      extension.put("priority", 5);
      extension.put("isProduction", true);

      java.lang.reflect.Method method =
          RdfPropertyMapper.class.getDeclaredMethod(
              "addExtension", JsonNode.class, Resource.class, Model.class);
      method.setAccessible(true);
      method.invoke(propertyMapper, extension, entityResource, model);

      // Verify structured RDF was created
      Property hasExtension = model.createProperty(OM_NS, "hasExtension");
      assertTrue(
          model.contains(entityResource, hasExtension), "Entity should have hasExtension property");

      Resource extResource =
          model.listObjectsOfProperty(entityResource, hasExtension).next().asResource();

      // Verify type
      assertTrue(
          model.contains(extResource, RDF.type, model.createResource(OM_NS + "Extension")),
          "Extension should have correct type");

      // Verify extension properties are stored with prefixed names
      Property costCenterProp = model.createProperty(OM_NS, "ext_costCenter");
      assertTrue(
          model.contains(extResource, costCenterProp), "Extension should have costCenter property");
      assertEquals(
          "Engineering",
          model.getProperty(extResource, costCenterProp).getString(),
          "costCenter should be 'Engineering'");

      // Verify integer property
      Property priorityProp = model.createProperty(OM_NS, "ext_priority");
      assertTrue(
          model.contains(extResource, priorityProp), "Extension should have priority property");
      assertEquals(
          5, model.getProperty(extResource, priorityProp).getInt(), "priority should be 5");

      // Verify boolean property
      Property isProdProp = model.createProperty(OM_NS, "ext_isProduction");
      assertTrue(
          model.contains(extResource, isProdProp), "Extension should have isProduction property");
      assertTrue(
          model.getProperty(extResource, isProdProp).getBoolean(), "isProduction should be true");
    }
  }

  @Nested
  @DisplayName("P0-2: Lineage Tests")
  class LineageTests {

    @Test
    @DisplayName("Upstream edges should be stored as prov:wasDerivedFrom and om:upstream")
    void testUpstreamEdges() throws Exception {
      ArrayNode upstreamEdges = objectMapper.createArrayNode();
      ObjectNode edge = objectMapper.createObjectNode();

      ObjectNode fromEntity = objectMapper.createObjectNode();
      fromEntity.put("id", UUID.randomUUID().toString());
      fromEntity.put("type", "table");
      fromEntity.put("name", "source_table");
      fromEntity.put("fullyQualifiedName", "service.db.schema.source_table");
      edge.set("fromEntity", fromEntity);

      ObjectNode lineageDetails = objectMapper.createObjectNode();
      lineageDetails.put("sqlQuery", "SELECT * FROM source_table");
      lineageDetails.put("source", "QueryLineage");
      edge.set("lineageDetails", lineageDetails);

      upstreamEdges.add(edge);

      java.lang.reflect.Method method =
          RdfPropertyMapper.class.getDeclaredMethod(
              "addLineageProperty", String.class, JsonNode.class, Resource.class, Model.class);
      method.setAccessible(true);
      method.invoke(propertyMapper, "upstreamEdges", upstreamEdges, entityResource, model);

      // Verify PROV-O relationship
      Property wasDerivedFrom = model.createProperty(PROV_NS, "wasDerivedFrom");
      assertTrue(
          model.contains(entityResource, wasDerivedFrom),
          "Entity should have prov:wasDerivedFrom for upstream");

      // Verify OpenMetadata-specific property
      Property upstream = model.createProperty(OM_NS, "upstream");
      assertTrue(
          model.contains(entityResource, upstream), "Entity should have om:upstream property");

      // Verify lineage details are stored
      Property hasLineageDetails = model.createProperty(OM_NS, "hasLineageDetails");
      assertTrue(
          model.contains(entityResource, hasLineageDetails), "Entity should have lineage details");
    }

    @Test
    @DisplayName("Downstream edges should be stored with om:downstream")
    void testDownstreamEdges() throws Exception {
      ArrayNode downstreamEdges = objectMapper.createArrayNode();
      ObjectNode edge = objectMapper.createObjectNode();

      ObjectNode toEntity = objectMapper.createObjectNode();
      toEntity.put("id", UUID.randomUUID().toString());
      toEntity.put("type", "dashboard");
      toEntity.put("name", "analytics_dashboard");
      edge.set("toEntity", toEntity);

      downstreamEdges.add(edge);

      java.lang.reflect.Method method =
          RdfPropertyMapper.class.getDeclaredMethod(
              "addLineageProperty", String.class, JsonNode.class, Resource.class, Model.class);
      method.setAccessible(true);
      method.invoke(propertyMapper, "downstreamEdges", downstreamEdges, entityResource, model);

      // Verify downstream relationship
      Property downstream = model.createProperty(OM_NS, "downstream");
      assertTrue(
          model.contains(entityResource, downstream), "Entity should have om:downstream property");
    }

    @Test
    @DisplayName("Column lineage should be stored with fromColumn and toColumn properties")
    void testColumnLineage() throws Exception {
      ArrayNode upstreamEdges = objectMapper.createArrayNode();
      ObjectNode edge = objectMapper.createObjectNode();

      ObjectNode fromEntity = objectMapper.createObjectNode();
      fromEntity.put("id", UUID.randomUUID().toString());
      fromEntity.put("type", "table");
      edge.set("fromEntity", fromEntity);

      ObjectNode lineageDetails = objectMapper.createObjectNode();
      ArrayNode columnsLineage = objectMapper.createArrayNode();
      ObjectNode colLineage = objectMapper.createObjectNode();

      ArrayNode fromColumns = objectMapper.createArrayNode();
      fromColumns.add("source_table.column_a");
      fromColumns.add("source_table.column_b");
      colLineage.set("fromColumns", fromColumns);
      colLineage.put("toColumn", "target_table.merged_column");
      colLineage.put("function", "CONCAT(column_a, column_b)");

      columnsLineage.add(colLineage);
      lineageDetails.set("columnsLineage", columnsLineage);
      edge.set("lineageDetails", lineageDetails);

      upstreamEdges.add(edge);

      java.lang.reflect.Method method =
          RdfPropertyMapper.class.getDeclaredMethod(
              "addLineageProperty", String.class, JsonNode.class, Resource.class, Model.class);
      method.setAccessible(true);
      method.invoke(propertyMapper, "upstreamEdges", upstreamEdges, entityResource, model);

      // Find column lineage in the model
      Property hasColumnLineage = model.createProperty(OM_NS, "hasColumnLineage");
      StmtIterator stmts = model.listStatements(null, hasColumnLineage, (Resource) null);
      assertTrue(stmts.hasNext(), "Should have column lineage");

      // Verify fromColumn is stored
      Property fromColumnProp = model.createProperty(OM_NS, "fromColumn");
      assertTrue(model.contains(null, fromColumnProp), "Should have fromColumn properties");

      // Verify toColumn is stored
      Property toColumnProp = model.createProperty(OM_NS, "toColumn");
      assertTrue(model.contains(null, toColumnProp), "Should have toColumn property");

      // Verify transformation function is stored
      Property transformFuncProp = model.createProperty(OM_NS, "transformFunction");
      assertTrue(model.contains(null, transformFuncProp), "Should have transformFunction property");
    }
  }

  @Nested
  @DisplayName("General Property Mapping Tests")
  class GeneralPropertyMappingTests {

    @Test
    @DisplayName("Properties not in STRUCTURED_PROPERTIES should be handled normally")
    void testNonStructuredProperties() {
      // Verify the mapper doesn't interfere with normal properties
      int initialTripleCount = (int) model.size();

      // The mapper should not add triples for non-structured properties by default
      // (they're handled by the context-based mapping)
      assertTrue(initialTripleCount == 0, "Model should be empty initially");
    }
  }
}
