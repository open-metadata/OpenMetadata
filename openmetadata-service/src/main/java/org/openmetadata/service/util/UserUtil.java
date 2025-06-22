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

package org.openmetadata.service.util;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.ADMIN_ROLE;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.jdbi3.UserRepository.AUTH_MECHANISM_FIELD;

import at.favre.lib.crypto.bcrypt.BCrypt;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.BasicAuthMechanism;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exception.UserCreationException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil.PutResponse;
import org.openmetadata.service.util.email.EmailUtil;

@Slf4j
public final class UserUtil {
  private UserUtil() {
    // Private constructor for util class
  }

  public static void addUsers(
      AuthProvider authProvider, Set<String> adminUsers, String domain, Boolean isAdmin) {
    try {
      for (String keyValue : adminUsers) {
        String userName = "";
        String password = "";
        if (keyValue.contains(":")) {
          String[] keyValueArray = keyValue.split(":");
          userName = keyValueArray[0];
          password = keyValueArray[1];
        } else {
          userName = keyValue;
          password = getPassword(userName);
        }
        createOrUpdateUser(authProvider, userName, password, domain, isAdmin);
      }
    } catch (Exception ex) {
      LOG.error("[BootstrapUser] Encountered Exception while bootstrapping admin user", ex);
    }
  }

  public static void createOrUpdateUser(
      AuthProvider authProvider, String username, String password, String domain, Boolean isAdmin) {
    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    User updatedUser = null;
    try {
      // Create Required Fields List
      Set<String> fieldList = new HashSet<>(userRepository.getPatchFields().getFieldList());
      fieldList.add(AUTH_MECHANISM_FIELD);

      // Fetch Original User, is available
      User originalUser = userRepository.getByName(null, username, new Fields(fieldList));
      if (Boolean.FALSE.equals(originalUser.getIsBot())
          && Boolean.TRUE.equals(originalUser.getIsAdmin())) {
        updatedUser = originalUser;

        // Update Auth Mechanism if not present, and send mail to the user
        if (authProvider.equals(AuthProvider.BASIC)) {
          if (originalUser.getAuthenticationMechanism() == null
              || originalUser.getAuthenticationMechanism().equals(new AuthenticationMechanism())) {
            updateUserWithHashedPwd(updatedUser, password);
            EmailUtil.sendInviteMailToAdmin(updatedUser, password);
          }
        } else {
          updatedUser.setAuthenticationMechanism(new AuthenticationMechanism());
        }

        // Update the specific fields isAdmin
        updatedUser.setIsAdmin(isAdmin);

        // user email
        updatedUser.setEmail(String.format("%s@%s", username, domain));
      } else {
        if (Boolean.TRUE.equals(originalUser.getIsBot())) {
          LOG.error(
              String.format(
                  "You configured bot user %s in initialAdmins config. Bot user cannot be promoted to be an admin.",
                  originalUser.getName()));
        }
      }
    } catch (EntityNotFoundException e) {
      updatedUser = user(username, domain, username).withIsAdmin(isAdmin).withIsEmailVerified(true);
      // Update Auth Mechanism if not present, and send mail to the user
      if (authProvider.equals(AuthProvider.BASIC)) {
        updateUserWithHashedPwd(updatedUser, password);
        EmailUtil.sendInviteMailToAdmin(updatedUser, password);
      }
    }

    // Update the user
    if (updatedUser != null) {
      addOrUpdateUser(updatedUser);
    }
  }

  private static String getPassword(String username) {
    try {
      if (Boolean.TRUE.equals(EmailUtil.getSmtpSettings().getEnableSmtpServer())
          && !ADMIN_USER_NAME.equals(username)) {
        EmailUtil.testConnection();
        return PasswordUtil.generateRandomPassword();
      }
    } catch (Exception ex) {
      LOG.info("Password set to Default.");
    }
    return ADMIN_USER_NAME;
  }

  public static void updateUserWithHashedPwd(User user, String pwd) {
    String hashedPwd = BCrypt.withDefaults().hashToString(12, pwd.toCharArray());
    user.setAuthenticationMechanism(
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.BASIC)
            .withConfig(new BasicAuthMechanism().withPassword(hashedPwd)));
  }

  public static User addOrUpdateUser(User user) {
    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    try {
      PutResponse<User> addedUser = userRepository.createOrUpdate(null, user, ADMIN_USER_NAME);
      // should not log the user auth details in LOGS
      LOG.debug("Added user entry: {}", addedUser.getEntity().getName());
      return addedUser.getEntity();
    } catch (Exception exception) {
      // In HA set up the other server may have already added the user.
      LOG.debug("Caught exception", exception);
      user.setAuthenticationMechanism(null);
      throw UserCreationException.byMessage(user.getName(), exception.getMessage());
    }
  }

  public static User user(String name, String domain, String updatedBy) {
    return getUser(
        updatedBy, new CreateUser().withName(name).withEmail(name + "@" + domain).withIsBot(false));
  }

  /**
   * This method add auth mechanism in the following way:
   *
   * <ul>
   *   <li>If original user has already an authMechanism, add it to the user
   *   <li>Otherwise:
   *       <ul>
   *         <li>If airflow configuration is 'openmetadata' and server auth provider is not basic, add JWT auth
   *             mechanism from Airflow configuration
   *         <li>Otherwise:
   *             <ul>
   *               <li>If airflow configuration is 'basic', add JWT auth mechanism with a generated token which does not
   *                   expire
   *               <li>Otherwise, add SSO auth mechanism from Airflow configuration
   *             </ul>
   *       </ul>
   * </ul>
   */
  public static User addOrUpdateBotUser(User user) {
    User originalUser = retrieveWithAuthMechanism(user);
    AuthenticationMechanism authMechanism =
        originalUser != null ? originalUser.getAuthenticationMechanism() : null;
    // the user did not have an auth mechanism and auth config is present
    if (authMechanism == null) {
      authMechanism = buildAuthMechanism(JWT, buildJWTAuthMechanism(null, user));
    }
    user.setAuthenticationMechanism(authMechanism);
    user.setDescription(user.getDescription());
    user.setDisplayName(user.getDisplayName());
    return addOrUpdateUser(user);
  }

  private static JWTAuthMechanism buildJWTAuthMechanism(
      OpenMetadataJWTClientConfig jwtClientConfig, User user) {
    return Objects.isNull(jwtClientConfig) || nullOrEmpty(jwtClientConfig.getJwtToken())
        ? JWTTokenGenerator.getInstance().generateJWTToken(user, JWTTokenExpiry.Unlimited)
        : new JWTAuthMechanism()
            .withJWTToken(jwtClientConfig.getJwtToken())
            .withJWTTokenExpiry(JWTTokenExpiry.Unlimited);
  }

  private static AuthenticationMechanism buildAuthMechanism(
      AuthenticationMechanism.AuthType authType, Object config) {
    return new AuthenticationMechanism().withAuthType(authType).withConfig(config);
  }

  private static User retrieveWithAuthMechanism(User user) {
    EntityRepository<User> userRepository =
        (UserRepository) Entity.getEntityRepository(Entity.USER);
    try {
      return userRepository.getByName(
          null, user.getName(), new Fields(Set.of("authenticationMechanism")));
    } catch (EntityNotFoundException e) {
      LOG.debug("Bot entity: {} does not exists.", user);
      return null;
    }
  }

  public static EntityReference getUserOrBot(String name) {
    EntityReference userOrBot;
    try {
      userOrBot = Entity.getEntityReferenceByName(Entity.USER, name, NON_DELETED);
    } catch (EntityNotFoundException e) {
      userOrBot = Entity.getEntityReferenceByName(Entity.BOT, name, NON_DELETED);
    }
    return userOrBot;
  }

  public static Set<String> getRoleListFromUser(User user) {
    if (nullOrEmpty(user.getRoles())) {
      return new HashSet<>();
    }
    return listOrEmpty(user.getRoles()).stream()
        .map(EntityReference::getName)
        .collect(Collectors.toSet());
  }

  public static List<EntityReference> validateAndGetRolesRef(Set<String> rolesList) {
    if (nullOrEmpty(rolesList)) {
      return Collections.emptyList();
    }
    List<EntityReference> references = new ArrayList<>();

    // Fetch the roles from the database
    for (String role : rolesList) {
      // Admin role is not present in the roles table, it is just a flag in the user table
      if (!role.equals(ADMIN_ROLE)) {
        try {
          Role fetchedRole = Entity.getEntityByName(Entity.ROLE, role, "id", NON_DELETED, true);
          references.add(fetchedRole.getEntityReference());
        } catch (EntityNotFoundException ex) {
          LOG.error("[ReSyncRoles] Role not found: {}", role, ex);
        }
      }
    }
    return references;
  }

  public static Set<String> getRolesFromAuthorizationToken(
      CatalogSecurityContext catalogSecurityContext) {
    return catalogSecurityContext.getUserRoles();
  }

  public static boolean isRolesSyncNeeded(Set<String> fromToken, Set<String> fromDB) {
    // Check if there are roles in the token that are not present in the DB
    for (String role : fromToken) {
      if (!fromDB.contains(role)) {
        return true;
      }
    }

    // Check if there are roles in the DB that are not present in the token
    for (String role : fromDB) {
      if (!fromToken.contains(role)) {
        return true;
      }
    }

    return false;
  }

  public static boolean reSyncUserRolesFromToken(
      UriInfo uriInfo, User user, Set<String> rolesFromToken) {
    boolean syncUser = false;

    User updatedUser = JsonUtils.deepCopy(user, User.class);
    // Check if Admin User
    if (rolesFromToken.contains(ADMIN_ROLE)) {
      if (Boolean.FALSE.equals(user.getIsAdmin())) {
        syncUser = true;
        updatedUser.setIsAdmin(true);
      }

      // Remove the Admin Role from the list
      rolesFromToken.remove(ADMIN_ROLE);
    }

    Set<String> rolesFromUser = getRoleListFromUser(user);

    // Check if roles are different
    if (!nullOrEmpty(rolesFromToken) && isRolesSyncNeeded(rolesFromToken, rolesFromUser)) {
      syncUser = true;
      List<EntityReference> rolesReferenceFromToken = validateAndGetRolesRef(rolesFromToken);
      updatedUser.setRoles(rolesReferenceFromToken);
    }

    if (syncUser) {
      LOG.info("Syncing User Roles for User: {}", user.getName());
      JsonPatch patch = JsonUtils.getJsonPatch(user, updatedUser);

      UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
      userRepository.patch(uriInfo, user.getId(), user.getName(), patch);

      // Set the updated roles to the original user
      user.setRoles(updatedUser.getRoles());
    }

    return syncUser;
  }

  public static User getUser(String updatedBy, CreateUser create) {
    return new User()
        .withId(UUID.randomUUID())
        .withName(create.getName().toLowerCase())
        .withFullyQualifiedName(EntityInterfaceUtil.quoteName(create.getName().toLowerCase()))
        .withEmail(create.getEmail().toLowerCase())
        .withDescription(create.getDescription())
        .withDisplayName(create.getDisplayName())
        .withIsBot(create.getIsBot())
        .withIsAdmin(create.getIsAdmin())
        .withProfile(create.getProfile())
        .withPersonas(create.getPersonas())
        .withDefaultPersona(create.getDefaultPersona())
        .withTimezone(create.getTimezone())
        .withUpdatedBy(updatedBy.toLowerCase())
        .withUpdatedAt(System.currentTimeMillis())
        .withTeams(EntityUtil.toEntityReferences(create.getTeams(), Entity.TEAM))
        .withRoles(EntityUtil.toEntityReferences(create.getRoles(), Entity.ROLE))
        .withDomains(EntityUtil.getEntityReferences(Entity.DOMAIN, create.getDomains()))
        .withExternalId(create.getExternalId())
        .withScimUserName(create.getScimUserName());
  }
}
