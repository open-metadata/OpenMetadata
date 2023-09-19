package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class TestSuiteIndex implements ElasticSearchIndex {
  final TestSuite testSuite;

  private static final List<String> excludeFields = List.of("changeDescription");

  public TestSuiteIndex(TestSuite testSuite) {
    this.testSuite = testSuite;
  }

  public Map<String, Object> buildESDoc() {
    if (testSuite.getOwner() != null) {
      EntityReference owner = testSuite.getOwner();
      owner.setDisplayName(CommonUtil.nullOrEmpty(owner.getDisplayName()) ? owner.getName() : owner.getDisplayName());
      testSuite.setOwner(owner);
    }
    Map<String, Object> doc = JsonUtils.getMap(testSuite);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(testSuite.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(testSuite.getName()).weight(10).build());
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.TEST_SUITE);
    return doc;
  }
}
