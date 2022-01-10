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
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.MetadataOperation;

public interface Authorizer {

  /** Initialize the authorizer */
  void init(AuthorizerConfiguration config, Jdbi jdbi) throws IOException;

  /**
   * Check if the authenticated user has given permission on the target entity identified by the given resourceType and
   * resourceName
   */
  boolean hasPermissions(AuthenticationContext ctx, EntityReference entityReference);

  /**
   * Check if the authenticated user (subject) has permission to perform the {@link MetadataOperation} on the target
   * entity (object).
   */
  boolean hasPermissions(AuthenticationContext ctx, EntityReference entityReference, MetadataOperation operation);

  boolean isAdmin(AuthenticationContext ctx);

  boolean isBot(AuthenticationContext ctx);
}
