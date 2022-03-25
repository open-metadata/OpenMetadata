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

package org.openmetadata.catalog.security;

import java.util.List;
import lombok.Getter;
import lombok.Setter;

public class AuthenticationConfiguration {
  @Getter @Setter private String provider;
  @Getter @Setter private String publicKey;
  @Getter @Setter private String authority;
  @Getter @Setter private String clientId;
  @Getter @Setter private String callbackUrl;
  @Getter @Setter private List<String> jwtPrincipalClaims = List.of("email", "preferred_username", "sub");

  @Override
  public String toString() {
    return "AuthenticationConfiguration{"
        + "provider='"
        + provider
        + '\''
        + ", publicKey='"
        + publicKey
        + '\''
        + ", authority='"
        + authority
        + '\''
        + ", clientId='"
        + clientId
        + '\''
        + ", callbackUrl='"
        + callbackUrl
        + '\''
        + ", jwtPrincipalClaims="
        + jwtPrincipalClaims
        + '}';
  }
}
