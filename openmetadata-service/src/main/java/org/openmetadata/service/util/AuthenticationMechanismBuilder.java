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

package org.openmetadata.service.util;

import static org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT;
import static org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.SSO;

import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.service.secrets.converter.ClassConverterFactory;

public class AuthenticationMechanismBuilder {

  /** Build `AuthenticationMechanism` object with concrete class for the config which by definition it is a `Object`. */
  public static AuthenticationMechanism addDefinedConfig(AuthenticationMechanism authMechanism) {
    if (authMechanism != null) {
      if (JWT.equals(authMechanism.getAuthType())) {
        authMechanism.setConfig(
            ClassConverterFactory.getConverter(JWTAuthMechanism.class).convert(authMechanism.getConfig()));
      } else if (SSO.equals(authMechanism.getAuthType())) {
        authMechanism.setConfig(
            ClassConverterFactory.getConverter(SSOAuthMechanism.class).convert(authMechanism.getConfig()));
      }
    }
    return authMechanism;
  }
}
