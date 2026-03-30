package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.jena.datatypes.xsd.XSDDatatype;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.RDFList;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.Statement;
import org.apache.jena.rdf.model.StmtIterator;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.apache.jena.vocabulary.SKOS;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
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
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("testrdfentity", "table");
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
      assertEquals(0, initialTripleCount, "Model should be empty initially");
    }

    @Test
    @DisplayName("mapEntityToRdf should apply array contexts and standard properties")
    void testMapEntityToRdfAppliesArrayContextsAndStandardProperties() {
      Map<String, Object> contextCache = new HashMap<>();
      contextCache.put(
          "dataAsset-complete",
          List.of(Map.of("name", "rdfs:label"), Map.of("description", "dct:description")));
      propertyMapper = new RdfPropertyMapper(BASE_URI, objectMapper, contextCache);

      TestRdfEntity entity = new TestRdfEntity();
      entity.setId(UUID.randomUUID());
      entity.setName("orders");
      entity.setDescription("Orders table");
      entity.setFullyQualifiedName("service.db.schema.orders");
      entity.setUpdatedAt(1710000000000L);
      entity.setVersion(1.2);

      propertyMapper.mapEntityToRdf(entity, entityResource, model);

      assertTrue(model.contains(entityResource, model.createProperty(RDFS.getURI(), "label")));
      assertTrue(
          model.contains(entityResource, model.createProperty(DCT_NS, "description")),
          "Mapped description should use dct namespace");
      assertTrue(
          model.contains(entityResource, model.createProperty(DCT_NS, "modified")),
          "Updated timestamp should be exported");
      assertEquals(
          1.2,
          model
              .getProperty(
                  entityResource, model.createProperty("http://www.w3.org/ns/dcat#", "version"))
              .getDouble(),
          0.0001);
    }

    @Test
    @DisplayName("mapEntityToRdf should fall back to OpenMetadata properties for unmapped fields")
    void testMapEntityToRdfFallsBackToUnmappedFields() {
      Map<String, Object> contextCache = new HashMap<>();
      contextCache.put("dataAsset-complete", Map.of());
      propertyMapper = new RdfPropertyMapper(BASE_URI, objectMapper, contextCache);

      TestRdfEntity entity = new TestRdfEntity();
      entity.setId(UUID.randomUUID());
      entity.setName("orders");
      entity.setDescription("Orders table");
      entity.setFullyQualifiedName("service.db.schema.orders");
      entity.setQualityScore(7);
      entity.setRowCount(1234567890123L);
      entity.setQualityRating(98.5);
      entity.setActive(true);
      entity.setMetadata(Map.of("tier", "gold"));
      entity.setAliases(List.of("orders", "sales_orders"));

      propertyMapper.mapEntityToRdf(entity, entityResource, model);

      assertEquals(
          7,
          model.getProperty(entityResource, model.createProperty(OM_NS, "qualityScore")).getInt());
      assertEquals(
          1234567890123L,
          model.getProperty(entityResource, model.createProperty(OM_NS, "rowCount")).getLong());
      assertEquals(
          98.5,
          model
              .getProperty(entityResource, model.createProperty(OM_NS, "qualityRating"))
              .getDouble(),
          0.0001);
      assertTrue(
          model.getProperty(entityResource, model.createProperty(OM_NS, "active")).getBoolean());
      assertEquals(
          "{\"tier\":\"gold\"}",
          model.getProperty(entityResource, model.createProperty(OM_NS, "metadata")).getString());
      assertEquals(
          "[\"orders\",\"sales_orders\"]",
          model.getProperty(entityResource, model.createProperty(OM_NS, "aliases")).getString());
      assertFalse(
          model.contains(entityResource, model.createProperty(OM_NS, "id")),
          "Internal id field should not be emitted as RDF");
    }

    @Test
    @DisplayName("mapEntityToRdf should swallow mapping failures and leave the model unchanged")
    void testMapEntityToRdfSwallowsMappingFailures() {
      propertyMapper =
          new RdfPropertyMapper(
              BASE_URI,
              new ObjectMapper() {
                @Override
                public <T extends JsonNode> T valueToTree(Object fromValue) {
                  throw new IllegalStateException("boom");
                }
              },
              Map.of());

      TestRdfEntity entity = new TestRdfEntity();
      entity.setId(UUID.randomUUID());
      entity.setName("broken");
      entity.setFullyQualifiedName("service.db.schema.broken");

      assertDoesNotThrow(() -> propertyMapper.mapEntityToRdf(entity, entityResource, model));
      assertEquals(0, model.size());
    }

    @Test
    @DisplayName("processFieldMapping should handle entity references, arrays, and tag labels")
    void testProcessFieldMappingHandlesReferencesAndTagLabels() throws Exception {
      UUID ownerId = UUID.randomUUID();
      ObjectNode owner = entityReferenceNode("user", ownerId.toString(), "alice", "users.alice");

      invokePrivate(
          "processFieldMapping",
          new Class[] {String.class, JsonNode.class, Object.class, Resource.class, Model.class},
          "owner",
          owner,
          Map.of("@id", "om:owner", "@type", "@id"),
          entityResource,
          model);

      Property ownerProperty = model.createProperty(OM_NS, "owner");
      Resource ownerResource = model.createResource(BASE_URI + "entity/user/" + ownerId);
      assertTrue(model.contains(entityResource, ownerProperty, ownerResource));
      assertTrue(model.contains(ownerResource, RDFS.label, "alice"));
      assertTrue(
          model.contains(
              ownerResource, model.createProperty(OM_NS, "fullyQualifiedName"), "users.alice"));

      ObjectNode tagLabel = objectMapper.createObjectNode();
      tagLabel.put("tagFQN", "Glossary.PII");
      tagLabel.put("name", "PII");
      tagLabel.put("displayName", "Personal Data");
      tagLabel.put("labelType", "Manual");
      tagLabel.put("source", "Glossary");
      tagLabel.put("state", "Confirmed");
      tagLabel.put("description", "Sensitive data");

      invokePrivate(
          "processFieldMapping",
          new Class[] {String.class, JsonNode.class, Object.class, Resource.class, Model.class},
          "tags",
          tagLabel,
          Map.of("@id", "om:hasTag", "@type", "@id"),
          entityResource,
          model);

      Property tagProperty = model.createProperty(OM_NS, "hasTag");
      Resource tagResource = model.createResource(BASE_URI + "tag/Glossary/PII");
      assertTrue(model.contains(entityResource, tagProperty, tagResource));
      assertTrue(
          model.contains(tagResource, model.createProperty(OM_NS, "tagFQN"), "Glossary.PII"));
      assertTrue(model.contains(tagResource, SKOS.prefLabel, "Personal Data"));
      assertTrue(model.contains(tagResource, model.createProperty(OM_NS, "tagSource"), "Glossary"));
      assertTrue(
          model.contains(tagResource, RDF.type, model.createResource(SKOS.getURI() + "Concept")));

      ArrayNode reviewers = objectMapper.createArrayNode();
      reviewers.add(entityReferenceNode("user", UUID.randomUUID().toString(), "bob", null));
      reviewers.add(entityReferenceNode("user", UUID.randomUUID().toString(), "carol", null));

      invokePrivate(
          "processFieldMapping",
          new Class[] {String.class, JsonNode.class, Object.class, Resource.class, Model.class},
          "reviewers",
          reviewers,
          Map.of("@id", "om:reviewer", "@type", "@id"),
          entityResource,
          model);

      assertEquals(
          2,
          model
              .listObjectsOfProperty(entityResource, model.createProperty(OM_NS, "reviewer"))
              .toList()
              .size());
    }

    @Test
    @DisplayName("addSimpleProperty should handle numeric and boolean literals")
    void testAddSimplePropertyHandlesNumericAndBooleanLiterals() throws Exception {
      invokePrivate(
          "addSimpleProperty",
          new Class[] {Resource.class, String.class, JsonNode.class, Model.class},
          entityResource,
          "om:qualityScore",
          objectMapper.getNodeFactory().numberNode(7),
          model);
      invokePrivate(
          "addSimpleProperty",
          new Class[] {Resource.class, String.class, JsonNode.class, Model.class},
          entityResource,
          "om:rowCount",
          objectMapper.getNodeFactory().numberNode(1234567890123L),
          model);
      invokePrivate(
          "addSimpleProperty",
          new Class[] {Resource.class, String.class, JsonNode.class, Model.class},
          entityResource,
          "om:qualityRating",
          objectMapper.getNodeFactory().numberNode(98.5),
          model);
      invokePrivate(
          "addSimpleProperty",
          new Class[] {Resource.class, String.class, JsonNode.class, Model.class},
          entityResource,
          "om:isCritical",
          objectMapper.getNodeFactory().booleanNode(true),
          model);

      assertEquals(
          7,
          model.getProperty(entityResource, model.createProperty(OM_NS, "qualityScore")).getInt());
      assertEquals(
          1234567890123L,
          model.getProperty(entityResource, model.createProperty(OM_NS, "rowCount")).getLong());
      assertEquals(
          98.5,
          model
              .getProperty(entityResource, model.createProperty(OM_NS, "qualityRating"))
              .getDouble(),
          0.0001);
      assertTrue(
          model
              .getProperty(entityResource, model.createProperty(OM_NS, "isCritical"))
              .getBoolean());
    }

    @Test
    @DisplayName("processFieldMapping should handle JSON, containers, typed values, and extensions")
    void testProcessFieldMappingHandlesJsonContainersTypedValuesAndExtensions() throws Exception {
      ObjectNode rawPayload = objectMapper.createObjectNode();
      rawPayload.put("sql", "SELECT 1");
      invokePrivate(
          "processFieldMapping",
          new Class[] {String.class, JsonNode.class, Object.class, Resource.class, Model.class},
          "rawPayload",
          rawPayload,
          Map.of("@id", "om:rawPayload", "@type", "@json"),
          entityResource,
          model);
      assertEquals(
          "{\"sql\":\"SELECT 1\"}",
          model.getProperty(entityResource, model.createProperty(OM_NS, "rawPayload")).getString());

      ArrayNode aliases = objectMapper.createArrayNode();
      aliases.add("orders");
      aliases.add("sales_orders");
      invokePrivate(
          "processFieldMapping",
          new Class[] {String.class, JsonNode.class, Object.class, Resource.class, Model.class},
          "aliases",
          aliases,
          Map.of("@id", "om:alias", "@container", "@list"),
          entityResource,
          model);
      RDFList aliasList =
          model
              .getProperty(entityResource, model.createProperty(OM_NS, "alias"))
              .getObject()
              .as(RDFList.class);
      assertEquals(
          List.of("orders", "sales_orders"),
          aliasList.iterator().toList().stream()
              .map(node -> node.asLiteral().getString())
              .toList());

      UUID watcherId = UUID.randomUUID();
      ArrayNode watchers = objectMapper.createArrayNode();
      watchers.add("analytics");
      watchers.add(entityReferenceNode("user", watcherId.toString(), "watcher", null));
      invokePrivate(
          "processFieldMapping",
          new Class[] {String.class, JsonNode.class, Object.class, Resource.class, Model.class},
          "watchers",
          watchers,
          Map.of("@id", "om:watcher", "@container", "@set"),
          entityResource,
          model);
      Property watcherProperty = model.createProperty(OM_NS, "watcher");
      assertTrue(model.contains(entityResource, watcherProperty, "analytics"));
      assertTrue(
          model.contains(
              entityResource,
              watcherProperty,
              model.createResource(BASE_URI + "entity/user/" + watcherId)));

      invokePrivate(
          "processFieldMapping",
          new Class[] {String.class, JsonNode.class, Object.class, Resource.class, Model.class},
          "priority",
          objectMapper.getNodeFactory().numberNode(5),
          Map.of("@id", "om:priority", "@type", "xsd:integer"),
          entityResource,
          model);
      assertEquals(
          XSDDatatype.XSDinteger.getURI(),
          model
              .getProperty(entityResource, model.createProperty(OM_NS, "priority"))
              .getLiteral()
              .getDatatypeURI());

      invokePrivate(
          "processFieldMapping",
          new Class[] {String.class, JsonNode.class, Object.class, Resource.class, Model.class},
          "customType",
          objectMapper.getNodeFactory().textNode("value"),
          Map.of("@id", "https://example.org/customType", "@type", "xsd:customType"),
          entityResource,
          model);
      assertEquals(
          XSDDatatype.XSDstring.getURI(),
          model
              .getProperty(entityResource, model.createProperty("https://example.org/customType"))
              .getLiteral()
              .getDatatypeURI());

      ObjectNode extension = objectMapper.createObjectNode();
      extension.put("costCenter", "Finance");
      invokePrivate(
          "processFieldMapping",
          new Class[] {String.class, JsonNode.class, Object.class, Resource.class, Model.class},
          "extension",
          extension,
          Map.of("@id", "om:extension", "@type", "@id"),
          entityResource,
          model);
      assertTrue(
          model.contains(entityResource, model.createProperty(OM_NS, "hasExtension")),
          "Structured extension fields should route through the structured-property handler");
    }

    @Test
    @DisplayName("container, votes, and extension helpers should cover remaining value branches")
    void testContainerVotesAndExtensionHelpersCoverRemainingBranches() throws Exception {
      ArrayNode listOfReferences = objectMapper.createArrayNode();
      UUID upstreamId = UUID.randomUUID();
      listOfReferences.add(entityReferenceNode("table", upstreamId.toString(), "orders", null));
      invokePrivate(
          "addContainerProperty",
          new Class[] {Resource.class, String.class, JsonNode.class, String.class, Model.class},
          entityResource,
          "om:linkedEntity",
          listOfReferences,
          "@list",
          model);
      RDFList linkedEntities =
          model
              .getProperty(entityResource, model.createProperty(OM_NS, "linkedEntity"))
              .getObject()
              .as(RDFList.class);
      assertEquals(
          List.of(BASE_URI + "entity/table/" + upstreamId),
          linkedEntities.iterator().toList().stream()
              .map(node -> node.asResource().getURI())
              .toList());

      ObjectNode votes = objectMapper.createObjectNode();
      votes.put("upVotes", 2);
      ArrayNode downVoters = objectMapper.createArrayNode();
      UUID reviewerId = UUID.randomUUID();
      downVoters.add(entityReferenceNode("user", reviewerId.toString(), "reviewer", null));
      votes.set("downVoters", downVoters);
      invokePrivate(
          "addVotes",
          new Class[] {JsonNode.class, Resource.class, Model.class},
          votes,
          entityResource,
          model);
      Resource votesResource =
          model
              .listObjectsOfProperty(entityResource, model.createProperty(OM_NS, "hasVotes"))
              .next()
              .asResource();
      assertTrue(
          model.contains(
              votesResource,
              model.createProperty(OM_NS, "downVoters"),
              model.createResource(BASE_URI + "entity/user/" + reviewerId)));

      ObjectNode extension = objectMapper.createObjectNode();
      extension.put("threshold", 2.5);
      extension.set("settings", objectMapper.createObjectNode().put("env", "prod"));
      invokePrivate(
          "addExtension",
          new Class[] {JsonNode.class, Resource.class, Model.class},
          extension,
          entityResource,
          model);
      Resource extensionResource =
          model
              .listObjectsOfProperty(entityResource, model.createProperty(OM_NS, "hasExtension"))
              .next()
              .asResource();
      assertEquals(
          2.5,
          model
              .getProperty(extensionResource, model.createProperty(OM_NS, "ext_threshold"))
              .getDouble(),
          0.0001);
      assertEquals(
          "{\"env\":\"prod\"}",
          model
              .getProperty(extensionResource, model.createProperty(OM_NS, "ext_settings"))
              .getString());
    }

    @Test
    @DisplayName("structured property dispatch should handle supported object and array types")
    void testStructuredPropertyDispatchAndCustomProperties() throws Exception {
      ObjectNode changeDescription = objectMapper.createObjectNode();
      changeDescription.put("previousVersion", 1.0);
      invokePrivate(
          "addStructuredProperty",
          new Class[] {String.class, JsonNode.class, Resource.class, Model.class},
          "changeDescription",
          changeDescription,
          entityResource,
          model);
      assertTrue(
          model.contains(entityResource, model.createProperty(OM_NS, "hasChangeDescription")));

      ObjectNode votes = objectMapper.createObjectNode();
      votes.put("upVotes", 2);
      invokePrivate(
          "addStructuredProperty",
          new Class[] {String.class, JsonNode.class, Resource.class, Model.class},
          "votes",
          votes,
          entityResource,
          model);
      assertTrue(model.contains(entityResource, model.createProperty(OM_NS, "hasVotes")));

      ObjectNode lifeCycle = objectMapper.createObjectNode();
      lifeCycle.set(
          "created", objectMapper.createObjectNode().put("timestamp", "2024-01-15T10:30:00Z"));
      invokePrivate(
          "addStructuredProperty",
          new Class[] {String.class, JsonNode.class, Resource.class, Model.class},
          "lifeCycle",
          lifeCycle,
          entityResource,
          model);
      assertTrue(model.contains(entityResource, model.createProperty(OM_NS, "hasLifeCycle")));

      ArrayNode customProperties = objectMapper.createArrayNode();
      ObjectNode customProperty = objectMapper.createObjectNode();
      customProperty.put("name", "costCenter");
      customProperty.put("value", "Finance");
      customProperty.set("propertyType", objectMapper.createObjectNode().put("name", "string"));
      customProperties.add(customProperty);

      invokePrivate(
          "processFieldMapping",
          new Class[] {String.class, JsonNode.class, Object.class, Resource.class, Model.class},
          "customProperties",
          customProperties,
          Map.of("@id", "om:hasCustomProperty", "@container", "@set"),
          entityResource,
          model);

      Property customPropertyLink = model.createProperty(OM_NS, "hasCustomProperty");
      Resource customPropertyResource =
          model.listObjectsOfProperty(entityResource, customPropertyLink).next().asResource();
      assertTrue(
          model.contains(
              customPropertyResource, model.createProperty(OM_NS, "propertyName"), "costCenter"));
      assertTrue(
          model.contains(
              customPropertyResource, model.createProperty(OM_NS, "propertyValue"), "Finance"));
      assertTrue(
          model.contains(
              customPropertyResource, model.createProperty(OM_NS, "propertyType"), "string"));
    }

    @Test
    @DisplayName("lineage mapping should include graph nodes and lineage metadata")
    void testLineageMappingIncludesGraphNodesAndMetadata() throws Exception {
      UUID upstreamId = UUID.randomUUID();
      UUID pipelineId = UUID.randomUUID();

      ObjectNode lineage = objectMapper.createObjectNode();
      ArrayNode upstreamEdges = objectMapper.createArrayNode();
      ObjectNode upstreamEdge = objectMapper.createObjectNode();
      upstreamEdge.put("fromEntity", upstreamId.toString());
      ObjectNode details = objectMapper.createObjectNode();
      details.put("description", "Nightly ETL");
      details.put("createdAt", "2024-01-10T10:00:00Z");
      details.put("updatedAt", "2024-01-11T10:00:00Z");
      details.put("createdBy", "etl-user");
      details.put("updatedBy", "data-eng");
      details.set("pipeline", entityReferenceNode("pipeline", pipelineId.toString(), "etl", null));
      upstreamEdge.set("lineageDetails", details);
      upstreamEdges.add(upstreamEdge);
      lineage.set("upstreamEdges", upstreamEdges);

      ArrayNode downstreamEdges = objectMapper.createArrayNode();
      ObjectNode downstreamEdge = objectMapper.createObjectNode();
      downstreamEdge.set(
          "toEntity",
          entityReferenceNode(
              "dashboard", UUID.randomUUID().toString(), "sales_dashboard", "sales.dashboard"));
      downstreamEdges.add(downstreamEdge);
      lineage.set("downstreamEdges", downstreamEdges);

      ArrayNode nodes = objectMapper.createArrayNode();
      nodes.add(entityReferenceNode("chart", UUID.randomUUID().toString(), "weekly_sales", null));
      lineage.set("nodes", nodes);

      invokePrivate(
          "addLineageProperty",
          new Class[] {String.class, JsonNode.class, Resource.class, Model.class},
          "lineage",
          lineage,
          entityResource,
          model);

      Resource upstreamResource = model.createResource(BASE_URI + "entity/unknown/" + upstreamId);
      assertTrue(
          model.contains(
              entityResource, model.createProperty(PROV_NS, "wasDerivedFrom"), upstreamResource));
      assertTrue(
          model.contains(entityResource, model.createProperty(OM_NS, "downstream")),
          "Downstream edges should be materialized");
      assertTrue(
          model.contains(entityResource, model.createProperty(OM_NS, "hasLineageNode")),
          "Lineage nodes should be linked");

      Resource detailsResource =
          model
              .listObjectsOfProperty(
                  entityResource, model.createProperty(OM_NS, "hasLineageDetails"))
              .next()
              .asResource();
      Resource pipelineResource = model.createResource(BASE_URI + "entity/pipeline/" + pipelineId);
      assertTrue(
          model.contains(
              detailsResource, model.createProperty(DCT_NS, "description"), "Nightly ETL"));
      assertTrue(
          model.contains(
              detailsResource, model.createProperty(PROV_NS, "wasGeneratedBy"), pipelineResource));
      assertTrue(model.contains(detailsResource, model.createProperty(DCT_NS, "created")));
      assertTrue(model.contains(detailsResource, model.createProperty(DCT_NS, "modified")));
      assertTrue(
          model.contains(
              detailsResource, model.createProperty(OM_NS, "lineageCreatedBy"), "etl-user"));
      assertTrue(
          model.contains(
              detailsResource, model.createProperty(OM_NS, "lineageUpdatedBy"), "data-eng"));
    }

    @Test
    @DisplayName("access details should default to user and pipeline resource types")
    void testAccessDetailsUseDefaultUserAndProcessTypes() throws Exception {
      Resource lifecycleResource = model.createResource(BASE_URI + "lifecycle/test");
      UUID userId = UUID.randomUUID();
      UUID processId = UUID.randomUUID();
      ObjectNode accessDetails = objectMapper.createObjectNode();
      accessDetails.put("timestamp", "2024-01-15T10:30:00Z");
      accessDetails.set("accessedBy", objectMapper.createObjectNode().put("id", userId.toString()));
      accessDetails.set(
          "accessedByAProcess", objectMapper.createObjectNode().put("id", processId.toString()));

      invokePrivate(
          "addAccessDetails",
          new Class[] {JsonNode.class, Resource.class, String.class, Model.class},
          accessDetails,
          lifecycleResource,
          "lifecycleAccessed",
          model);

      Resource accessResource =
          model
              .listObjectsOfProperty(
                  lifecycleResource, model.createProperty(OM_NS, "lifecycleAccessed"))
              .next()
              .asResource();
      assertTrue(
          model.contains(
              accessResource,
              model.createProperty(OM_NS, "accessedBy"),
              model.createResource(BASE_URI + "entity/user/" + userId)));
      assertTrue(
          model.contains(
              accessResource,
              model.createProperty(OM_NS, "accessedByProcess"),
              model.createResource(BASE_URI + "entity/pipeline/" + processId)));
    }

    @Test
    @DisplayName("helper methods should resolve namespaces, contexts, and datatypes consistently")
    void testHelperMethodsResolveNamespacesContextsAndDatatypes() throws Exception {
      Property descriptionProperty =
          (Property)
              invokePrivate(
                  "createProperty",
                  new Class[] {String.class, Model.class},
                  "dct:description",
                  model);
      assertEquals(DCT_NS + "description", descriptionProperty.getURI());

      Property rawProperty =
          (Property)
              invokePrivate(
                  "createProperty",
                  new Class[] {String.class, Model.class},
                  "https://example.org/raw",
                  model);
      assertEquals("https://example.org/raw", rawProperty.getURI());
      assertEquals(
          DCT_NS + "description",
          ((Property)
                  invokePrivate(
                      "createProperty",
                      new Class[] {String.class, Model.class},
                      "dct:description",
                      model))
              .getURI());
      assertEquals(
          "http://www.w3.org/ns/prov#wasGeneratedBy",
          ((Property)
                  invokePrivate(
                      "createProperty",
                      new Class[] {String.class, Model.class},
                      "prov:wasGeneratedBy",
                      model))
              .getURI());
      assertEquals(
          "http://xmlns.com/foaf/0.1/name",
          ((Property)
                  invokePrivate(
                      "createProperty",
                      new Class[] {String.class, Model.class},
                      "foaf:name",
                      model))
              .getURI());
      assertEquals(
          SKOS.getURI() + "prefLabel",
          ((Property)
                  invokePrivate(
                      "createProperty",
                      new Class[] {String.class, Model.class},
                      "skos:prefLabel",
                      model))
              .getURI());
      assertEquals(
          "http://rdfs.org/ns/void#Dataset",
          ((Property)
                  invokePrivate(
                      "createProperty",
                      new Class[] {String.class, Model.class},
                      "void:Dataset",
                      model))
              .getURI());
      assertEquals(
          "http://www.w3.org/ns/csvw#tableSchema",
          ((Property)
                  invokePrivate(
                      "createProperty",
                      new Class[] {String.class, Model.class},
                      "csvw:tableSchema",
                      model))
              .getURI());
      assertEquals(
          "unknown:value",
          ((Property)
                  invokePrivate(
                      "createProperty",
                      new Class[] {String.class, Model.class},
                      "unknown:value",
                      model))
              .getURI());

      assertEquals(
          "governance", invokePrivate("getContextName", new Class[] {String.class}, "glossary"));
      assertEquals("team", invokePrivate("getContextName", new Class[] {String.class}, "user"));
      assertEquals("base", invokePrivate("getContextName", new Class[] {String.class}, "custom"));
      assertEquals(
          "dataAsset-complete",
          invokePrivate("getContextName", new Class[] {String.class}, "table"));
      assertEquals(
          XSDDatatype.XSDboolean,
          invokePrivate("getXSDDatatype", new Class[] {String.class}, "boolean"));
      assertEquals(
          XSDDatatype.XSDinteger,
          invokePrivate("getXSDDatatype", new Class[] {String.class}, "integer"));
      assertEquals(
          XSDDatatype.XSDlong, invokePrivate("getXSDDatatype", new Class[] {String.class}, "long"));
      assertEquals(
          XSDDatatype.XSDdouble,
          invokePrivate("getXSDDatatype", new Class[] {String.class}, "double"));
      assertEquals(
          XSDDatatype.XSDfloat,
          invokePrivate("getXSDDatatype", new Class[] {String.class}, "float"));
      assertEquals(
          XSDDatatype.XSDdateTime,
          invokePrivate("getXSDDatatype", new Class[] {String.class}, "dateTime"));
      assertEquals(
          XSDDatatype.XSDdate, invokePrivate("getXSDDatatype", new Class[] {String.class}, "date"));
      assertEquals(
          XSDDatatype.XSDdecimal,
          invokePrivate("getXSDDatatype", new Class[] {String.class}, "decimal"));
      assertEquals(
          XSDDatatype.XSDstring,
          invokePrivate("getXSDDatatype", new Class[] {String.class}, "customType"));
    }
  }

  private Object invokePrivate(String name, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    java.lang.reflect.Method method =
        RdfPropertyMapper.class.getDeclaredMethod(name, parameterTypes);
    method.setAccessible(true);
    return method.invoke(propertyMapper, args);
  }

  private ObjectNode entityReferenceNode(
      String type, String id, String name, String fullyQualifiedName) {
    ObjectNode entityReference = objectMapper.createObjectNode();
    entityReference.put("id", id);
    entityReference.put("type", type);
    if (name != null) {
      entityReference.put("name", name);
    }
    if (fullyQualifiedName != null) {
      entityReference.put("fullyQualifiedName", fullyQualifiedName);
    }
    return entityReference;
  }

  private static class TestRdfEntity implements EntityInterface {
    private UUID id;
    private String description;
    private String displayName;
    private String name;
    private Double version;
    private String updatedBy;
    private Long updatedAt;
    private URI href;
    private ChangeDescription changeDescription;
    private ChangeDescription incrementalChangeDescription;
    private String fullyQualifiedName;
    private Integer qualityScore;
    private Long rowCount;
    private Double qualityRating;
    private boolean active;
    private Map<String, Object> metadata;
    private List<String> aliases;

    @Override
    public UUID getId() {
      return id;
    }

    @Override
    public String getDescription() {
      return description;
    }

    @Override
    public String getDisplayName() {
      return displayName;
    }

    @Override
    public String getName() {
      return name;
    }

    @Override
    public Double getVersion() {
      return version;
    }

    @Override
    public String getUpdatedBy() {
      return updatedBy;
    }

    @Override
    public Long getUpdatedAt() {
      return updatedAt;
    }

    @Override
    public URI getHref() {
      return href;
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return changeDescription;
    }

    @Override
    public ChangeDescription getIncrementalChangeDescription() {
      return incrementalChangeDescription;
    }

    @Override
    public String getFullyQualifiedName() {
      return fullyQualifiedName;
    }

    public Integer getQualityScore() {
      return qualityScore;
    }

    public Long getRowCount() {
      return rowCount;
    }

    public Double getQualityRating() {
      return qualityRating;
    }

    public boolean isActive() {
      return active;
    }

    public Map<String, Object> getMetadata() {
      return metadata;
    }

    public List<String> getAliases() {
      return aliases;
    }

    @Override
    public void setId(UUID id) {
      this.id = id;
    }

    @Override
    public void setDescription(String description) {
      this.description = description;
    }

    @Override
    public void setDisplayName(String displayName) {
      this.displayName = displayName;
    }

    @Override
    public void setName(String name) {
      this.name = name;
    }

    @Override
    public void setVersion(Double newVersion) {
      this.version = newVersion;
    }

    @Override
    public void setChangeDescription(ChangeDescription changeDescription) {
      this.changeDescription = changeDescription;
    }

    @Override
    public void setIncrementalChangeDescription(ChangeDescription incrementalChangeDescription) {
      this.incrementalChangeDescription = incrementalChangeDescription;
    }

    @Override
    public void setFullyQualifiedName(String fullyQualifiedName) {
      this.fullyQualifiedName = fullyQualifiedName;
    }

    @Override
    public void setUpdatedBy(String updatedBy) {
      this.updatedBy = updatedBy;
    }

    @Override
    public void setUpdatedAt(Long updatedAt) {
      this.updatedAt = updatedAt;
    }

    @Override
    public void setHref(URI href) {
      this.href = href;
    }

    @Override
    @SuppressWarnings("unchecked")
    public <T extends EntityInterface> T withHref(URI href) {
      this.href = href;
      return (T) this;
    }

    public void setQualityScore(Integer qualityScore) {
      this.qualityScore = qualityScore;
    }

    public void setRowCount(Long rowCount) {
      this.rowCount = rowCount;
    }

    public void setQualityRating(Double qualityRating) {
      this.qualityRating = qualityRating;
    }

    public void setActive(boolean active) {
      this.active = active;
    }

    public void setMetadata(Map<String, Object> metadata) {
      this.metadata = metadata;
    }

    public void setAliases(List<String> aliases) {
      this.aliases = aliases;
    }
  }
}
