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

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import javax.ws.rs.core.SecurityContext;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Permission.Access;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class NoopAuthorizer implements Authorizer {
  @Override
  public void init(OpenMetadataApplicationConfig openMetadataApplicationConfig, Jdbi jdbi) {
    SubjectCache.initialize();
    addAnonymousUser();
  }

  @Override
  public List<ResourcePermission> listPermissions(SecurityContext securityContext, String user) {
    // Return all operations.
    return PolicyEvaluator.getResourcePermissions(Access.ALLOW);
  }

  @Override
  public ResourcePermission getPermission(SecurityContext securityContext, String user, String resource) {
    return PolicyEvaluator.getResourcePermission(resource, Access.ALLOW);
  }

  @Override
  public ResourcePermission getPermission(
      SecurityContext securityContext, String user, ResourceContextInterface resourceContext) {
    return PolicyEvaluator.getResourcePermission(resourceContext.getResource(), Access.ALLOW);
  }

  @Override
  public void authorize(
      SecurityContext securityContext, OperationContext operationContext, ResourceContextInterface resourceContext) {
    /* Always authorize */
  }

  private void addAnonymousUser() {
    String username = "anonymous";
    try {
      Entity.getEntityRepository(Entity.USER).getByName(null, username, Fields.EMPTY_FIELDS);
    } catch (EntityNotFoundException ex) {
      User user =
          new User()
              .withId(UUID.randomUUID())
              .withName(username)
              .withEmail(username + "@domain.com")
              .withUpdatedBy(username)
              .withUpdatedAt(System.currentTimeMillis());
      addOrUpdateUser(user);
    } catch (IOException e) {
      LOG.error("Failed to create anonymous user {}", username, e);
    }
  }

  private void addOrUpdateUser(User user) {
    try {
      UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
      RestUtil.PutResponse<User> addedUser = userRepository.createOrUpdate(null, user);
      LOG.debug("Added anonymous user entry: {}", addedUser);
    } catch (IOException exception) {
      // In HA set up the other server may have already added the user.
      LOG.debug("Caught exception ", exception);
      LOG.debug("Anonymous user entry: {} already exists.", user);
    }
  }

  @Override
  public void authorizeAdmin(SecurityContext securityContext) {
    /* Always authorize */
  }

  @Override
  public boolean decryptSecret(SecurityContext securityContext) {
    return true; // Always decrypt
  }

  @Override
  public boolean shouldMaskPasswords(SecurityContext securityContext) {
    return false; // Always show passwords
  }
}
