package org.openmetadata.service.jdbi3;

import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.SearchConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.storage.StorageServiceResource;
import org.openmetadata.service.search.SearchRepository;

public class SearchServiceRepository extends ServiceEntityRepository<SearchService, SearchConnection> {
  public SearchServiceRepository(CollectionDAO dao, SearchRepository searchRepository) {
    super(
        StorageServiceResource.COLLECTION_PATH,
        Entity.SEARCH_SERVICE,
        dao,
        searchRepository,
        dao.searchServiceDAO(),
        SearchConnection.class,
        "",
        ServiceType.SEARCH);
    supportsSearch = true;
  }
}
