package org.openmetadata.service.resources.services.searchIndexes;

import org.openmetadata.schema.api.services.CreateSearchService;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.service.mapper.EntityMapper;

public class SearchServiceMapper implements EntityMapper<SearchService, CreateSearchService> {
  @Override
  public SearchService createToEntity(CreateSearchService create, String user) {
    return copy(new SearchService(), create, user)
        .withServiceType(create.getServiceType())
        .withConnection(create.getConnection())
        .withIngestionRunner(create.getIngestionRunner());
  }
}
