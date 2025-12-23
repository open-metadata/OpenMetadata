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
import org.openmetadata.service.di.providers.AuthenticatorProvider;
import org.openmetadata.service.di.providers.AuthorizerProvider;
import org.openmetadata.service.di.providers.CollectionDAOProvider;
import org.openmetadata.service.di.providers.DefaultAuthenticatorProvider;
import org.openmetadata.service.di.providers.DefaultAuthorizerProvider;
import org.openmetadata.service.di.providers.DefaultCollectionDAOProvider;
import org.openmetadata.service.di.providers.DefaultSearchRepositoryProvider;
import org.openmetadata.service.di.providers.SearchRepositoryProvider;

/**
 * Dagger module providing OpenMetadata-specific implementations.
 *
 * <p>This module binds the default OpenMetadata implementations of provider interfaces. Collate can
 * override these bindings by providing its own module (CollateModule) that provides different
 * implementations.
 *
 * <p>Provider bindings:
 *
 * <ul>
 *   <li>CollectionDAOProvider → DefaultCollectionDAOProvider (returns CollectionDAO)
 *   <li>SearchRepositoryProvider → DefaultSearchRepositoryProvider (returns SearchRepository)
 *   <li>AuthorizerProvider → DefaultAuthorizerProvider (returns Authorizer)
 *   <li>AuthenticatorProvider → DefaultAuthenticatorProvider (returns AuthenticatorHandler)
 * </ul>
 */
@Slf4j
@Module
public class OpenMetadataModule {

  /**
   * Provides default CollectionDAOProvider implementation.
   *
   * <p>This provider returns the standard CollectionDAO from JDBI. Collate can override this to
   * provide DaoExtension.
   *
   * @return DefaultCollectionDAOProvider singleton
   */
  @Provides
  @Singleton
  public CollectionDAOProvider provideCollectionDAOProvider() {
    LOG.debug("Providing DefaultCollectionDAOProvider for OpenMetadata");
    return new DefaultCollectionDAOProvider();
  }

  /**
   * Provides default SearchRepositoryProvider implementation.
   *
   * <p>This provider returns the standard SearchRepository. Collate can override this to provide
   * SearchRepositoryExt with vector search support.
   *
   * @return DefaultSearchRepositoryProvider singleton
   */
  @Provides
  @Singleton
  public SearchRepositoryProvider provideSearchRepositoryProvider() {
    LOG.debug("Providing DefaultSearchRepositoryProvider for OpenMetadata");
    return new DefaultSearchRepositoryProvider();
  }

  /**
   * Provides default AuthorizerProvider implementation.
   *
   * <p>This provider returns the standard Authorizer based on configuration. Collate can override
   * this to provide custom authorization implementations.
   *
   * @return DefaultAuthorizerProvider singleton
   */
  @Provides
  @Singleton
  public AuthorizerProvider provideAuthorizerProvider() {
    LOG.debug("Providing DefaultAuthorizerProvider for OpenMetadata");
    return new DefaultAuthorizerProvider();
  }

  /**
   * Provides default AuthenticatorProvider implementation.
   *
   * <p>This provider returns the appropriate AuthenticatorHandler based on the authentication
   * provider type. Collate can override this to provide custom authentication implementations.
   *
   * @return DefaultAuthenticatorProvider singleton
   */
  @Provides
  @Singleton
  public AuthenticatorProvider provideAuthenticatorProvider() {
    LOG.debug("Providing DefaultAuthenticatorProvider for OpenMetadata");
    return new DefaultAuthenticatorProvider();
  }
}
