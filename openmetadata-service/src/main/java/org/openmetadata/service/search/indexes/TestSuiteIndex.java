package org.openmetadata.service.search.indexes;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;

public record TestSuiteIndex(TestSuite testSuite) implements TaggableIndex {
  private static final Set<String> excludeFields = Set.of("summary", "testCaseResultSummary");

  @Override
  public Object getEntity() {
    return testSuite;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.TEST_SUITE;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeFields;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    setParentRelationships(doc, testSuite);

    List<ResultSummary> resultSummaries = testSuite.getTestCaseResultSummary();
    if (resultSummaries != null && !resultSummaries.isEmpty()) {
      long maxTimestamp =
          resultSummaries.stream().mapToLong(ResultSummary::getTimestamp).max().orElse(0L);
      doc.put("lastResultTimestamp", maxTimestamp);
    } else {
      doc.put("lastResultTimestamp", 0L);
    }

    return doc;
  }

  private void setParentRelationships(Map<String, Object> doc, TestSuite testSuite) {
    EntityReference entityReference = testSuite.getBasicEntityReference();
    if (entityReference == null) return;
    addTestSuiteParentEntityRelations(entityReference, doc);
  }

  static Table addTestSuiteParentEntityRelations(
      EntityReference testSuiteRef, Map<String, Object> doc) {
    if (testSuiteRef.getType().equals(Entity.TABLE)) {
      try {
        Table table = Entity.getEntity(testSuiteRef, "domains", Include.ALL);
        doc.put("table", table.getEntityReference());
        doc.put("database", table.getDatabase());
        doc.put("databaseSchema", table.getDatabaseSchema());
        doc.put("service", table.getService());
        return table;
      } catch (EntityNotFoundException ex) {
        LOG.warn(
            "Table [{}] not found during search indexing: {}",
            testSuiteRef.getId(),
            ex.getMessage());
      }
    }
    return null;
  }
}
