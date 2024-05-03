package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public record TestSuiteIndex(TestSuite testSuite) implements SearchIndex {

  @Override
  public Object getEntity() {
    return testSuite;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(testSuite.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(testSuite.getName()).weight(10).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            testSuite.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.TEST_SUITE);
    doc.put("owner", getEntityWithDisplayName(testSuite.getOwner()));
    doc.put("followers", SearchIndexUtils.parseFollowers(testSuite.getFollowers()));
    return doc;
  }
}
