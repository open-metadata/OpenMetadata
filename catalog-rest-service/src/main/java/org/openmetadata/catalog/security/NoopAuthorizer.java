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
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.RoleRepository;
import org.openmetadata.catalog.jdbi3.TeamRepository;
import org.openmetadata.catalog.jdbi3.UserRepository;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;

@Slf4j
public class NoopAuthorizer implements Authorizer {
  private UserRepository userRepository;

  @Override
  public void init(AuthorizerConfiguration config, Jdbi jdbi) {
    CollectionDAO collectionDAO = jdbi.onDemand(CollectionDAO.class);
    this.userRepository = new UserRepository(collectionDAO);
    // TODO: fixme
    // RoleRepository and TeamRepository needs to be instantiated for Entity.DAO_MAP to populated.
    // As we create default admin/bots we need to have RoleRepository and TeamRepository available in DAO_MAP.
    // This needs to be handled better in future releases.
    RoleRepository roleRepository = new RoleRepository(collectionDAO);
    TeamRepository teamRepository = new TeamRepository(collectionDAO);
    addAnonymousUser();
  }

  @Override
  public boolean hasPermissions(AuthenticationContext ctx, EntityReference entityOwnership) {
    return true;
  }

  @Override
  public boolean hasPermissions(
      AuthenticationContext ctx, EntityReference entityReference, MetadataOperation operation) {
    return true;
  }

  @Override
  public List<MetadataOperation> listPermissions(AuthenticationContext ctx, EntityReference entityReference) {
    // Return all operations.
    return Stream.of(MetadataOperation.values()).collect(Collectors.toList());
  }

  @Override
  public boolean isAdmin(AuthenticationContext ctx) {
    return true;
  }

  @Override
  public boolean isBot(AuthenticationContext ctx) {
    return true;
  }

  @Override
  public boolean isOwner(AuthenticationContext ctx, EntityReference entityReference) {
    return true;
  }

  private void addAnonymousUser() {
    String username = "anonymous";
    try {
      userRepository.getByName(null, username, Fields.EMPTY_FIELDS);
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
      RestUtil.PutResponse<User> addedUser = userRepository.createOrUpdate(null, user);
      LOG.debug("Added anonymous user entry: {}", addedUser);
    } catch (IOException exception) {
      // In HA set up the other server may have already added the user.
      LOG.debug("Caught exception: {}", ExceptionUtils.getStackTrace(exception));
      LOG.debug("Anonymous user entry: {} already exists.", user);
    }
  }
}
