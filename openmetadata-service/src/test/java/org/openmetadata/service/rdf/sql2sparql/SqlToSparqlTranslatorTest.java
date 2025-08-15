package org.openmetadata.service.rdf.sql2sparql;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

public class SqlToSparqlTranslatorTest {

  private SqlToSparqlTranslator translator;
  private SqlMappingContext mappingContext;

  @BeforeEach
  public void setUp() {
    mappingContext = SqlMappingContext.createDefault();
    translator = new SqlToSparqlTranslator(mappingContext);
  }

  @Test
  public void testSimpleSelect() {
    String sql = "SELECT name, description FROM tables";
    String sparql = translator.translate(sql);

    assertNotNull(sparql);
    assertTrue(sparql.contains("PREFIX om: <https://open-metadata.org/ontology/>"));
    assertTrue(sparql.contains("SELECT ?var1_name ?var1_description"));
    assertTrue(sparql.contains("?var1 a om:Table"));
    assertTrue(sparql.contains("?var1 om:name ?var1_name"));
    assertTrue(sparql.contains("?var1 om:description ?var1_description"));
  }

  @Test
  public void testSelectWithWhere() {
    String sql = "SELECT name FROM tables WHERE database = 'sales'";
    String sparql = translator.translate(sql);

    assertNotNull(sparql);
    assertTrue(sparql.contains("SELECT ?var1_name"));
    assertTrue(sparql.contains("?var1 a om:Table"));
    assertTrue(sparql.contains("FILTER (?var1_database = \"sales\")"));
  }

  @Test
  public void testSelectWithLike() {
    String sql = "SELECT name FROM tables WHERE name LIKE 'customer%'";
    String sparql = translator.translate(sql);

    assertNotNull(sparql);
    assertTrue(sparql.contains("REGEX(?var1_name, \"customer.*\", \"i\")"));
  }

  @Test
  public void testJoinQuery() {
    String sql = "SELECT t.name, c.dataType FROM tables t JOIN columns c ON t.id = c.tableId";
    String sparql = translator.translate(sql);

    assertNotNull(sparql);
    assertTrue(sparql.contains("?var1 a om:Table"));
    assertTrue(sparql.contains("?var2 a om:Column"));
    assertTrue(sparql.contains("?var1 om:id ?var2"));
  }

  @Test
  public void testOrderByLimit() {
    String sql = "SELECT name FROM tables ORDER BY name DESC LIMIT 10";
    String sparql = translator.translate(sql);

    assertNotNull(sparql);
    assertTrue(sparql.contains("ORDER BY ?var1_name DESC"));
    assertTrue(sparql.contains("LIMIT 10"));
  }

  @Test
  public void testMultipleConditions() {
    String sql = "SELECT name FROM tables WHERE database = 'sales' AND name LIKE 'order%'";
    String sparql = translator.translate(sql);

    assertNotNull(sparql);
    assertTrue(
        sparql.contains(
            "FILTER (?var1_database = \"sales\" && REGEX(?var1_name, \"order.*\", \"i\"))"));
  }

  @Test
  public void testInvalidSql() {
    String sql = "INVALID SQL QUERY";

    assertThrows(Exception.class, () -> translator.translate(sql));
  }

  @Test
  public void testUnknownTable() {
    String sql = "SELECT * FROM unknown_table";

    assertThrows(Exception.class, () -> translator.translate(sql));
  }

  @Test
  public void testCaching() {
    String sql = "SELECT name FROM tables";

    // First translation
    String sparql1 = translator.translate(sql);

    // Second translation (should be cached)
    String sparql2 = translator.translate(sql);

    assertEquals(sparql1, sparql2);
  }

  @Test
  public void testDialectSupport() {
    // Test MySQL dialect
    SqlToSparqlTranslator mysqlTranslator =
        new SqlToSparqlTranslator(mappingContext, SqlToSparqlTranslator.SqlDialect.MYSQL);

    String sql = "SELECT `name` FROM `tables`";
    String sparql = mysqlTranslator.translate(sql);

    assertNotNull(sparql);
    assertTrue(sparql.contains("om:name"));
  }
}
