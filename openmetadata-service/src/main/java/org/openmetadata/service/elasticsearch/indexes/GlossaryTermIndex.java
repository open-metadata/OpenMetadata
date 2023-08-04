package org.openmetadata.service.elasticsearch.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexUtils;
import org.openmetadata.service.elasticsearch.models.ElasticSearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class GlossaryTermIndex implements ElasticSearchIndex {
  final GlossaryTerm glossaryTerm;
  final List<String> excludeFields = List.of("changeDescription");

  public GlossaryTermIndex(GlossaryTerm glossaryTerm) {
    this.glossaryTerm = glossaryTerm;
  }

  public Map<String, Object> buildESDoc() {
    if (glossaryTerm.getOwner() != null) {
      EntityReference owner = glossaryTerm.getOwner();
      owner.setDisplayName(CommonUtil.nullOrEmpty(owner.getDisplayName()) ? owner.getName() : owner.getDisplayName());
      glossaryTerm.setOwner(owner);
    }
    Map<String, Object> doc = JsonUtils.getMap(glossaryTerm);
    ElasticSearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<ElasticSearchSuggest> suggest = new ArrayList<>();
    suggest.add(ElasticSearchSuggest.builder().input(glossaryTerm.getName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(glossaryTerm.getDisplayName()).weight(10).build());
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.GLOSSARY_TERM);
    return doc;
  }
}
