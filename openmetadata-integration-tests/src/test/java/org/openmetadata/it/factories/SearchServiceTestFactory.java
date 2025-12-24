package org.openmetadata.it.factories;

import java.net.URI;
import java.util.UUID;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.services.CreateSearchService;
import org.openmetadata.schema.api.services.CreateSearchService.SearchServiceType;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.schema.services.connections.search.ElasticSearchConnection;
import org.openmetadata.schema.services.connections.search.OpenSearchConnection;
import org.openmetadata.schema.type.SearchConnection;

/**
 * Factory for creating SearchService entities in integration tests.
 *
 * <p>Provides namespace-isolated entity creation with consistent patterns.
 */
public class SearchServiceTestFactory {

  /**
   * Create an ElasticSearch service with default settings. Each call creates a unique service to
   * avoid conflicts in parallel test execution.
   */
  public static SearchService createElasticSearch(TestNamespace ns) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String name = ns.prefix("elasticService_" + uniqueId);

    ElasticSearchConnection esConn =
        new ElasticSearchConnection().withHostPort(URI.create("http://localhost:9200"));

    SearchConnection conn = new SearchConnection().withConfig(esConn);

    CreateSearchService request =
        new CreateSearchService()
            .withName(name)
            .withServiceType(SearchServiceType.ElasticSearch)
            .withConnection(conn)
            .withDescription("Test ElasticSearch service");

    return SdkClients.adminClient().searchServices().create(request);
  }

  /**
   * Create an OpenSearch service with default settings. Each call creates a unique service to
   * avoid conflicts in parallel test execution.
   */
  public static SearchService createOpenSearch(TestNamespace ns) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String name = ns.prefix("openSearchService_" + uniqueId);

    // Use OpenSearchConnection for OpenSearch service type
    OpenSearchConnection osConn =
        new OpenSearchConnection().withHostPort(URI.create("http://localhost:9200"));

    SearchConnection conn = new SearchConnection().withConfig(osConn);

    CreateSearchService request =
        new CreateSearchService()
            .withName(name)
            .withServiceType(SearchServiceType.OpenSearch)
            .withConnection(conn)
            .withDescription("Test OpenSearch service");

    return SdkClients.adminClient().searchServices().create(request);
  }

  /** Get search service by ID. */
  public static SearchService getById(String id) {
    return SdkClients.adminClient().searchServices().get(id);
  }
}
