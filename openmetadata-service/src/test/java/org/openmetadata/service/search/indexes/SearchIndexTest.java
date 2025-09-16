package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.util.FullyQualifiedName;

class SearchIndexTest {

  // Test the getFQNParts logic directly without instantiating SearchIndex
  private Set<String> getFQNParts(String fqn) {
    var parts = FullyQualifiedName.split(fqn);
    var entityName = parts[parts.length - 1];

    return FullyQualifiedName.getAllParts(fqn).stream()
        .filter(part -> !part.equals(entityName))
        .collect(Collectors.toSet());
  }

  @Test
  void testGetFQNParts_excludesEntityName() {
    String tableFqn = "service.database.schema.table";
    Set<String> parts = getFQNParts(tableFqn);
    assertFalse(parts.contains("table"), "Entity name 'table' should not be included in FQN parts");

    assertTrue(parts.contains("service"));
    assertTrue(parts.contains("database"));
    assertTrue(parts.contains("schema"));
    assertTrue(parts.contains("service.database"));
    assertTrue(parts.contains("service.database.schema"));
    assertTrue(parts.contains("service.database.schema.table"));
    assertTrue(parts.contains("database.schema"));
    assertTrue(parts.contains("schema.table"));
    assertTrue(parts.contains("database.schema.table"));
    assertEquals(9, parts.size());
  }

  @Test
  void testGetFQNParts_withDifferentPatterns() {
    // Test pipeline pattern: service.pipeline
    String pipelineFqn = "airflow.my_pipeline";
    Set<String> pipelineParts = getFQNParts(pipelineFqn);
    assertFalse(pipelineParts.contains("my_pipeline"), "Entity name should not be included");
    assertTrue(pipelineParts.contains("airflow"));
    assertEquals(2, pipelineParts.size());

    // Test dashboard pattern: service.dashboard
    String dashboardFqn = "looker.sales_dashboard";
    Set<String> dashboardParts = getFQNParts(dashboardFqn);
    assertFalse(dashboardParts.contains("sales_dashboard"), "Entity name should not be included");
    assertTrue(dashboardParts.contains("looker"));
    assertEquals(2, dashboardParts.size());

    // Test dashboard chart pattern: service.dashboard.chart
    String chartFqn = "tableau.analytics.revenue_chart";
    Set<String> chartParts = getFQNParts(chartFqn);
    assertFalse(chartParts.contains("revenue_chart"), "Entity name should not be included");
    assertTrue(chartParts.contains("tableau"));
    assertTrue(chartParts.contains("analytics"));
    assertTrue(chartParts.contains("tableau.analytics"));
    assertEquals(5, chartParts.size());
  }

  @Test
  void testGetFQNParts_withQuotedNames() {
    // Test with quoted names that contain dots
    String quotedFqn = "\"service.v1\".database.\"schema.prod\".\"table.users\"";
    Set<String> parts = getFQNParts(quotedFqn);

    // Verify that the entity name is not included
    assertFalse(parts.contains("\"table.users\""), "Entity name should not be included");
    assertFalse(parts.contains("table.users"), "Entity name should not be included");

    // Verify other parts are included
    assertTrue(parts.contains("\"service.v1\""));
    assertTrue(parts.contains("database"));
    assertTrue(parts.contains("\"schema.prod\""));
  }

  @Test
  void testGetFQNParts_withSinglePart() {
    // Test with a single part FQN (edge case)
    String singlePartFqn = "standalone_entity";
    Set<String> parts = getFQNParts(singlePartFqn);

    // Should return empty set since we exclude the entity name
    assertTrue(parts.isEmpty(), "Single part FQN should return empty set");
  }
}
