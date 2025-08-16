/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.security.auth;

import jakarta.annotation.Priority;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.slf4j.Slf4j;

/**
 * Filter that tracks user activity for authenticated requests.
 * This filter runs after authentication to capture real user activity.
 * It tracks all activity for human users (not bots).
 */
@Slf4j
@Provider
@Priority(
    Priorities.AUTHENTICATION
        + 100) // Run after JwtFilter (AUTHENTICATION = 1000, so this runs at 1100)
public class UserActivityFilter implements ContainerRequestFilter {

  @Override
  public void filter(ContainerRequestContext requestContext) {
    SecurityContext securityContext = requestContext.getSecurityContext();
    if (securityContext == null || securityContext.getUserPrincipal() == null) {
      LOG.trace(
          "No security context or principal, skipping activity tracking for path: {}",
          requestContext.getUriInfo().getPath());
      return;
    }

    String userName = securityContext.getUserPrincipal().getName();
    if (userName == null || userName.isEmpty()) {
      LOG.trace("No username found in principal, skipping activity tracking");
      return;
    }

    try {
      if (securityContext instanceof CatalogSecurityContext catalogSecurityContext
          && catalogSecurityContext.isBot()) {
        LOG.trace("User {} is a bot, skipping activity tracking", userName);
        return;
      }
      String path = requestContext.getUriInfo().getPath();
      LOG.trace("Tracking activity for user: {} on path: {}", userName, path);
      UserActivityTracker.getInstance().trackActivity(userName);
      LOG.debug("Successfully tracked activity for user: {}", userName);
    } catch (Exception e) {
      LOG.error("Failed to track activity for user: {}", userName, e);
    }
  }
}
