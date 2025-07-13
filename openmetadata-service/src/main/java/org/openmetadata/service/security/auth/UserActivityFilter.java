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

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Filter that tracks user activity for authenticated requests.
 * This filter runs after authentication to capture real user activity.
 * It tracks all activity for human users (not bots).
 */
@Slf4j
@Provider
public class UserActivityFilter implements ContainerRequestFilter {

  @Override
  public void filter(ContainerRequestContext requestContext) {
    // Only track authenticated users
    SecurityContext securityContext = requestContext.getSecurityContext();
    if (securityContext == null || securityContext.getUserPrincipal() == null) {
      return;
    }

    String userName = securityContext.getUserPrincipal().getName();
    if (userName == null || userName.isEmpty()) {
      return;
    }

    try {
      // Check if user is a bot - we don't track bot activity
      SubjectContext subjectContext = SubjectContext.getSubjectContext(userName);
      if (subjectContext != null && subjectContext.isBot()) {
        return;
      }

      // Track user activity asynchronously
      UserActivityTracker.getInstance().trackActivity(userName);
    } catch (Exception e) {
      // Don't let tracking failures affect the request
      LOG.error("Failed to track activity for user: {}", userName, e);
    }
  }
}
