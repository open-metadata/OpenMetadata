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

import static org.openmetadata.catalog.resources.teams.UserResource.FIELD_LIST;

import java.io.IOException;
import java.text.ParseException;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.DuplicateEntityException;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.PolicyRepository;
import org.openmetadata.catalog.jdbi3.UserRepository;
import org.openmetadata.catalog.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.util.EntityUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class DefaultAuthorizer implements Authorizer {
  private static final Logger LOG = LoggerFactory.getLogger(DefaultAuthorizer.class);

  private Set<String> adminUsers;
  private Set<String> botUsers;

  private String principalDomain;
  private UserRepository userRepository;
  private PolicyEvaluator policyEvaluator;
  private static final String fieldsParam = "roles,teams";

  @Override
  public void init(AuthorizerConfiguration config, Jdbi dbi) throws IOException {
    LOG.debug("Initializing DefaultAuthorizer with config {}", config);
    this.adminUsers = new HashSet<>(config.getAdminPrincipals());
    this.botUsers = new HashSet<>(config.getBotPrincipals());
    this.principalDomain = config.getPrincipalDomain();
    LOG.debug("Admin users: {}", adminUsers);
    CollectionDAO collectionDAO = dbi.onDemand(CollectionDAO.class);
    this.userRepository = new UserRepository(collectionDAO);
    mayBeAddAdminUsers();
    mayBeAddBotUsers();
    // Load all rules from access control policies at once during init.
    this.policyEvaluator = new PolicyEvaluator(new PolicyRepository(collectionDAO).getAccessControlPolicyRules());
  }

  private void mayBeAddAdminUsers() {
    LOG.debug("Checking user entries for admin users");
    EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, fieldsParam);
    adminUsers.stream()
        .filter(
            name -> {
              try {
                User user = userRepository.getByName(null, name, fields);
                if (user != null) {
                  LOG.debug("Entry for user '{}' already exists", name);
                  return false;
                }
                return true;
              } catch (IOException | EntityNotFoundException | ParseException ex) {
                return true;
              }
            })
        .forEach(this::addAdmin);
  }

  private void mayBeAddBotUsers() {
    LOG.debug("Checking user entries for bot users");
    EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, fieldsParam);
    botUsers.stream()
        .filter(
            name -> {
              try {
                User user = userRepository.getByName(null, name, fields);
                if (user != null) {
                  LOG.debug("Entry for user '{}' already exists", name);
                  return false;
                }
                return true;
              } catch (IOException | EntityNotFoundException | ParseException ex) {
                return true;
              }
            })
        .forEach(this::addBot);
  }

  @Override
  public boolean hasPermissions(AuthenticationContext ctx, EntityReference owner) {
    validateAuthenticationContext(ctx);
    // To encourage users to claim or update changes to tables when a non-owner or un-claimed datasets.
    if (owner == null) {
      return true;
    }
    try {
      User user = getUserFromAuthenticationContext(ctx);
      if (owner.getType().equals(Entity.TEAM)) {
        for (EntityReference team : user.getTeams()) {
          if (team.getName().equals(owner.getName())) {
            return true;
          }
        }
      } else if (owner.getType().equals(Entity.USER)) {
        return user.getName().equals(owner.getName());
      }
      return false;
    } catch (IOException | EntityNotFoundException | ParseException ex) {
      return false;
    }
  }

  @Override
  public boolean hasPermissions(
      AuthenticationContext ctx, EntityReference entityReference, MetadataOperation operation) {
    validateAuthenticationContext(ctx);
    try {
      return policyEvaluator.hasPermission(
          getUserFromAuthenticationContext(ctx),
          Entity.getEntity(entityReference, new EntityUtil.Fields(List.of("tags"))),
          operation);
    } catch (IOException | EntityNotFoundException | ParseException ex) {
      return false;
    }
  }

  @Override
  public boolean isAdmin(AuthenticationContext ctx) {
    validateAuthenticationContext(ctx);
    String userName = SecurityUtil.getUserName(ctx);
    EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, fieldsParam);
    try {
      User user = userRepository.getByName(null, userName, fields);
      if (user.getIsAdmin() == null) {
        return false;
      }
      return user.getIsAdmin();
    } catch (IOException | EntityNotFoundException | ParseException ex) {
      return false;
    }
  }

  @Override
  public boolean isBot(AuthenticationContext ctx) {
    validateAuthenticationContext(ctx);
    String userName = SecurityUtil.getUserName(ctx);
    EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, fieldsParam);
    try {
      User user = userRepository.getByName(null, userName, fields);
      if (user.getIsBot() == null) {
        return false;
      }
      return user.getIsBot();
    } catch (IOException | EntityNotFoundException | ParseException ex) {
      return false;
    }
  }

  private void validateAuthenticationContext(AuthenticationContext ctx) {
    if (ctx == null || ctx.getPrincipal() == null) {
      throw new AuthenticationException("No principal in AuthenticationContext");
    }
  }

  private User getUserFromAuthenticationContext(AuthenticationContext ctx) throws IOException, ParseException {
    String userName = SecurityUtil.getUserName(ctx);
    EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, fieldsParam);
    return userRepository.getByName(null, userName, fields);
  }

  private void addAdmin(String name) {
    User user =
        new User()
            .withId(UUID.randomUUID())
            .withName(name)
            .withEmail(name + "@" + principalDomain)
            .withIsAdmin(true)
            .withUpdatedBy(name)
            .withUpdatedAt(new Date());

    try {
      User addedUser = userRepository.create(null, user);
      LOG.debug("Added admin user entry: {}", addedUser);
    } catch (DuplicateEntityException | IOException exception) {
      // In HA set up the other server may have already added the user.
      LOG.debug("Caught exception: {}", ExceptionUtils.getStackTrace(exception));
      LOG.debug("Admin user entry: {} already exists.", user);
    }
  }

  private void addBot(String name) {
    User user =
        new User()
            .withId(UUID.randomUUID())
            .withName(name)
            .withEmail(name + "@" + principalDomain)
            .withIsBot(true)
            .withUpdatedBy(name)
            .withUpdatedAt(new Date());

    try {
      User addedUser = userRepository.create(null, user);
      LOG.debug("Added bot user entry: {}", addedUser);
    } catch (DuplicateEntityException | IOException exception) {
      // In HA se tup the other server may have already added the user.
      LOG.debug("Caught exception: {}", ExceptionUtils.getStackTrace(exception));
      LOG.debug("Bot user entry: {} already exists.", user);
    }
  }
}
