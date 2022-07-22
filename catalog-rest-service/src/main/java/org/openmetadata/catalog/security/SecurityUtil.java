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

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableMap.Builder;
import java.security.Principal;
import java.util.Map;
import javax.ws.rs.client.Invocation;
import javax.ws.rs.client.WebTarget;

public final class SecurityUtil {
  public static final String DEFAULT_PRINCIPAL_DOMAIN = "openmetadata.org";

  private SecurityUtil() {}

  public static String getUserName(Principal principal) {
    return principal == null ? null : principal.getName().split("[/@]")[0];
  }

  public static Map<String, String> authHeaders(String username) {
    Builder<String, String> builder = ImmutableMap.builder();
    if (username != null) {
      builder.put(CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER, username);
    }
    return builder.build();
  }

  public static String getPrincipalName(Map<String, String> authHeaders) {
    // Get username from the email address
    if (authHeaders == null) {
      return null;
    }
    String principal = authHeaders.get(CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER);
    return principal == null ? null : principal.split("@")[0];
  }

  public static Invocation.Builder addHeaders(WebTarget target, Map<String, String> headers) {
    if (headers != null) {
      return target
          .request()
          .header(
              CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER,
              headers.get(CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER));
    }
    return target.request();
  }
}
