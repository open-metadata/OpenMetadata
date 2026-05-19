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
    @DisplayName("ChangeDescription should be ignored during RDF field processing")
    void testChangeDescriptionIsIgnored() throws Exception {
      ObjectNode changeDesc = objectMapper.createObjectNode();
      changeDesc.put("previousVersion", 1.0);

      ObjectNode entityJson = objectMapper.createObjectNode();
      entityJson.set("changeDescription", changeDesc);

      invokePrivate(
          "processContextMappings",
          new Class[] {Map.class, JsonNode.class, Resource.class, Model.class},
          Map.of("changeDescription", Map.of("@id", "om:hasChangeDescription", "@type", "@json")),
          entityJson,
          entityResource,
          model);

      assertFalse(
          model.contains(entityResource, model.createProperty(OM_NS, "hasChangeDescription")),
          "ChangeDescription helper nodes should not be emitted into RDF");
    }

    @Test
    @DisplayName("Structured property dispatch should ignore changeDescription")
    void testStructuredDispatchIgnoresChangeDescription() throws Exception {
      ObjectNode changeDesc = objectMapper.createObjectNode();

      invokePrivate(
          "addStructuredProperty",
          new Class[] {String.class, JsonNode.class, Resource.class, Model.class},
          "changeDescription",
          changeDesc,
          entityResource,
          model);

      assertFalse(
          model.contains(entityResource, model.createProperty(OM_NS, "hasChangeDescription")));
    }
  }

  @Nested
  @DisplayName("P0-1: Votes Tests")
  class VotesTests {

    @Test
    @DisplayName("Votes are ignored during RDF field processing (audit/helper data)")
    void testVotesAreIgnored() throws Exception {
      ObjectNode votes = objectMapper.createObjectNode();
      votes.put("upVotes", 10);
      votes.put("downVotes", 2);

      ObjectNode entityJson = objectMapper.createObjectNode();
      entityJson.set("votes", votes);

      invokePrivate(
          "processContextMappings",
          new Class[] {Map.class, JsonNode.class, Resource.class, Model.class},
          Map.of("votes", Map.of("@id", "om:hasVotes", "@type", "@json")),
          entityJson,
          entityResource,
          model);

      assertFalse(
          model.contains(entityResource, model.createProperty(OM_NS, "hasVotes")),
          "Votes helper nodes should not be emitted into RDF");
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
    @DisplayName("Column lineage should emit URI references plus FQN strings for back-compat")
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
      fromColumns.add("service.db.schema.source_table.column_a");
      fromColumns.add("service.db.schema.source_table.column_b");
      colLineage.set("fromColumns", fromColumns);
      colLineage.put("toColumn", "service.db.schema.target_table.merged_column");
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

      Property hasColumnLineage = model.createProperty(OM_NS, "hasColumnLineage");
      StmtIterator stmts = model.listStatements(null, hasColumnLineage, (Resource) null);
      assertTrue(stmts.hasNext(), "Should have column lineage");
      Resource colLineageResource = stmts.next().getObject().asResource();

      Resource expectedFromA =
          model.createResource(
              RdfUtils.columnUri(BASE_URI, "service.db.schema.source_table.column_a"));
      Resource expectedFromB =
          model.createResource(
              RdfUtils.columnUri(BASE_URI, "service.db.schema.source_table.column_b"));
      Resource expectedTo =
          model.createResource(
              RdfUtils.columnUri(BASE_URI, "service.db.schema.target_table.merged_column"));

      Property fromColumn = model.createProperty(OM_NS, "fromColumn");
      Property toColumn = model.createProperty(OM_NS, "toColumn");
      assertTrue(
          model.contains(colLineageResource, fromColumn, expectedFromA),
          "fromColumn should reference URI for column_a");
      assertTrue(
          model.contains(colLineageResource, fromColumn, expectedFromB),
          "fromColumn should reference URI for column_b");
      assertTrue(
          model.contains(colLineageResource, toColumn, expectedTo),
          "toColumn should reference URI for merged_column");

      Property fromColumnFqn = model.createProperty(OM_NS, "fromColumnFqn");
      Property toColumnFqn = model.createProperty(OM_NS, "toColumnFqn");
      assertTrue(
          model.contains(
              colLineageResource, fromColumnFqn, "service.db.schema.source_table.column_a"),
          "fromColumnFqn literal should be retained for back-compat");
      assertTrue(
          model.contains(
              colLineageResource, toColumnFqn, "service.db.schema.target_table.merged_column"),
          "toColumnFqn literal should be retained for back-compat");

      Resource columnClass = model.createResource(OM_NS + "Column");
      assertTrue(
          model.contains(expectedFromA, RDF.type, columnClass),
          "Source column resource should be typed as om:Column");
      assertTrue(
          model.contains(expectedTo, RDF.type, columnClass),
          "Target column resource should be typed as om:Column");

      Property transformFunc = model.createProperty(OM_NS, "transformFunction");
      assertTrue(
          model.contains(colLineageResource, transformFunc, "CONCAT(column_a, column_b)"),
          "transformFunction should be stored as a literal on the column-lineage resource");
    }
  }

  @Nested
  @DisplayName("P1.1: Column resource emission")
  class ColumnResourceTests {

    @Test
    @DisplayName("Table.columns should be emitted as named om:Column resources at FQN-derived URIs")
    void testTableColumnsEmittedAsNamedResources() throws Exception {
      Map<String, Object> contextCache = new HashMap<>();
      contextCache.put("dataAsset-complete", Map.of());
      propertyMapper = new RdfPropertyMapper(BASE_URI, objectMapper, contextCache);

      ArrayNode columns = objectMapper.createArrayNode();
      ObjectNode pkColumn = objectMapper.createObjectNode();
      pkColumn.put("name", "id");
      pkColumn.put("dataType", "BIGINT");
      pkColumn.put("constraint", "PRIMARY_KEY");
      pkColumn.put("ordinalPosition", 0);
      pkColumn.put("description", "Primary key");
      pkColumn.put("fullyQualifiedName", "service.db.schema.orders.id");
      columns.add(pkColumn);

      ObjectNode amountColumn = objectMapper.createObjectNode();
      amountColumn.put("name", "amount");
      amountColumn.put("dataType", "DECIMAL");
      amountColumn.put("ordinalPosition", 1);
      amountColumn.put("fullyQualifiedName", "service.db.schema.orders.amount");
      columns.add(amountColumn);

      invokePrivate(
          "emitColumns",
          new Class[] {JsonNode.class, Resource.class, Model.class},
          columns,
          entityResource,
          model);

      Resource pkResource =
          model.createResource(RdfUtils.columnUri(BASE_URI, "service.db.schema.orders.id"));
      Resource amountResource =
          model.createResource(RdfUtils.columnUri(BASE_URI, "service.db.schema.orders.amount"));

      Property hasColumn = model.createProperty(OM_NS, "hasColumn");
      assertTrue(
          model.contains(entityResource, hasColumn, pkResource),
          "Table should link to PK column via om:hasColumn");
      assertTrue(
          model.contains(entityResource, hasColumn, amountResource),
          "Table should link to amount column via om:hasColumn");

      Resource columnClass = model.createResource(OM_NS + "Column");
      assertTrue(model.contains(pkResource, RDF.type, columnClass));
      assertTrue(
          model.contains(pkResource, model.createProperty(OM_NS, "columnDataType"), "BIGINT"));
      assertTrue(
          model.getProperty(pkResource, model.createProperty(OM_NS, "isPrimaryKey")).getBoolean(),
          "Primary key constraint should set om:isPrimaryKey true");
      assertFalse(
          model.getProperty(pkResource, model.createProperty(OM_NS, "isNullable")).getBoolean(),
          "Primary key implies om:isNullable false");
      assertTrue(
          model.contains(amountResource, model.createProperty(OM_NS, "columnDataType"), "DECIMAL"));
    }

    @Test
    @DisplayName("Nested struct/map columns should link via om:hasChildColumn")
    void testNestedChildColumns() throws Exception {
      ArrayNode columns = objectMapper.createArrayNode();
      ObjectNode struct = objectMapper.createObjectNode();
      struct.put("name", "address");
      struct.put("dataType", "STRUCT");
      struct.put("fullyQualifiedName", "service.db.schema.users.address");

      ArrayNode children = objectMapper.createArrayNode();
      ObjectNode street = objectMapper.createObjectNode();
      street.put("name", "street");
      street.put("dataType", "VARCHAR");
      street.put("fullyQualifiedName", "service.db.schema.users.address.street");
      children.add(street);
      struct.set("children", children);

      columns.add(struct);

      invokePrivate(
          "emitColumns",
          new Class[] {JsonNode.class, Resource.class, Model.class},
          columns,
          entityResource,
          model);

      Resource addressResource =
          model.createResource(RdfUtils.columnUri(BASE_URI, "service.db.schema.users.address"));
      Resource streetResource =
          model.createResource(
              RdfUtils.columnUri(BASE_URI, "service.db.schema.users.address.street"));

      assertTrue(
          model.contains(
              addressResource, model.createProperty(OM_NS, "hasChildColumn"), streetResource),
          "Parent struct column should link to child via om:hasChildColumn");
      assertTrue(model.contains(streetResource, RDF.type, model.createResource(OM_NS + "Column")));
    }

    @Test
    @DisplayName("Per-column constraints map to isPrimaryKey, isNullable, and isUnique")
    void testPerColumnConstraintFlags() throws Exception {
      ArrayNode columns = objectMapper.createArrayNode();
      columns.add(columnNode("id", "BIGINT", "service.db.s.t.id", "PRIMARY_KEY"));
      columns.add(columnNode("email", "VARCHAR", "service.db.s.t.email", "UNIQUE"));
      columns.add(columnNode("country", "VARCHAR", "service.db.s.t.country", "NOT_NULL"));
      columns.add(columnNode("nickname", "VARCHAR", "service.db.s.t.nickname", "NULL"));

      invokePrivate(
          "emitColumns",
          new Class[] {JsonNode.class, Resource.class, Model.class},
          columns,
          entityResource,
          model);

      Resource id = model.createResource(RdfUtils.columnUri(BASE_URI, "service.db.s.t.id"));
      Resource email = model.createResource(RdfUtils.columnUri(BASE_URI, "service.db.s.t.email"));
      Resource country =
          model.createResource(RdfUtils.columnUri(BASE_URI, "service.db.s.t.country"));
      Resource nickname =
          model.createResource(RdfUtils.columnUri(BASE_URI, "service.db.s.t.nickname"));

      Property isPrimaryKey = model.createProperty(OM_NS, "isPrimaryKey");
      Property isUnique = model.createProperty(OM_NS, "isUnique");
      Property isNullable = model.createProperty(OM_NS, "isNullable");

      assertTrue(model.getProperty(id, isPrimaryKey).getBoolean());
      assertTrue(model.getProperty(id, isUnique).getBoolean());
      assertFalse(model.getProperty(id, isNullable).getBoolean());

      assertTrue(model.getProperty(email, isUnique).getBoolean());
      assertFalse(
          model.contains(email, isPrimaryKey),
          "UNIQUE alone should not imply primary-key membership");

      assertFalse(model.getProperty(country, isNullable).getBoolean());
      assertTrue(model.getProperty(nickname, isNullable).getBoolean());
    }

    @Test
    @DisplayName("FOREIGN_KEY table constraint emits om:references and TableConstraint resource")
    void testForeignKeyTableConstraint() throws Exception {
      ArrayNode constraints = objectMapper.createArrayNode();
      ObjectNode fk = objectMapper.createObjectNode();
      fk.put("constraintType", "FOREIGN_KEY");
      fk.put("relationshipType", "MANY_TO_ONE");
      ArrayNode cols = objectMapper.createArrayNode();
      cols.add("customer_id");
      fk.set("columns", cols);
      ArrayNode referred = objectMapper.createArrayNode();
      referred.add("service.db.s.customers.id");
      fk.set("referredColumns", referred);
      constraints.add(fk);

      invokePrivate(
          "emitTableConstraints",
          new Class[] {JsonNode.class, String.class, Resource.class, Model.class},
          constraints,
          "service.db.s.orders",
          entityResource,
          model);

      Resource customerIdCol =
          model.createResource(RdfUtils.columnUri(BASE_URI, "service.db.s.orders.customer_id"));
      Resource referredCol =
          model.createResource(RdfUtils.columnUri(BASE_URI, "service.db.s.customers.id"));

      Property references = model.createProperty(OM_NS, "references");
      assertTrue(
          model.contains(customerIdCol, references, referredCol),
          "FK should produce direct om:references triple between source and referred column");

      Property hasConstraint = model.createProperty(OM_NS, "hasConstraint");
      Resource constraintResource =
          model.listObjectsOfProperty(entityResource, hasConstraint).next().asResource();
      assertTrue(
          model.contains(
              constraintResource, RDF.type, model.createResource(OM_NS + "TableConstraint")));
      assertTrue(
          model.contains(
              constraintResource, model.createProperty(OM_NS, "constraintType"), "FOREIGN_KEY"));
      assertTrue(
          model.contains(
              constraintResource, model.createProperty(OM_NS, "relationshipType"), "MANY_TO_ONE"));
      assertTrue(
          model.contains(
              constraintResource,
              model.createProperty(OM_NS, "hasConstrainedColumn"),
              customerIdCol));
      assertTrue(
          model.contains(
              constraintResource, model.createProperty(OM_NS, "hasReferredColumn"), referredCol));
    }

    @Test
    @DisplayName("Multi-column PRIMARY_KEY constraint marks every member column")
    void testMultiColumnPrimaryKey() throws Exception {
      ArrayNode constraints = objectMapper.createArrayNode();
      ObjectNode pk = objectMapper.createObjectNode();
      pk.put("constraintType", "PRIMARY_KEY");
      ArrayNode cols = objectMapper.createArrayNode();
      cols.add("tenant_id");
      cols.add("user_id");
      pk.set("columns", cols);
      constraints.add(pk);

      invokePrivate(
          "emitTableConstraints",
          new Class[] {JsonNode.class, String.class, Resource.class, Model.class},
          constraints,
          "service.db.s.users",
          entityResource,
          model);

      Resource tenantId =
          model.createResource(RdfUtils.columnUri(BASE_URI, "service.db.s.users.tenant_id"));
      Resource userId =
          model.createResource(RdfUtils.columnUri(BASE_URI, "service.db.s.users.user_id"));

      Property isPrimaryKey = model.createProperty(OM_NS, "isPrimaryKey");
      assertTrue(model.getProperty(tenantId, isPrimaryKey).getBoolean());
      assertTrue(model.getProperty(userId, isPrimaryKey).getBoolean());
    }

    private ObjectNode columnNode(String name, String dataType, String fqn, String constraint) {
      ObjectNode col = objectMapper.createObjectNode();
      col.put("name", name);
      col.put("dataType", dataType);
      col.put("fullyQualifiedName", fqn);
      if (constraint != null) {
        col.put("constraint", constraint);
      }
      return col;
    }

    @Test
    @DisplayName("Column.profile is emitted as DQV measurements rather than a JSON literal")
    void testColumnProfileEmittedAsDqv() throws Exception {
      ArrayNode columns = objectMapper.createArrayNode();
      ObjectNode col = objectMapper.createObjectNode();
      col.put("name", "email");
      col.put("dataType", "VARCHAR");
      col.put("fullyQualifiedName", "service.db.s.users.email");
      ObjectNode profile = objectMapper.createObjectNode();
      profile.put("valuesCount", 1000);
      profile.put("nullCount", 12);
      profile.put("nullProportion", 0.012);
      profile.put("uniqueCount", 985);
      profile.put("timestamp", 1714300000000L);
      col.set("profile", profile);
      columns.add(col);

      invokePrivate(
          "emitColumns",
          new Class[] {JsonNode.class, Resource.class, Model.class},
          columns,
          entityResource,
          model);

      Resource emailColumn =
          model.createResource(RdfUtils.columnUri(BASE_URI, "service.db.s.users.email"));
      Property hasMeasurement =
          model.createProperty("http://www.w3.org/ns/dqv#", "hasQualityMeasurement");
      java.util.List<Resource> measurements =
          model.listObjectsOfProperty(emailColumn, hasMeasurement).toList().stream()
              .map(node -> node.asResource())
              .toList();
      assertEquals(
          4,
          measurements.size(),
          "Expected 4 numeric profile metrics (valuesCount, nullCount, nullProportion, uniqueCount)");

      Property isMeasurementOf =
          model.createProperty("http://www.w3.org/ns/dqv#", "isMeasurementOf");
      Property dqvValue = model.createProperty("http://www.w3.org/ns/dqv#", "value");
      java.util.Map<String, Double> byMetric = new java.util.HashMap<>();
      for (Resource m : measurements) {
        Resource metric = model.getProperty(m, isMeasurementOf).getObject().asResource();
        double v = model.getProperty(m, dqvValue).getDouble();
        byMetric.put(metric.getURI(), v);
      }
      assertEquals(1000.0, byMetric.get(OM_NS + "ValuesCountMetric"), 0.0);
      assertEquals(12.0, byMetric.get(OM_NS + "NullCountMetric"), 0.0);
      assertEquals(0.012, byMetric.get(OM_NS + "NullProportionMetric"), 1e-9);
      assertEquals(985.0, byMetric.get(OM_NS + "UniqueCountMetric"), 0.0);

      // Each measurement should also be tied back to the column via dqv:computedOn.
      Property computedOn = model.createProperty("http://www.w3.org/ns/dqv#", "computedOn");
      for (Resource m : measurements) {
        assertTrue(model.contains(m, computedOn, emailColumn));
      }
    }

    @Test
    @DisplayName("Pipeline run is emitted as a prov:Activity tied to inputs and outputs")
    void testPipelineRunEmitsProvActivity() throws Exception {
      ObjectNode pipelineStatus = objectMapper.createObjectNode();
      pipelineStatus.put("timestamp", 1714300000000L);
      pipelineStatus.put("endTime", 1714300120000L);
      pipelineStatus.put("executionStatus", "Successful");
      pipelineStatus.put("executionId", "airflow-run-123");
      ArrayNode inputs = objectMapper.createArrayNode();
      ObjectNode in = objectMapper.createObjectNode();
      in.put("datasetFQN", "service.db.s.source");
      inputs.add(in);
      pipelineStatus.set("inputs", inputs);
      ArrayNode outputs = objectMapper.createArrayNode();
      ObjectNode out = objectMapper.createObjectNode();
      out.put("datasetFQN", "service.db.s.target");
      outputs.add(out);
      pipelineStatus.set("outputs", outputs);
      ObjectNode executedBy = objectMapper.createObjectNode();
      executedBy.put("id", UUID.randomUUID().toString());
      executedBy.put("type", "user");
      pipelineStatus.set("executedBy", executedBy);

      java.lang.reflect.Method method =
          org.openmetadata.service.rdf.translator.RdfActivityMapper.class.getDeclaredMethod(
              "emitPipelineActivity",
              JsonNode.class,
              String.class,
              Resource.class,
              String.class,
              Model.class);
      method.setAccessible(true);
      method.invoke(
          null, pipelineStatus, "service.pipeline.daily_etl", entityResource, BASE_URI, model);

      Property hasExecution = model.createProperty(OM_NS, "hasExecution");
      Resource activity =
          model.listObjectsOfProperty(entityResource, hasExecution).next().asResource();

      assertTrue(
          model.contains(
              activity, RDF.type, model.createResource("http://www.w3.org/ns/prov#Activity")));
      assertTrue(
          model.contains(activity, model.createProperty(OM_NS, "executionStatus"), "Successful"));
      assertTrue(
          model.contains(activity, model.createProperty(OM_NS, "executionId"), "airflow-run-123"));
      // PROV-O: activity-to-activity relation. Pipeline run wasInformedBy pipeline definition.
      assertTrue(
          model.contains(
              activity,
              model.createProperty("http://www.w3.org/ns/prov#", "wasInformedBy"),
              entityResource));
      assertTrue(
          model.contains(
              activity, model.createProperty("http://www.w3.org/ns/prov#", "startedAtTime")));
      assertTrue(
          model.contains(
              activity, model.createProperty("http://www.w3.org/ns/prov#", "endedAtTime")));
      assertTrue(
          model.contains(activity, model.createProperty("http://www.w3.org/ns/prov#", "used")),
          "Activity should reference its input dataset via prov:used");
      assertTrue(
          model.contains(activity, model.createProperty("http://www.w3.org/ns/prov#", "generated")),
          "Activity should reference its output dataset via prov:generated");
      assertTrue(
          model.contains(
              activity, model.createProperty("http://www.w3.org/ns/prov#", "wasAssociatedWith")),
          "Activity should record who triggered the run via prov:wasAssociatedWith");
    }

    @Test
    @DisplayName("RdfUtils.columnUri should be deterministic and percent-encode FQNs")
    void testColumnUri() {
      String uri = RdfUtils.columnUri(BASE_URI, "service.db.schema.orders.amount");
      assertEquals(BASE_URI + "entity/column/service.db.schema.orders.amount", uri);

      String specialUri = RdfUtils.columnUri(BASE_URI, "service db.weird name");
      assertTrue(
          specialUri.contains("service+db.weird+name") || specialUri.contains("service%20db"),
          "FQN with whitespace should be percent-encoded");

      assertNull(RdfUtils.columnUri(BASE_URI, null));
      assertNull(RdfUtils.columnUri(BASE_URI, ""));
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
    @DisplayName("container and extension helpers should cover remaining value branches")
    void testContainerAndExtensionHelpersCoverRemainingBranches() throws Exception {
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
      assertFalse(
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
      assertFalse(
          model.contains(entityResource, model.createProperty(OM_NS, "hasVotes")),
          "votes is ignored by the structured-property dispatch");

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

  @Nested
  @DisplayName("addTypedProperty: blank xsd:string skip")
  class AddTypedPropertyBlankString {

    @Test
    @DisplayName("Blank xsd:string value should not produce a literal triple")
    void blankStringIsNotEmitted() throws Exception {
      JsonNode blank = objectMapper.getNodeFactory().textNode("");
      invokePrivate(
          "addTypedProperty",
          new Class[] {Resource.class, String.class, JsonNode.class, String.class, Model.class},
          entityResource,
          "skos:prefLabel",
          blank,
          "xsd:string",
          model);

      Property pref = model.createProperty(SKOS.getURI(), "prefLabel");
      assertFalse(
          model.contains(entityResource, pref),
          "Blank xsd:string literals must not be emitted — they masked rdfs:label "
              + "on the read side and rendered as empty UI labels");
    }

    @Test
    @DisplayName("Whitespace-only xsd:string value should not produce a literal triple")
    void whitespaceOnlyStringIsNotEmitted() throws Exception {
      JsonNode whitespace = objectMapper.getNodeFactory().textNode("   ");
      invokePrivate(
          "addTypedProperty",
          new Class[] {Resource.class, String.class, JsonNode.class, String.class, Model.class},
          entityResource,
          "skos:prefLabel",
          whitespace,
          "xsd:string",
          model);

      Property pref = model.createProperty(SKOS.getURI(), "prefLabel");
      assertFalse(model.contains(entityResource, pref));
    }

    @Test
    @DisplayName("Non-blank xsd:string value should still be emitted")
    void nonBlankStringIsEmitted() throws Exception {
      JsonNode value = objectMapper.getNodeFactory().textNode("Pretty Name");
      invokePrivate(
          "addTypedProperty",
          new Class[] {Resource.class, String.class, JsonNode.class, String.class, Model.class},
          entityResource,
          "skos:prefLabel",
          value,
          "xsd:string",
          model);

      Property pref = model.createProperty(SKOS.getURI(), "prefLabel");
      assertTrue(model.contains(entityResource, pref, "Pretty Name"));
    }

    @Test
    @DisplayName("Blank value with a non-xsd:string type should still be emitted")
    void blankNonStringIsEmitted() throws Exception {
      // Non-string xsd types (numbers, booleans, dates) get their own validation
      // path elsewhere — the skip is intentionally narrow to xsd:string so it
      // doesn't accidentally drop "0" literals or similar.
      JsonNode zero = objectMapper.getNodeFactory().textNode("0");
      invokePrivate(
          "addTypedProperty",
          new Class[] {Resource.class, String.class, JsonNode.class, String.class, Model.class},
          entityResource,
          "om:counter",
          zero,
          "xsd:integer",
          model);

      Property counter = model.createProperty(OM_NS, "counter");
      assertTrue(model.contains(entityResource, counter));
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

  @Nested
  @DisplayName("TRANSLATOR_MANAGED_DIRECT_PREDICATES coverage")
  class TranslatorManagedPredicatesTests {

    @Test
    @DisplayName("Set must contain core direct URI predicates emitted by the translator")
    void testCoreSetMembership() {
      // These are emitted by addProvAttribution / addTagLabel / addEntityReference /
      // the structured-property handlers. If any are removed from the set, downstream
      // cleanup (JenaFusekiStorage.storeEntity) will leak stale state on entity updates.
      java.util.Set<String> required =
          java.util.Set.of(
              "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
              OM_NS + "hasOwner",
              PROV_NS + "wasAttributedTo",
              OM_NS + "hasTag",
              OM_NS + "hasGlossaryTerm",
              OM_NS + "hasTier",
              OM_NS + "belongsToDomain",
              OM_NS + "hasDataProduct",
              DCT_NS + "source",
              OM_NS + "sourceUrl",
              OM_NS + "hasLifeCycle",
              OM_NS + "hasCertification",
              OM_NS + "hasExtension",
              OM_NS + "hasCustomProperty");
      for (String pred : required) {
        assertTrue(
            RdfPropertyMapper.TRANSLATOR_MANAGED_DIRECT_PREDICATES.contains(pred),
            "TRANSLATOR_MANAGED_DIRECT_PREDICATES must include " + pred);
      }
    }

    @Test
    @DisplayName("Set must not include hook-managed lineage predicates")
    void testNoOverlapWithLineageHookPredicates() {
      // These are written by RdfRepository.addLineageWithDetails — including them here
      // would let storeEntity wipe lineage edges on every entity update.
      java.util.Set<String> lineageHookPredicates =
          java.util.Set.of(
              OM_NS + "UPSTREAM", PROV_NS + "wasDerivedFrom", OM_NS + "hasLineageDetails");
      for (String pred : lineageHookPredicates) {
        assertFalse(
            RdfPropertyMapper.TRANSLATOR_MANAGED_DIRECT_PREDICATES.contains(pred),
            "TRANSLATOR_MANAGED_DIRECT_PREDICATES must NOT include hook-managed " + pred);
      }
    }
  }
}
