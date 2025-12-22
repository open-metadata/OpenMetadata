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

package org.openmetadata.service.di.registrars;

import io.dropwizard.core.setup.Environment;
import io.dropwizard.lifecycle.Managed;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.di.providers.FilterRegistrar;
import org.openmetadata.service.security.auth.UserActivityFilter;
import org.openmetadata.service.security.auth.UserActivityTracker;

@Slf4j
public class UserActivityFilterRegistrar implements FilterRegistrar {

  @Override
  public void register(Environment environment, OpenMetadataApplicationConfig config) {
    LOG.debug("Registering user activity filter");
    environment.jersey().register(UserActivityFilter.class);

    // Register lifecycle management for UserActivityTracker
    environment
        .lifecycle()
        .manage(
            new Managed() {
              @Override
              public void start() {
                // UserActivityTracker starts automatically on first use
              }

              @Override
              public void stop() {
                UserActivityTracker.getInstance().shutdown();
              }
            });
  }
}
