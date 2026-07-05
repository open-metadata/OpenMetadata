package org.openmetadata.service.search.indexes;

import java.util.Collections;
import java.util.HashSet;
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
import org.openmetadata.service.jdbi3.TestSuiteRepository;

public record TestSuiteIndex(TestSuite testSuite) implements TaggableIndex {
  private static final Set<String> excludeFields =
      Set.of(TestSuiteRepository.SUMMARY_FIELD, "testCaseResultSummary");

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

  @Override
  public Set<String> getRequiredReindexFields() {
    Set<String> fields = new HashSet<>(TaggableIndex.super.getRequiredReindexFields());
    fields.add(TestSuiteRepository.SUMMARY_FIELD);
    fields.add("tests");
    return Collections.unmodifiableSet(fields);
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
    Table linkedTable = addTestSuiteParentEntityRelations(entityReference, doc);
    if (linkedTable != null && linkedTable.getCertification() != null) {
      doc.put("certification", linkedTable.getCertification());
    }
  }

  static Table addTestSuiteParentEntityRelations(
      EntityReference testSuiteRef, Map<String, Object> doc) {
    if (testSuiteRef.getType().equals(Entity.TABLE)) {
      try {
        Table table =
            Entity.getEntity(testSuiteRef, "domains,certification,dataProducts", Include.ALL);
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
