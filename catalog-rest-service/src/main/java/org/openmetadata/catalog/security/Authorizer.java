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

import java.io.IOException;
import java.util.List;
import javax.ws.rs.core.SecurityContext;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.catalog.security.policyevaluator.OperationContext;
import org.openmetadata.catalog.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.MetadataOperation;

public interface Authorizer {

  /** Initialize the authorizer */
  void init(AuthorizerConfiguration config, Jdbi jdbi);

  /** Returns a list of operations that the authenticated user (subject) can perform on the target entity (object). */
  List<MetadataOperation> listPermissions(SecurityContext securityContext, ResourceContextInterface resourceContext);

  boolean isOwner(SecurityContext ctx, EntityReference entityReference);

  void authorize(
      SecurityContext securityContext,
      OperationContext operationContext,
      ResourceContextInterface resourceContext,
      boolean allowBots)
      throws IOException;

  void authorizeAdmin(SecurityContext securityContext, boolean allowBots);
}
