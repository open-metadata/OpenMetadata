package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public class GlossaryTermIndex implements SearchIndex {
  final GlossaryTerm glossaryTerm;

  public GlossaryTermIndex(GlossaryTerm glossaryTerm) {
    this.glossaryTerm = glossaryTerm;
  }

  @Override
  public Object getEntity() {
    return glossaryTerm;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(glossaryTerm.getName()).weight(5).build());
    if (glossaryTerm.getDisplayName() != null && !glossaryTerm.getDisplayName().isEmpty()) {
      suggest.add(SearchSuggest.builder().input(glossaryTerm.getDisplayName()).weight(10).build());
    }
    doc.put(
        "fqnParts",
        getFQNParts(
            glossaryTerm.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.GLOSSARY_TERM);
    doc.put(
        "totalVotes",
        CommonUtil.nullOrEmpty(glossaryTerm.getVotes())
            ? 0
            : glossaryTerm.getVotes().getUpVotes() - glossaryTerm.getVotes().getDownVotes());
    doc.put("owner", getEntityWithDisplayName(glossaryTerm.getOwner()));
    doc.put("domain", getEntityWithDisplayName(glossaryTerm.getDomain()));
    doc.put("followers", SearchIndexUtils.parseFollowers(glossaryTerm.getFollowers()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("synonyms", 5.0f);
    fields.put("synonyms.ngram", 1.0f);
    fields.put("glossary.name", 5.0f);
    fields.put("glossary.displayName", 5.0f);
    return fields;
  }
}
