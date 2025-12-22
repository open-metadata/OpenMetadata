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
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;

/**
 * Dagger module providing core infrastructure components.
 *
 * <p>This module provides the foundational infrastructure needed by all other modules:
 *
 * <ul>
 *   <li>JDBI for database access
 *   <li>CollectionDAO for entity data access
 *   <li>SearchRepository for search operations
 *   <li>Authorizer for access control
 *   <li>OpenMetadataApplicationConfig for application configuration
 * </ul>
 *
 * <p>These components are typically initialized during application startup and passed to this
 * module.
 */
@Module
public class CoreModule {
  private final Jdbi jdbi;
  private final CollectionDAO collectionDAO;
  private final SearchRepository searchRepository;
  private final Authorizer authorizer;
  private final OpenMetadataApplicationConfig config;

  /**
   * Constructor for CoreModule.
   *
   * @param jdbi JDBI instance for database access
   * @param collectionDAO CollectionDAO for entity operations
   * @param searchRepository SearchRepository for search operations
   * @param authorizer Authorizer for access control
   * @param config OpenMetadataApplicationConfig for application configuration
   */
  public CoreModule(
      Jdbi jdbi,
      CollectionDAO collectionDAO,
      SearchRepository searchRepository,
      Authorizer authorizer,
      OpenMetadataApplicationConfig config) {
    this.jdbi = jdbi;
    this.collectionDAO = collectionDAO;
    this.searchRepository = searchRepository;
    this.authorizer = authorizer;
    this.config = config;
  }

  @Provides
  @Singleton
  public Jdbi provideJdbi() {
    return jdbi;
  }

  @Provides
  @Singleton
  public CollectionDAO provideCollectionDAO() {
    return collectionDAO;
  }

  @Provides
  @Singleton
  public SearchRepository provideSearchRepository() {
    return searchRepository;
  }

  @Provides
  @Singleton
  public Authorizer provideAuthorizer() {
    return authorizer;
  }

  @Provides
  @Singleton
  public OpenMetadataApplicationConfig provideConfig() {
    return config;
  }
}
