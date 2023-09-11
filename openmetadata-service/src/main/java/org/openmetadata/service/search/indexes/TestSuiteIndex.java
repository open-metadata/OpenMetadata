package org.openmetadata.service.search.indexes;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.util.JsonUtils;

public class TestSuiteIndex implements ElasticSearchIndex {
  final TestSuite testSuite;

  private static final List<String> excludeFields = List.of("changeDescription");

  public TestSuiteIndex(TestSuite testSuite) {
    this.testSuite = testSuite;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(testSuite);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    return doc;
  }
}
