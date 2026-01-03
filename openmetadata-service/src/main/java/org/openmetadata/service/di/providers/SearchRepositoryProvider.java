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

package org.openmetadata.service.di.providers;

import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.search.SearchRepository;

/**
 * Provider interface for SearchRepository instances.
 *
 * <p>This interface allows different implementations (OpenMetadata vs Collate) to provide their own
 * SearchRepository implementations via dependency injection.
 *
 * <p>OpenMetadata provides the default SearchRepository, while Collate can provide
 * SearchRepositoryExt which extends SearchRepository with vector search and other capabilities.
 *
 * <p>Example usage:
 *
 * <pre>
 * // OpenMetadata implementation
 * public class DefaultSearchRepositoryProvider implements SearchRepositoryProvider {
 *   public SearchRepository createSearchRepository(config) {
 *     return new SearchRepository(
 *         config.getElasticSearchConfiguration(),
 *         config.getDataSourceFactory().getMaxSize());
 *   }
 * }
 *
 * // Collate implementation
 * public class CollateSearchRepositoryProvider implements SearchRepositoryProvider {
 *   public SearchRepository createSearchRepository(config) {
 *     return new SearchRepositoryExt(
 *         config.getElasticSearchConfiguration(),
 *         config.getDataSourceFactory().getMaxSize());
 *   }
 * }
 * </pre>
 */
public interface SearchRepositoryProvider {
  /**
   * Create SearchRepository instance from configuration.
   *
   * @param config Application configuration containing ElasticSearch settings
   * @return SearchRepository instance (may be SearchRepository or a subclass like
   *     SearchRepositoryExt)
   */
  SearchRepository createSearchRepository(OpenMetadataApplicationConfig config);
}
