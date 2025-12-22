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
import dagger.multibindings.IntoSet;
import javax.inject.Singleton;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.di.providers.ApplicationInitializer;
import org.openmetadata.service.di.providers.ConfigurationInitializer;
import org.openmetadata.service.di.providers.DefaultApplicationInitializer;
import org.openmetadata.service.di.providers.DefaultConfigurationInitializer;
import org.openmetadata.service.di.providers.DefaultMCPServerFactory;
import org.openmetadata.service.di.providers.DefaultSecurityInitializer;
import org.openmetadata.service.di.providers.FilterRegistrar;
import org.openmetadata.service.di.providers.JerseyRegistrar;
import org.openmetadata.service.di.providers.MCPServerFactory;
import org.openmetadata.service.di.providers.SecurityInitializer;
import org.openmetadata.service.di.registrars.ETagFilterRegistrar;
import org.openmetadata.service.di.registrars.EventFilterRegistrar;
import org.openmetadata.service.di.registrars.JerseyConfigurationRegistrar;
import org.openmetadata.service.di.registrars.UserActivityFilterRegistrar;

@Slf4j
@Module
public class ComponentsModule {

  @Provides
  @Singleton
  public ConfigurationInitializer provideConfigurationInitializer() {
    LOG.info("Providing ConfigurationInitializer");
    return new DefaultConfigurationInitializer();
  }

  @Provides
  @Singleton
  public SecurityInitializer provideSecurityInitializer() {
    LOG.info("Providing SecurityInitializer");
    return new DefaultSecurityInitializer();
  }

  @Provides
  @Singleton
  public ApplicationInitializer provideApplicationInitializer() {
    LOG.info("Providing ApplicationInitializer");
    return new DefaultApplicationInitializer();
  }

  @Provides
  @Singleton
  public MCPServerFactory provideMCPServerFactory() {
    LOG.info("Providing MCPServerFactory");
    return new DefaultMCPServerFactory();
  }

  @Provides
  @IntoSet
  public FilterRegistrar provideETagFilterRegistrar() {
    return new ETagFilterRegistrar();
  }

  @Provides
  @IntoSet
  public FilterRegistrar provideEventFilterRegistrar() {
    return new EventFilterRegistrar();
  }

  @Provides
  @IntoSet
  public FilterRegistrar provideUserActivityFilterRegistrar() {
    return new UserActivityFilterRegistrar();
  }

  @Provides
  @IntoSet
  public JerseyRegistrar provideJerseyConfigurationRegistrar() {
    return new JerseyConfigurationRegistrar();
  }
}
