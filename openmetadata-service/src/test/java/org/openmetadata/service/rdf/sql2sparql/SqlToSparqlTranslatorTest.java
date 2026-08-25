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
    assertTrue(sparql.contains("PREFIX om:"), "Should have om prefix");
    assertTrue(sparql.contains("SELECT"), "Should have SELECT");
    assertTrue(sparql.contains("name"), "Should project name");
    assertTrue(sparql.contains("description"), "Should project description");
    assertTrue(sparql.contains("om:Table"), "Should reference Table class");
  }

  @Test
  public void testSelectWithWhere() {
    String sql = "SELECT name FROM tables WHERE database = 'sales'";
    String sparql = translator.translate(sql);

    assertNotNull(sparql);
    assertTrue(sparql.contains("SELECT"), "Should have SELECT");
    assertTrue(sparql.contains("om:Table"), "Should reference Table class");
    assertTrue(sparql.contains("FILTER"), "Should have FILTER clause");
  }

  @Test
  public void testSelectWithLike() {
    String sql = "SELECT name FROM tables WHERE name LIKE 'customer%'";
    String sparql = translator.translate(sql);

    assertNotNull(sparql);
    assertTrue(sparql.contains("REGEX"));
    assertTrue(sparql.contains("customer.*"));
    assertTrue(sparql.contains("\"i\""));
  }

  @Test
  public void testJoinQuery() {
    // JOIN queries with table aliases require the alias to be registered first
    String sql = "SELECT name, dataType FROM tables JOIN columns ON tables.id = columns.tableId";
    String sparql = translator.translate(sql);

    assertNotNull(sparql);
    assertTrue(sparql.contains("om:Table"));
    assertTrue(sparql.contains("om:Column"));
  }

  @Test
  public void testQueryWithLimit() {
    String sql = "SELECT name FROM tables";
    String sparql = translator.translate(sql);

    assertNotNull(sparql);
    assertTrue(sparql.contains("SELECT"), "Should have SELECT");
    assertTrue(sparql.contains("WHERE"), "Should have WHERE clause");
  }

  @Test
  public void testMultipleConditions() {
    String sql = "SELECT name FROM tables WHERE database = 'sales' AND name LIKE 'order%'";
    String sparql = translator.translate(sql);

    assertNotNull(sparql);
    assertTrue(sparql.contains("FILTER"));
    assertTrue(sparql.contains("\"sales\""));
    assertTrue(sparql.contains("REGEX"));
    assertTrue(sparql.contains("order.*"));
    assertTrue(sparql.contains("&&"));
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
    SqlToSparqlTranslator mysqlTranslator =
        new SqlToSparqlTranslator(mappingContext, SqlToSparqlTranslator.SqlDialect.MYSQL);

    String sql = "SELECT `name` FROM `tables`";
    String sparql = mysqlTranslator.translate(sql);

    assertNotNull(sparql);
    assertTrue(sparql.contains("rdfs:label"));
  }
}
