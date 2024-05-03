package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public class GlossaryIndex implements SearchIndex {
  final Glossary glossary;

  public GlossaryIndex(Glossary glossary) {
    this.glossary = glossary;
  }

  @Override
  public Object getEntity() {
    return glossary;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(glossary.getName()).weight(5).build());
    if (glossary.getDisplayName() != null && !glossary.getDisplayName().isEmpty()) {
      suggest.add(SearchSuggest.builder().input(glossary.getDisplayName()).weight(10).build());
    }
    doc.put(
        "fqnParts",
        getFQNParts(
            glossary.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.GLOSSARY);
    doc.put("owner", getEntityWithDisplayName(glossary.getOwner()));
    doc.put(
        "totalVotes",
        CommonUtil.nullOrEmpty(glossary.getVotes())
            ? 0
            : glossary.getVotes().getUpVotes() - glossary.getVotes().getDownVotes());
    doc.put("domain", getEntityWithDisplayName(glossary.getDomain()));
    doc.put("followers", SearchIndexUtils.parseFollowers(glossary.getFollowers()));
    return doc;
  }
}
