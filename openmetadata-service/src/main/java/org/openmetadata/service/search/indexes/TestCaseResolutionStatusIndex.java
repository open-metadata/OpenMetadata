package org.openmetadata.service.search.indexes;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.EntityUtil;

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

  @Override
  public String getEntityTypeName() {
    return Entity.TEST_CASE_RESOLUTION_STATUS;
  }

  private void setParentRelationships(Map<String, Object> doc) {
    // denormalize the parent relationships for search
    EntityReference testCaseReference = testCaseResolutionStatus.getTestCaseReference();
    TestCase testCase =
        Entity.getEntityOrNull(testCaseReference, "testSuite,domains,tags,owners", Include.ALL);
    if (testCase == null) return;
    Table parentTable = resolveParentTable(testCase);
    if (parentTable != null) {
      doc.put("table", parentTable.getEntityReference());
    }
    testCase =
        new TestCase()
            .withId(testCase.getId())
            .withName(testCase.getName())
            .withFullyQualifiedName(testCase.getFullyQualifiedName())
            .withDescription(testCase.getDescription())
            .withDisplayName(testCase.getDisplayName())
            .withDeleted(testCase.getDeleted())
            .withDomains(testCase.getDomains())
            .withTags(tagsWithParentTerms(testCase, parentTable))
            .withEntityFQN(testCase.getEntityFQN())
            .withOwners(testCase.getOwners());
    doc.put("testCase", testCase);

    // Promote inherited domains to top level for standard domain filtering
    if (!nullOrEmpty(testCase.getDomains())) {
      doc.put("domains", getEntitiesWithDisplayName(testCase.getDomains()));
    }

    TestSuite testSuite = Entity.getEntityOrNull(testCase.getTestSuite(), "", Include.ALL);
    if (testSuite == null) return;
    doc.put("testSuite", testSuite.getEntityReference());
    if (testSuite.getBasicEntityReference() != null) {
      Table linkedTable =
          TestSuiteIndex.addTestSuiteParentEntityRelations(
              testSuite.getBasicEntityReference(), doc);
      if (linkedTable != null && linkedTable.getCertification() != null) {
        doc.put("certification", linkedTable.getCertification());
      }
    }
  }

  /**
   * A glossary term on the table is projected onto its children at read time and is never stored, so
   * nothing on the test case itself can reproduce it here. Deriving it while the document is built
   * keeps a rebuild — a reindex, or an incident raised after the table was tagged — from writing the
   * term back out of existence, and leaves the cascade responsible only for documents that already
   * exist.
   */
  private List<TagLabel> tagsWithParentTerms(TestCase testCase, Table parentTable) {
    List<TagLabel> tags = new ArrayList<>(listOrEmpty(testCase.getTags()));
    if (parentTable != null) {
      EntityUtil.mergeTags(tags, Entity.propagatedParentTags(parentTable.getTags()));
    }
    return tags;
  }

  /**
   * The mapping declares {@code table}, but this document only ever populated it further down, from
   * the test suite's {@code basicEntityReference} — and the suite is loaded with no fields, so that
   * reference is usually absent and {@code table} was left unset. Anything that finds time-series
   * children by {@code table.id}, including the glossary-tag cascade, therefore could not reach an
   * incident. Resolve it from the test case's entity link instead, the way {@code
   * TestCaseResultIndex} does, so it does not depend on how the suite happens to be hydrated.
   */
  private Table resolveParentTable(TestCase testCase) {
    if (nullOrEmpty(testCase.getEntityLink())) {
      return null;
    }
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(testCase.getEntityLink());
    if (!Entity.TABLE.equals(entityLink.getEntityType())) {
      return null;
    }
    Table table = null;
    try {
      table = Entity.getEntityByName(Entity.TABLE, entityLink.getEntityFQN(), "tags", Include.ALL);
    } catch (EntityNotFoundException ex) {
      LOG.warn(
          "Table [{}] not found during search indexing: {}",
          entityLink.getEntityFQN(),
          ex.getMessage());
    }
    return table;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = new HashMap<>();
    fields.put("testCaseResolutionStatusType", 1.0f);
    fields.put("testCaseReference.displayName", 15.0f);
    fields.put("testCaseReference.name", 10.0f);
    fields.put("testCaseReference.description", 1.0f);
    fields.put("testCaseResolutionStatusDetails.testCaseFailureComment", 10.0f);
    return fields;
  }
}
