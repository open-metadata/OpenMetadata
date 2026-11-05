package org.openmetadata.service.search.indexes;

import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.service.Entity;

public record DataContractIndex(DataContract dataContract) implements SearchIndex {
  /** Large or free-form contract blocks; indexing them would explode the dynamic mapping. */
  private static final Set<String> EXCLUDED_FIELDS =
      Set.of(
          "schema",
          "semantics",
          "qualityExpectations",
          "odcsQualityRules",
          "odcsElementExtensions",
          "contractUpdates",
          "sla",
          "security",
          "termsOfUse");

  @Override
  public Object getEntity() {
    return dataContract;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.DATA_CONTRACT;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    doc.put("entity", getEntityWithDisplayName(dataContract.getEntity()));
    doc.put("testSuite", getEntityWithDisplayName(dataContract.getTestSuite()));
    return doc;
  }

  @Override
  public Set<String> getExcludedFields() {
    return EXCLUDED_FIELDS;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}
