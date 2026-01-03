/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.di;

import dagger.Module;
import dagger.Provides;
import javax.inject.Singleton;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.di.providers.SearchRepositoryProvider;
import org.openmetadata.service.rdf.RdfUpdater;
import org.openmetadata.service.search.SearchRepository;

/**
 * Dagger module providing search-related components.
 *
 * <p>This module provides:
 *
 * <ul>
 *   <li>SearchRepository for ElasticSearch/OpenSearch operations (customizable via
 *       SearchRepositoryProvider)
 *   <li>RDF knowledge graph support (if enabled in configuration)
 * </ul>
 *
 * <p>The SearchRepository can be customized by providing a different SearchRepositoryProvider
 * implementation. OpenMetadata uses DefaultSearchRepositoryProvider which returns the standard
 * SearchRepository, while Collate can provide CollateSearchRepositoryProvider which returns
 * SearchRepositoryExt with vector search support.
 */
@Slf4j
@Module
public class SearchModule {

  /**
   * Provides SearchRepository instance via SearchRepositoryProvider.
   *
   * <p>The actual SearchRepository implementation is determined by the SearchRepositoryProvider
   * injected by Dagger. OpenMetadata provides DefaultSearchRepositoryProvider (returns
   * SearchRepository), while Collate provides CollateSearchRepositoryProvider (returns
   * SearchRepositoryExt).
   *
   * @param config Application configuration containing ElasticSearch settings
   * @param provider Provider that creates the appropriate SearchRepository implementation
   * @return SearchRepository singleton instance
   */
  @Provides
  @Singleton
  public SearchRepository provideSearchRepository(
      OpenMetadataApplicationConfig config, SearchRepositoryProvider provider) {
    LOG.info("Creating SearchRepository via provider: {}", provider.getClass().getSimpleName());
    SearchRepository searchRepository = provider.createSearchRepository(config);
    LOG.info("SearchRepository created: {}", searchRepository.getClass().getSimpleName());

    // Initialize RDF if enabled
    initializeRdfIfEnabled(config);

    return searchRepository;
  }

  /**
   * Initialize RDF knowledge graph support if enabled in configuration.
   *
   * @param config Application configuration containing RDF settings
   */
  private void initializeRdfIfEnabled(OpenMetadataApplicationConfig config) {
    RdfConfiguration rdfConfig = config.getRdfConfiguration();
    if (rdfConfig != null && rdfConfig.getEnabled() != null && rdfConfig.getEnabled()) {
      RdfUpdater.initialize(rdfConfig);
      LOG.info("RDF knowledge graph support initialized");
    } else {
      LOG.debug("RDF knowledge graph support is disabled");
    }
  }
}
