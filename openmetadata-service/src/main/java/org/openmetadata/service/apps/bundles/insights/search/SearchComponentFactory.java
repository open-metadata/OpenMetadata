package org.openmetadata.service.apps.bundles.insights.search;

import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.service.apps.bundles.insights.search.elasticsearch.ElasticSearchDataInsightsClient;
import org.openmetadata.service.apps.bundles.insights.search.opensearch.OpenSearchDataInsightsClient;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.DataInsightsElasticSearchProcessor;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.DataInsightsOpenSearchProcessor;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchIndexSink;
import org.openmetadata.service.search.opensearch.OpenSearchIndexSink;
import org.openmetadata.service.workflows.interfaces.Processor;
import org.openmetadata.service.workflows.interfaces.Sink;

public final class SearchComponentFactory {

  private final SearchRepository searchRepository;

  public SearchComponentFactory(SearchRepository searchRepository) {
    this.searchRepository = searchRepository;
  }

  public Processor createDataInsightsProcessor(int totalRecords) {
    return switch (searchRepository.getSearchType()) {
      case OPENSEARCH -> new DataInsightsOpenSearchProcessor(totalRecords);
      default -> new DataInsightsElasticSearchProcessor(totalRecords);
    };
  }

  public Sink createIndexSink(int totalRecords) {
    int payloadSize = searchRepository.getSearchConfiguration().getPayLoadSize();
    return switch (searchRepository.getSearchType()) {
      case OPENSEARCH -> new OpenSearchIndexSink(searchRepository, totalRecords, payloadSize);
      default -> new ElasticSearchIndexSink(searchRepository, totalRecords, payloadSize);
    };
  }

  public DataInsightsSearchInterface createSearchInterface() {
    return switch (searchRepository.getSearchType()) {
      case OPENSEARCH ->
          new OpenSearchDataInsightsClient(
              searchRepository.getSearchClient().getHighLevelClient(),
              searchRepository.getClusterAlias());
      default ->
          new ElasticSearchDataInsightsClient(
              (Rest5Client) searchRepository.getSearchClient().getLowLevelClient(),
              searchRepository.getClusterAlias());
    };
  }
}
