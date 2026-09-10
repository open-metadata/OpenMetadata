/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.security;

public final class OidcTokenValidity {
  public static final int DEFAULT_VALIDITY_SECONDS = 3600;
  public static final String VALIDATION_MESSAGE = "OIDC token validity must be at least 1 second";

  private OidcTokenValidity() {}

  public static boolean isValid(Integer validitySeconds) {
    return validitySeconds != null && validitySeconds > 0;
  }

  public static int resolveOrDefault(Integer validitySeconds) {
    return isValid(validitySeconds) ? validitySeconds : DEFAULT_VALIDITY_SECONDS;
  }
}
