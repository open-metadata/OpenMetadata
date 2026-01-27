package org.openmetadata.service.rdf.sql2sparql;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

@DisplayName("SPARQL Builder Tests for Nested/Structured Fields")
class SparqlBuilderNestedFieldsTest {

  private SqlMappingContext mappingContext;

  @BeforeEach
  void setUp() {
    mappingContext = SqlMappingContext.createDefault();
  }

  @Nested
  @DisplayName("SqlMappingContext Nested Mapping Configuration")
  class MappingContextTests {

    @Test
    @DisplayName("Tables should have votes nested mapping")
    void testTablesHasVotesMapping() {
      var tableMapping = mappingContext.getTableMapping("tables");

      assertTrue(tableMapping.isPresent());
      var nestedMapping = tableMapping.get().getNestedMapping("votes");
      assertTrue(nestedMapping.isPresent());
      assertEquals("om:hasVotes", nestedMapping.get().getParentProperty());
      assertEquals("om:Votes", nestedMapping.get().getNestedClass());
    }

    @Test
    @DisplayName("Votes nested mapping should have upVotes field")
    void testVotesHasUpVotesField() {
      var tableMapping = mappingContext.getTableMapping("tables");
      assertTrue(tableMapping.isPresent());

      var nestedMapping = tableMapping.get().getNestedMapping("votes");
      assertTrue(nestedMapping.isPresent());

      var upVotesField = nestedMapping.get().getField("upVotes");
      assertTrue(upVotesField.isPresent());
      assertEquals("om:upVotes", upVotesField.get().getRdfProperty());
      assertEquals("xsd:integer", upVotesField.get().getDataType());
    }

    @Test
    @DisplayName("Votes nested mapping should have downVotes field")
    void testVotesHasDownVotesField() {
      var tableMapping = mappingContext.getTableMapping("tables");
      assertTrue(tableMapping.isPresent());

      var nestedMapping = tableMapping.get().getNestedMapping("votes");
      assertTrue(nestedMapping.isPresent());

      var downVotesField = nestedMapping.get().getField("downVotes");
      assertTrue(downVotesField.isPresent());
      assertEquals("om:downVotes", downVotesField.get().getRdfProperty());
    }

    @Test
    @DisplayName("Tables should have changeDescription nested mapping")
    void testTablesHasChangeDescriptionMapping() {
      var tableMapping = mappingContext.getTableMapping("tables");

      assertTrue(tableMapping.isPresent());
      var nestedMapping = tableMapping.get().getNestedMapping("changeDescription");
      assertTrue(nestedMapping.isPresent());
      assertEquals("om:hasChangeDescription", nestedMapping.get().getParentProperty());
      assertEquals("om:ChangeDescription", nestedMapping.get().getNestedClass());
    }

    @Test
    @DisplayName("ChangeDescription should have previousVersion field")
    void testChangeDescriptionHasPreviousVersionField() {
      var tableMapping = mappingContext.getTableMapping("tables");
      assertTrue(tableMapping.isPresent());

      var nestedMapping = tableMapping.get().getNestedMapping("changeDescription");
      assertTrue(nestedMapping.isPresent());

      var field = nestedMapping.get().getField("previousVersion");
      assertTrue(field.isPresent());
      assertEquals("om:previousVersion", field.get().getRdfProperty());
    }

    @Test
    @DisplayName("Tables should have lifeCycle nested mapping")
    void testTablesHasLifeCycleMapping() {
      var tableMapping = mappingContext.getTableMapping("tables");

      assertTrue(tableMapping.isPresent());
      var nestedMapping = tableMapping.get().getNestedMapping("lifeCycle");
      assertTrue(nestedMapping.isPresent());
      assertEquals("om:hasLifeCycle", nestedMapping.get().getParentProperty());
    }
  }

  @Nested
  @DisplayName("Lineage Table Mapping Tests")
  class LineageTableMappingTests {

    @Test
    @DisplayName("Lineage table should exist")
    void testLineageTableExists() {
      var lineageMapping = mappingContext.getTableMapping("lineage");
      assertTrue(lineageMapping.isPresent());
      assertEquals("om:LineageDetails", lineageMapping.get().getRdfClass());
    }

    @Test
    @DisplayName("Lineage should have upstream column with PROV-O mapping")
    void testLineageUpstreamMapping() {
      var lineageMapping = mappingContext.getTableMapping("lineage");
      assertTrue(lineageMapping.isPresent());

      var upstreamColumn = lineageMapping.get().getColumnMapping("upstream");
      assertTrue(upstreamColumn.isPresent());
      assertEquals("prov:wasDerivedFrom", upstreamColumn.get().getRdfProperty());
      assertTrue(upstreamColumn.get().isObjectProperty());
    }

    @Test
    @DisplayName("Lineage should have downstream column with PROV-O mapping")
    void testLineageDownstreamMapping() {
      var lineageMapping = mappingContext.getTableMapping("lineage");
      assertTrue(lineageMapping.isPresent());

      var downstreamColumn = lineageMapping.get().getColumnMapping("downstream");
      assertTrue(downstreamColumn.isPresent());
      assertEquals("prov:wasInfluencedBy", downstreamColumn.get().getRdfProperty());
    }

    @Test
    @DisplayName("Lineage should have pipeline column with wasGeneratedBy mapping")
    void testLineagePipelineMapping() {
      var lineageMapping = mappingContext.getTableMapping("lineage");
      assertTrue(lineageMapping.isPresent());

      var pipelineColumn = lineageMapping.get().getColumnMapping("pipeline");
      assertTrue(pipelineColumn.isPresent());
      assertEquals("prov:wasGeneratedBy", pipelineColumn.get().getRdfProperty());
    }

    @Test
    @DisplayName("Lineage should have sqlQuery column")
    void testLineageSqlQueryMapping() {
      var lineageMapping = mappingContext.getTableMapping("lineage");
      assertTrue(lineageMapping.isPresent());

      var sqlQueryColumn = lineageMapping.get().getColumnMapping("sqlQuery");
      assertTrue(sqlQueryColumn.isPresent());
      assertEquals("om:sqlQuery", sqlQueryColumn.get().getRdfProperty());
    }

    @Test
    @DisplayName("Lineage should have columnsLineage nested mapping")
    void testLineageColumnsLineageMapping() {
      var lineageMapping = mappingContext.getTableMapping("lineage");
      assertTrue(lineageMapping.isPresent());

      var nestedMapping = lineageMapping.get().getNestedMapping("columnsLineage");
      assertTrue(nestedMapping.isPresent());
      assertEquals("om:hasColumnLineage", nestedMapping.get().getParentProperty());
    }

    @Test
    @DisplayName("ColumnsLineage nested should have toColumn field")
    void testColumnsLineageToColumnField() {
      var lineageMapping = mappingContext.getTableMapping("lineage");
      assertTrue(lineageMapping.isPresent());

      var nestedMapping = lineageMapping.get().getNestedMapping("columnsLineage");
      assertTrue(nestedMapping.isPresent());

      var toColumnField = nestedMapping.get().getField("toColumn");
      assertTrue(toColumnField.isPresent());
      assertEquals("om:toColumn", toColumnField.get().getRdfProperty());
    }
  }

  @Nested
  @DisplayName("Prefix Configuration Tests")
  class PrefixTests {

    @Test
    @DisplayName("Should have PROV-O prefix configured")
    void testProvOPrefixConfigured() {
      String prefixes = mappingContext.getPrefixDeclarations();
      assertTrue(prefixes.contains("PREFIX prov: <http://www.w3.org/ns/prov#>"));
    }

    @Test
    @DisplayName("Should have OpenMetadata prefix configured")
    void testOmPrefixConfigured() {
      String prefixes = mappingContext.getPrefixDeclarations();
      assertTrue(prefixes.contains("PREFIX om: <https://open-metadata.org/ontology/>"));
    }

    @Test
    @DisplayName("Should have RDFS prefix configured")
    void testRdfsPrefixConfigured() {
      String prefixes = mappingContext.getPrefixDeclarations();
      assertTrue(prefixes.contains("PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>"));
    }

    @Test
    @DisplayName("Should have XSD prefix configured")
    void testXsdPrefixConfigured() {
      String prefixes = mappingContext.getPrefixDeclarations();
      assertTrue(prefixes.contains("PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>"));
    }

    @Test
    @DisplayName("Should have DCT prefix configured")
    void testDctPrefixConfigured() {
      String prefixes = mappingContext.getPrefixDeclarations();
      assertTrue(prefixes.contains("PREFIX dct: <http://purl.org/dc/terms/>"));
    }
  }

  @Nested
  @DisplayName("TableMapping Nested Field Detection Tests")
  class NestedFieldDetectionTests {

    @Test
    @DisplayName("hasNestedField should detect votes")
    void testHasNestedFieldVotes() {
      var tableMapping = mappingContext.getTableMapping("tables");
      assertTrue(tableMapping.isPresent());
      assertTrue(tableMapping.get().hasNestedField("votes"));
    }

    @Test
    @DisplayName("hasNestedField should detect changeDescription")
    void testHasNestedFieldChangeDescription() {
      var tableMapping = mappingContext.getTableMapping("tables");
      assertTrue(tableMapping.isPresent());
      assertTrue(tableMapping.get().hasNestedField("changeDescription"));
    }

    @Test
    @DisplayName("hasNestedField should detect votes.upVotes path")
    void testHasNestedFieldVotesUpVotes() {
      var tableMapping = mappingContext.getTableMapping("tables");
      assertTrue(tableMapping.isPresent());
      assertTrue(tableMapping.get().hasNestedField("votes.upVotes"));
    }

    @Test
    @DisplayName("hasNestedField should return false for unknown field")
    void testHasNestedFieldUnknown() {
      var tableMapping = mappingContext.getTableMapping("tables");
      assertTrue(tableMapping.isPresent());
      assertFalse(tableMapping.get().hasNestedField("unknownField"));
    }
  }

  @Nested
  @DisplayName("SQL to SPARQL Basic Translation Tests")
  class SqlTranslationTests {

    private SqlToSparqlTranslator translator;

    @BeforeEach
    void setUp() {
      translator = new SqlToSparqlTranslator(mappingContext);
    }

    @Test
    @DisplayName("Should translate simple SELECT from tables")
    void testSimpleSelect() {
      String sql = "SELECT name, description FROM tables";
      String sparql = translator.translate(sql);

      assertNotNull(sparql);
      assertTrue(sparql.contains("om:Table"));
      assertTrue(sparql.contains("SELECT"));
      assertTrue(sparql.contains("WHERE"));
    }

    @Test
    @DisplayName("Should translate SELECT from lineage table")
    void testLineageSelect() {
      String sql = "SELECT sqlQuery FROM lineage";
      String sparql = translator.translate(sql);

      assertNotNull(sparql);
      assertTrue(sparql.contains("om:LineageDetails"));
      assertTrue(sparql.contains("om:sqlQuery"));
    }

    @Test
    @DisplayName("Should translate SELECT upstream from lineage with PROV-O")
    void testLineageUpstreamSelect() {
      String sql = "SELECT upstream FROM lineage";
      String sparql = translator.translate(sql);

      assertNotNull(sparql);
      assertTrue(sparql.contains("prov:wasDerivedFrom"));
    }

    @Test
    @DisplayName("Should translate SELECT pipeline from lineage")
    void testLineagePipelineSelect() {
      String sql = "SELECT pipeline FROM lineage";
      String sparql = translator.translate(sql);

      assertNotNull(sparql);
      assertTrue(sparql.contains("prov:wasGeneratedBy"));
    }

    @Test
    @DisplayName("Should handle unknown table gracefully")
    void testUnknownTable() {
      String sql = "SELECT * FROM unknown_table";
      assertThrows(Exception.class, () -> translator.translate(sql));
    }
  }

  @Nested
  @DisplayName("ColumnMapping ObjectProperty Tests")
  class ColumnMappingTests {

    @Test
    @DisplayName("@id dataType should be marked as object property")
    void testObjectPropertyDetection() {
      var lineageMapping = mappingContext.getTableMapping("lineage");
      assertTrue(lineageMapping.isPresent());

      var upstreamColumn = lineageMapping.get().getColumnMapping("upstream");
      assertTrue(upstreamColumn.isPresent());
      assertTrue(upstreamColumn.get().isObjectProperty());
    }

    @Test
    @DisplayName("xsd:string dataType should not be object property")
    void testNonObjectPropertyDetection() {
      var lineageMapping = mappingContext.getTableMapping("lineage");
      assertTrue(lineageMapping.isPresent());

      var sqlQueryColumn = lineageMapping.get().getColumnMapping("sqlQuery");
      assertTrue(sqlQueryColumn.isPresent());
      assertFalse(sqlQueryColumn.get().isObjectProperty());
    }
  }
}
