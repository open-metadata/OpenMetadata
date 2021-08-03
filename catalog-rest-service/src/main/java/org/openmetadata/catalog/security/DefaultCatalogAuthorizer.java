/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.security;

import org.apache.commons.lang3.exception.ExceptionUtils;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.DuplicateEntityException;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.UserRepository;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;
import org.skife.jdbi.v2.DBI;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.openmetadata.catalog.resources.teams.UserResource.FIELD_LIST;

public class DefaultCatalogAuthorizer implements CatalogAuthorizer {
  private static final Logger LOG = LoggerFactory.getLogger(DefaultCatalogAuthorizer.class);

  private Set<String> adminUsers;
  private Set<String> botUsers;

  private String prinicipalDomain;
  private UserRepository userRepository;
  private final String fieldsParam = "teams";


  @Override
  public void init(AuthorizerConfiguration config, DBI dbi) {
    LOG.debug("Initializing DefaultCatalogAuthorizer with config {}", config);
    this.adminUsers = config.getAdminPrincipals().stream()
            .collect(Collectors.toSet());
    this.botUsers = config.getBotPrincipals().stream()
            .collect(Collectors.toSet());
    this.prinicipalDomain = config.getPrinicipalDomain();
    LOG.debug("Admin users: {}", adminUsers);
    this.userRepository = dbi.onDemand(UserRepository.class);
    mayBeAddAdminUsers();
    mayBeAddBotUsers();
  }

  private void mayBeAddAdminUsers() {
    LOG.debug("Checking user entries for admin users");
    EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, fieldsParam);
    adminUsers.stream()
            .filter(name -> {
              try {
                User user = userRepository.getByName(name, fields);
                if (user != null) {
                  LOG.debug("Entry for user '{}' already exists", name);
                  return false;
                } else {
                  return true;
                }
              } catch (IOException |EntityNotFoundException ex) {
                return true;
              }
            })
            .forEach(name -> {
              User user = new User().withId(UUID.randomUUID())
                      .withName(name)
                      .withEmail(name + "@" + prinicipalDomain)
                      .withIsAdmin(true);
              try {
                User addedUser = userRepository.create(user, null);
                LOG.debug("Added admin user entry: {}", addedUser);
              } catch (DuplicateEntityException | IOException exception) {
                // In HA setup the other server may have already added the user.
                LOG.debug("Caught exception: " + ExceptionUtils.getStackTrace(exception));
                LOG.debug("Admin user entry: {} already exists.", user);
              }
            });
  }

  private void mayBeAddBotUsers() {
    LOG.debug("Checking user entries for bot users");
    EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, fieldsParam);
    botUsers.stream()
            .filter(name -> {
              try {
                User user = userRepository.getByName(name, fields);
                if (user != null) {
                  LOG.debug("Entry for user '{}' already exists", name);
                  return false;
                } else {
                  return true;
                }
              } catch (IOException |EntityNotFoundException ex) {
                return true;
              }
            })
            .forEach(name -> {
              User user = new User().withId(UUID.randomUUID())
                      .withName(name)
                      .withEmail(name + "@" + prinicipalDomain)
                      .withIsBot(true);
              try {
                User addedUser = userRepository.create(user, null);
                LOG.debug("Added bot user entry: {}", addedUser);
              } catch (DuplicateEntityException | IOException exception) {
                // In HA setup the other server may have already added the user.
                LOG.debug("Caught exception: " + ExceptionUtils.getStackTrace(exception));
                LOG.debug("Bot user entry: {} already exists.", user);
              }
            });
  }


  @Override
  public boolean hasPermissions(AuthenticationContext ctx,  EntityReference owner) {
    validateAuthenticationContext(ctx);
    // To encourage users to claim or update changes to tables when a non-owner or un-claimed datasets.
    if (owner == null)  {
      return false;
    }
    String userName = SecurityUtil.getUserName(ctx);
    EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, fieldsParam);
    try {
      User user = userRepository.getByName(userName, fields);
      if (owner.getType().equals(Entity.TEAM)) {
        for (EntityReference team: user.getTeams()) {
          if (team.getName().equals(owner.getName())) {
            return true;
          }
        }
      } else if(owner.getType().equals(Entity.USER)) {
        if (user.getName().equals(owner.getName())) {
          return true;
        }
      }
      return false;
    } catch (IOException |EntityNotFoundException ex) {
      return false;
    }
  }

  @Override
  public boolean isAdmin(AuthenticationContext ctx) {
    validateAuthenticationContext(ctx);
    String userName = SecurityUtil.getUserName(ctx);
    EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, fieldsParam);
    try {
      User user = userRepository.getByName(userName, fields);
      if (user.getIsAdmin() == null) {
        return false;
      }
      return user.getIsAdmin();
    } catch (IOException |EntityNotFoundException ex) {
      return false;
    }
  }

  @Override
  public boolean isBot(AuthenticationContext ctx) {
    validateAuthenticationContext(ctx);
    String userName = SecurityUtil.getUserName(ctx);
    EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, fieldsParam);
    try {
      User user = userRepository.getByName(userName, fields);
      if (user.getIsBot() == null) {
        return false;
      }
      return user.getIsBot();
    } catch (IOException |EntityNotFoundException ex) {
      return false;
    }
  }



  private void validateAuthenticationContext(AuthenticationContext ctx) {
    if (ctx == null || ctx.getPrincipal() == null) {
      throw new AuthenticationException("No principal in AuthenticationContext");
    }
  }
}

