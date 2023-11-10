package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class TestSuiteIndex implements SearchIndex {
  final TestSuite testSuite;

  private static final List<String> excludeFields = List.of("changeDescription");

  public TestSuiteIndex(TestSuite testSuite) {
    this.testSuite = testSuite;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(testSuite);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(testSuite.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(testSuite.getName()).weight(10).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            testSuite.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.TEST_SUITE);
    doc.put("owner", getEntityWithDisplayName(testSuite.getOwner()));
    return doc;
  }
}
