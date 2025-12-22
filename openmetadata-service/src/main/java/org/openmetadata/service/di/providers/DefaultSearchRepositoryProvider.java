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

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.search.SearchRepository;

/**
 * Default OpenMetadata implementation of SearchRepositoryProvider.
 *
 * <p>This implementation provides the standard SearchRepository. Collate can override this by
 * providing its own implementation that returns SearchRepositoryExt with vector search support.
 */
@Slf4j
public class DefaultSearchRepositoryProvider implements SearchRepositoryProvider {

  @Override
  public SearchRepository createSearchRepository(OpenMetadataApplicationConfig config) {
    Integer databaseMaxSize = config.getDataSourceFactory().getMaxSize();
    LOG.info("Creating default SearchRepository with database max pool size: {}", databaseMaxSize);

    return new SearchRepository(config.getElasticSearchConfiguration(), databaseMaxSize);
  }
}
