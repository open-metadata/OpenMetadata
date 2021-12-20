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

package org.openmetadata.catalog.module;

import com.google.inject.AbstractModule;
import com.google.inject.Provides;
import org.openmetadata.catalog.security.CatalogAuthorizer;

public class CatalogModule extends AbstractModule {
  private final CatalogAuthorizer authorizer;

  public CatalogModule(CatalogAuthorizer authorizer) {
    this.authorizer = authorizer;
  }

  // Authorizer
  @Provides
  public CatalogAuthorizer providesAuthorizer() {
    return authorizer;
  }

  @Override
  protected void configure() {
    // TODO do we need this
  }
}
