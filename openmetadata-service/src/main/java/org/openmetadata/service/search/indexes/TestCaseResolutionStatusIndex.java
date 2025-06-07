package org.openmetadata.service.search.indexes;

import java.util.HashMap;
import java.util.Map;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

public record TestCaseResolutionStatusIndex(TestCaseResolutionStatus testCaseResolutionStatus)
    implements SearchIndex {
  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    doc.put(
        "fqnParts",
        getFQNParts(testCaseResolutionStatus.getTestCaseReference().getFullyQualifiedName()));
    doc.put("@timestamp", testCaseResolutionStatus.getTimestamp());
    setParentRelationships(doc);
    return doc;
  }

  @Override
  public Object getEntity() {
    return testCaseResolutionStatus;
  }

  private void setParentRelationships(Map<String, Object> doc) {
    // denormalize the parent relationships for search
    EntityReference testCaseReference = testCaseResolutionStatus.getTestCaseReference();
    TestCase testCase =
        Entity.getEntityOrNull(testCaseReference, "testSuite,domain,tags,owners", Include.ALL);
    if (testCase == null) return;
    testCase =
        new TestCase()
            .withId(testCase.getId())
            .withName(testCase.getName())
            .withFullyQualifiedName(testCase.getFullyQualifiedName())
            .withDescription(testCase.getDescription())
            .withDisplayName(testCase.getDisplayName())
            .withDeleted(testCase.getDeleted())
            .withDomain(testCase.getDomain())
            .withTags(testCase.getTags())
            .withEntityFQN(testCase.getEntityFQN())
            .withOwners(testCase.getOwners());
    doc.put("testCase", testCase);
    TestSuite testSuite = Entity.getEntityOrNull(testCase.getTestSuite(), "", Include.ALL);
    if (testSuite == null) return;
    doc.put("testSuite", testSuite.getEntityReference());
    if (testSuite.getBasicEntityReference() != null) {
      TestSuiteIndex.addTestSuiteParentEntityRelations(testSuite.getBasicEntityReference(), doc);
    }
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = new HashMap<>();
    fields.put("testCaseResolutionStatusType", 1.0f);
    fields.put("testCaseReference.displayName", 15.0f);
    fields.put("testCaseReference.name", 10.0f);
    fields.put("testCaseReference.description", 1.0f);
    fields.put("testCaseResolutionStatusDetails.resolved.testCaseFailureComment", 10.0f);
    return fields;
  }
}
