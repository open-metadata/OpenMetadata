package org.openmetadata.service.resources.searchindex;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class SearchIndexMapper implements EntityMapper<SearchIndex, CreateSearchIndex> {
  @Override
  public SearchIndex createToEntity(CreateSearchIndex create, String user) {
    return copy(new SearchIndex(), create, user)
        .withService(getEntityReference(Entity.SEARCH_SERVICE, create.getService()))
        .withFields(create.getFields())
        .withSearchIndexSettings(create.getSearchIndexSettings())
        .withSourceHash(create.getSourceHash())
        .withIndexType(create.getIndexType());
  }
}
