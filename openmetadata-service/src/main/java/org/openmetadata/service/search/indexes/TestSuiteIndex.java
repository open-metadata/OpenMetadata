package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;

public record TestSuiteIndex(TestSuite testSuite) implements SearchIndex {
  @Override
  public Object getEntity() {
    return testSuite;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {

    doc.put("fqnParts", getFQNParts(testSuite.getFullyQualifiedName()));
    doc.put("entityType", Entity.TEST_SUITE);
    doc.put("owners", getEntitiesWithDisplayName(testSuite.getOwners()));
    doc.put("followers", SearchIndexUtils.parseFollowers(testSuite.getFollowers()));
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.TEST_SUITE, testSuite));
    doc.put("tags", parseTags.getTags());
    setParentRelationships(doc, testSuite);
    return doc;
  }

  private void setParentRelationships(Map<String, Object> doc, TestSuite testSuite) {
    // denormalize the parent relationships for search
    EntityReference entityReference = testSuite.getBasicEntityReference();
    if (entityReference == null) return;
    addTestSuiteParentEntityRelations(entityReference, doc);
  }

  static void addTestSuiteParentEntityRelations(
      EntityReference testSuiteRef, Map<String, Object> doc) {
    if (testSuiteRef.getType().equals(Entity.TABLE)) {
      Table table = Entity.getEntity(testSuiteRef, "", Include.ALL);
      doc.put("table", table.getEntityReference());
      doc.put("database", table.getDatabase());
      doc.put("databaseSchema", table.getDatabaseSchema());
      doc.put("service", table.getService());
    }
  }
}
