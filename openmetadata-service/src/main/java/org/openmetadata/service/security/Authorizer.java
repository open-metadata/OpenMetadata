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

package org.openmetadata.service.security;

import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

public interface Authorizer {

  /** Initialize the authorizer */
  void init(OpenMetadataApplicationConfig openMetadataApplicationConfig);

  /** Returns a list of operations that the authenticated user (subject) can perform */
  List<ResourcePermission> listPermissions(SecurityContext securityContext, String user);

  /** Returns a list of operations that the authenticated user (subject) can perform on a given resource type */
  ResourcePermission getPermission(SecurityContext securityContext, String user, String resource);

  /** Returns a list of operations that the authenticated user (subject) can perform on a given resource */
  ResourcePermission getPermission(
      SecurityContext securityContext, String user, ResourceContextInterface resourceContext);

  void authorize(
      SecurityContext securityContext,
      OperationContext operationContext,
      ResourceContextInterface resourceContext);

  void authorizeRequests(
      SecurityContext securityContext, List<AuthRequest> requests, AuthorizationLogic logic);

  void authorizeAdmin(SecurityContext securityContext);

  void authorizeAdmin(String adminName);

  void authorizeAdminOrBot(SecurityContext securityContext);

  boolean shouldMaskPasswords(SecurityContext securityContext);

  /** Let the user view PII Sensitive data */
  boolean authorizePII(SecurityContext securityContext, List<EntityReference> owner);
}
