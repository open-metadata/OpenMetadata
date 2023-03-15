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

package org.openmetadata.service.secrets.converter;

import java.util.List;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.schema.security.client.Auth0SSOClientConfig;
import org.openmetadata.schema.security.client.AzureSSOClientConfig;
import org.openmetadata.schema.security.client.CustomOIDCSSOClientConfig;
import org.openmetadata.schema.security.client.GoogleSSOClientConfig;
import org.openmetadata.schema.security.client.OktaSSOClientConfig;
import org.openmetadata.service.util.JsonUtils;

/** Converter class to get an `SSOAuthMechanism` object. */
public class SSOAuthMechanismClassConverter extends ClassConverter {

  private static final List<Class<?>> AUTH_CONFIG_CLASSES =
      List.of(
          GoogleSSOClientConfig.class,
          OktaSSOClientConfig.class,
          Auth0SSOClientConfig.class,
          CustomOIDCSSOClientConfig.class,
          AzureSSOClientConfig.class);

  public SSOAuthMechanismClassConverter() {
    super(SSOAuthMechanism.class);
  }

  @Override
  public Object convert(Object object) {
    SSOAuthMechanism ssoAuthMechanism = (SSOAuthMechanism) JsonUtils.convertValue(object, this.clazz);

    tryToConvertOrFail(ssoAuthMechanism.getAuthConfig(), AUTH_CONFIG_CLASSES)
        .ifPresent(ssoAuthMechanism::setAuthConfig);

    return ssoAuthMechanism;
  }
}
