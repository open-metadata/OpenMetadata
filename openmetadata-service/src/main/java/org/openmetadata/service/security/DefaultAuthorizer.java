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

import static org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT;
import static org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.SSO;
import static org.openmetadata.schema.teams.authn.SSOAuthMechanism.SsoServiceType.AUTH_0;
import static org.openmetadata.schema.teams.authn.SSOAuthMechanism.SsoServiceType.AZURE;
import static org.openmetadata.schema.teams.authn.SSOAuthMechanism.SsoServiceType.CUSTOM_OIDC;
import static org.openmetadata.schema.teams.authn.SSOAuthMechanism.SsoServiceType.GOOGLE;
import static org.openmetadata.schema.teams.authn.SSOAuthMechanism.SsoServiceType.OKTA;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notAdmin;
import static org.openmetadata.service.resources.teams.UserResource.USER_PROTECTED_FIELDS;
import static org.openmetadata.service.security.SecurityUtil.DEFAULT_PRINCIPAL_DOMAIN;

import at.favre.lib.crypto.bcrypt.BCrypt;
import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.ws.rs.core.SecurityContext;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.api.configuration.airflow.AirflowConfiguration;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.teams.authn.BasicAuthMechanism;
import org.openmetadata.schema.teams.authn.JWTAuthMechanism;
import org.openmetadata.schema.teams.authn.JWTTokenExpiry;
import org.openmetadata.schema.teams.authn.SSOAuthMechanism;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Permission.Access;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.PolicyCache;
import org.openmetadata.service.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.RoleCache;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.ConfigurationHolder;
import org.openmetadata.service.util.EmailUtil;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.PasswordUtil;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class DefaultAuthorizer implements Authorizer {
  private final String COLONDELIMETER = ":";
  private final String DEFAULT_ADMIN = "admin";
  private Set<String> adminUsers;
  private Set<String> botUsers;
  private Set<String> testUsers;
  private String principalDomain;

  private SecretsManager secretsManager;

  @Override
  public void init(OpenMetadataApplicationConfig openMetadataApplicationConfig, Jdbi dbi) {
    LOG.info(
        "Initializing DefaultAuthorizer with config {}", openMetadataApplicationConfig.getAuthorizerConfiguration());
    this.adminUsers = new HashSet<>(openMetadataApplicationConfig.getAuthorizerConfiguration().getAdminPrincipals());
    this.botUsers = new HashSet<>(openMetadataApplicationConfig.getAuthorizerConfiguration().getBotPrincipals());
    this.testUsers = new HashSet<>(openMetadataApplicationConfig.getAuthorizerConfiguration().getTestPrincipals());
    this.principalDomain = openMetadataApplicationConfig.getAuthorizerConfiguration().getPrincipalDomain();
    this.secretsManager =
        SecretsManagerFactory.createSecretsManager(
            openMetadataApplicationConfig.getSecretsManagerConfiguration(),
            openMetadataApplicationConfig.getClusterName());

    SubjectCache.initialize();
    PolicyCache.initialize();
    RoleCache.initialize();
    LOG.debug("Admin users: {}", adminUsers);
    initializeUsers(openMetadataApplicationConfig);
  }

  private void initializeUsers(OpenMetadataApplicationConfig openMetadataApplicationConfig) {
    LOG.debug("Checking user entries for admin users");
    String domain = principalDomain.isEmpty() ? DEFAULT_PRINCIPAL_DOMAIN : principalDomain;
    if (!ConfigurationHolder.getInstance()
        .getConfig(ConfigurationHolder.ConfigurationType.AUTHENTICATIONCONFIG, AuthenticationConfiguration.class)
        .getProvider()
        .equals(SSOAuthMechanism.SsoServiceType.BASIC.value())) {
      for (String adminUser : adminUsers) {
        User user = user(adminUser, domain, adminUser).withIsAdmin(true);
        addOrUpdateUser(user);
      }
    } else {
      try {
        handleBasicAuth(adminUsers, domain);
      } catch (IOException e) {
        LOG.error("Failed in Basic Auth Setup. Reason : {}", e.getMessage());
      }
    }

    LOG.debug("Checking user entries for bot users");
    for (String botUser : botUsers) {
      User user = user(botUser, domain, botUser).withIsBot(true);
      user = addOrUpdateBotUser(user, openMetadataApplicationConfig);
      if (user != null) {
        Bot bot = bot(user).withBotUser(user.getEntityReference());
        addOrUpdateBot(bot);
      }
    }

    LOG.debug("Checking user entries for test users");
    for (String testUser : testUsers) {
      User user = user(testUser, domain, testUser);
      addOrUpdateUser(user);
    }
  }

  private void handleBasicAuth(Set<String> adminUsers, String domain) throws IOException {
    for (String adminUser : adminUsers) {
      if (adminUser.contains(COLONDELIMETER)) {
        String[] tokens = adminUser.split(COLONDELIMETER);
        addUserForBasicAuth(tokens[0], tokens[1], domain);
      } else {
        boolean isDefaultAdmin = adminUser.equals(DEFAULT_ADMIN);
        String token = isDefaultAdmin ? DEFAULT_ADMIN : PasswordUtil.generateRandomPassword();
        addUserForBasicAuth(adminUser, token, domain);
      }
    }
  }

  private void addUserForBasicAuth(String username, String pwd, String domain) throws IOException {
    EntityRepository<User> userRepository = Entity.getEntityRepository(Entity.USER);
    User originalUser;
    try {
      List<String> fields = userRepository.getAllowedFields();
      fields.add(USER_PROTECTED_FIELDS);
      originalUser = userRepository.getByName(null, username, new EntityUtil.Fields(fields, String.join(",", fields)));
      if (originalUser.getAuthenticationMechanism() == null) {
        updateUserWithHashedPwd(originalUser, pwd);
      }
      addOrUpdateUser(originalUser);
    } catch (EntityNotFoundException e) {
      // TODO: Not the best way ! :(
      User user = user(username, domain, username).withIsAdmin(true).withIsEmailVerified(true);
      updateUserWithHashedPwd(user, pwd);
      addOrUpdateUser(user);
      sendInviteMailToAdmin(user, pwd);
    }
  }

  private void sendInviteMailToAdmin(User user, String pwd) {
    Map<String, String> templatePopulator = new HashMap<>();
    templatePopulator.put(EmailUtil.ENTITY, EmailUtil.getInstance().getEmailingEntity());
    templatePopulator.put(EmailUtil.SUPPORTURL, EmailUtil.getInstance().getSupportUrl());
    templatePopulator.put(EmailUtil.USERNAME, user.getName());
    templatePopulator.put(EmailUtil.PASSWORD, pwd);
    templatePopulator.put(EmailUtil.APPLICATION_LOGIN_LINK, EmailUtil.getInstance().getOMUrl());
    try {
      EmailUtil.getInstance()
          .sendMail(
              EmailUtil.getInstance().getEmailInviteSubject(),
              templatePopulator,
              user.getEmail(),
              EmailUtil.EMAILTEMPLATEBASEPATH,
              EmailUtil.INVITE_RANDOM_PWD);
    } catch (Exception ex) {
      LOG.error("Failed in sending Mail to user [{}]. Reason : {}", user.getEmail(), ex.getMessage());
    }
  }

  private void updateUserWithHashedPwd(User user, String pwd) {
    String hashedPwd = BCrypt.withDefaults().hashToString(12, pwd.toCharArray());
    user.setAuthenticationMechanism(
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.BASIC)
            .withConfig(new BasicAuthMechanism().withPassword(hashedPwd)));
  }

  private User user(String name, String domain, String updatedBy) {
    return new User()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(name)
        .withEmail(name + "@" + domain)
        .withUpdatedBy(updatedBy)
        .withUpdatedAt(System.currentTimeMillis())
        .withIsBot(false);
  }

  private Bot bot(User user) {
    return new Bot()
        .withId(UUID.randomUUID())
        .withName(user.getName())
        .withFullyQualifiedName(user.getName())
        .withUpdatedBy(user.getUpdatedBy())
        .withUpdatedAt(System.currentTimeMillis())
        .withDisplayName(user.getName());
  }

  @Override
  public List<ResourcePermission> listPermissions(SecurityContext securityContext, String user) {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    subjectContext = changeSubjectContext(user, subjectContext);

    if (subjectContext.isAdmin() || subjectContext.isBot()) {
      // Admins and bots have permissions to do all operations.
      return PolicyEvaluator.getResourcePermissions(Access.ALLOW);
    }
    return PolicyEvaluator.listPermission(subjectContext);
  }

  @Override
  public ResourcePermission getPermission(SecurityContext securityContext, String user, String resourceType) {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    subjectContext = changeSubjectContext(user, subjectContext);

    if (subjectContext.isAdmin() || subjectContext.isBot()) {
      // Admins and bots have permissions to do all operations.
      return PolicyEvaluator.getResourcePermission(resourceType, Access.ALLOW);
    }
    return PolicyEvaluator.getPermission(subjectContext, resourceType);
  }

  @Override
  public ResourcePermission getPermission(
      SecurityContext securityContext, String user, ResourceContextInterface resourceContext) {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    subjectContext = changeSubjectContext(user, subjectContext);

    if (subjectContext.isAdmin() || subjectContext.isBot()) {
      // Admins and bots have permissions to do all operations.
      return PolicyEvaluator.getResourcePermission(resourceContext.getResource(), Access.ALLOW);
    }
    return PolicyEvaluator.getPermission(subjectContext, resourceContext);
  }

  @Override
  public boolean isOwner(SecurityContext securityContext, EntityReference owner) {
    if (owner == null) {
      return false;
    }
    try {
      SubjectContext subjectContext = getSubjectContext(securityContext);
      return subjectContext.isOwner(owner);
    } catch (EntityNotFoundException ex) {
      return false;
    }
  }

  @Override
  public void authorize(
      SecurityContext securityContext,
      OperationContext operationContext,
      ResourceContextInterface resourceContext,
      boolean allowBots)
      throws IOException {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    if (subjectContext.isAdmin() || (allowBots && subjectContext.isBot())) {
      return;
    }
    PolicyEvaluator.hasPermission(subjectContext, resourceContext, operationContext);
  }

  @Override
  public void authorizeAdmin(SecurityContext securityContext, boolean allowBots) {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    if (subjectContext.isAdmin() || (allowBots && subjectContext.isBot())) {
      return;
    }
    throw new AuthorizationException(notAdmin(securityContext.getUserPrincipal().getName()));
  }

  private User addOrUpdateUser(User user) {
    EntityRepository<User> userRepository = Entity.getEntityRepository(Entity.USER);
    try {
      RestUtil.PutResponse<User> addedUser = userRepository.createOrUpdate(null, user);
      // should not log the user auth details in LOGS
      LOG.debug("Added user entry: {}", addedUser.getEntity().getName());
      return addedUser.getEntity();
    } catch (Exception exception) {
      // In HA set up the other server may have already added the user.
      LOG.debug("Caught exception: {}", ExceptionUtils.getStackTrace(exception));
      user.setAuthenticationMechanism(null);
      LOG.debug("User entry: {} already exists.", user.getName());
    }
    return null;
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
   *
   * @param user
   * @param openMetadataApplicationConfig
   * @return
   */
  private User addOrUpdateBotUser(User user, OpenMetadataApplicationConfig openMetadataApplicationConfig) {
    AuthenticationMechanism authMechanism = retrieveAuthMechanism(user);
    // the user did not have an auth mechanism
    if (authMechanism == null) {
      AuthenticationConfiguration authConfig = openMetadataApplicationConfig.getAuthenticationConfiguration();
      AirflowConfiguration airflowConfig = openMetadataApplicationConfig.getAirflowConfiguration();
      // if the auth provider is "openmetadata" in the configuration set JWT as auth mechanism
      if ("openmetadata".equals(airflowConfig.getAuthProvider()) && !"basic".equals(authConfig.getProvider())) {
        OpenMetadataJWTClientConfig jwtClientConfig = airflowConfig.getAuthConfig().getOpenmetadata();
        authMechanism =
            buildAuthMechanism(
                JWT,
                new JWTAuthMechanism()
                    .withJWTToken(jwtClientConfig.getJwtToken())
                    .withJWTTokenExpiry(JWTTokenExpiry.Unlimited));
      } else {
        // Otherwise, set auth mechanism from airflow configuration
        // TODO: https://github.com/open-metadata/OpenMetadata/issues/7712
        if (airflowConfig.getAuthConfig() != null && !"basic".equals(authConfig.getProvider())) {
          switch (authConfig.getProvider()) {
            case "no-auth":
              break;
            case "azure":
              authMechanism =
                  buildAuthMechanism(SSO, buildAuthMechanismConfig(AZURE, airflowConfig.getAuthConfig().getAzure()));
              break;
            case "google":
              authMechanism =
                  buildAuthMechanism(SSO, buildAuthMechanismConfig(GOOGLE, airflowConfig.getAuthConfig().getGoogle()));
              break;
            case "okta":
              authMechanism =
                  buildAuthMechanism(SSO, buildAuthMechanismConfig(OKTA, airflowConfig.getAuthConfig().getOkta()));
              break;
            case "auth0":
              authMechanism =
                  buildAuthMechanism(SSO, buildAuthMechanismConfig(AUTH_0, airflowConfig.getAuthConfig().getAuth0()));
              break;
            case "custom-oidc":
              authMechanism =
                  buildAuthMechanism(
                      SSO, buildAuthMechanismConfig(CUSTOM_OIDC, airflowConfig.getAuthConfig().getCustomOidc()));
              break;
            default:
              throw new IllegalArgumentException(
                  String.format(
                      "Unexpected auth provider [%s] for bot [%s]", authConfig.getProvider(), user.getName()));
          }
        } else if ("basic".equals(authConfig.getProvider())) {
          authMechanism =
              buildAuthMechanism(JWT, JWTTokenGenerator.getInstance().generateJWTToken(user, JWTTokenExpiry.Unlimited));
        }
      }
    }
    user.setAuthenticationMechanism(authMechanism);
    return addOrUpdateUser(user);
  }

  private SSOAuthMechanism buildAuthMechanismConfig(SSOAuthMechanism.SsoServiceType ssoServiceType, Object config) {
    return new SSOAuthMechanism().withSsoServiceType(ssoServiceType).withAuthConfig(config);
  }

  private AuthenticationMechanism buildAuthMechanism(AuthenticationMechanism.AuthType authType, Object config) {
    return new AuthenticationMechanism().withAuthType(authType).withConfig(config);
  }

  private AuthenticationMechanism retrieveAuthMechanism(User user) {
    EntityRepository<User> userRepository = Entity.getEntityRepository(Entity.USER);
    try {
      User originalUser =
          userRepository.getByName(
              null, user.getFullyQualifiedName(), new EntityUtil.Fields(List.of("authenticationMechanism")));
      AuthenticationMechanism authMechanism = user.getAuthenticationMechanism();
      if (authMechanism != null) {
        Object config =
            secretsManager.encryptOrDecryptIngestionBotCredentials(user.getName(), authMechanism.getConfig(), false);
        authMechanism.setConfig(config != null ? config : authMechanism.getConfig());
      }
      return originalUser.getAuthenticationMechanism();
    } catch (IOException | EntityNotFoundException e) {
      LOG.debug("Bot entity: {} does not exists.", user);
      return null;
    }
  }

  private void addOrUpdateBot(Bot bot) {
    EntityRepository<Bot> botRepository = Entity.getEntityRepository(Entity.BOT);
    try {
      RestUtil.PutResponse<Bot> addedBot = botRepository.createOrUpdate(null, bot);
      LOG.debug("Added bot entry: {}", addedBot.getEntity().getName());
    } catch (Exception exception) {
      // In HA set up the other server may have already added the bot.
      LOG.debug("Caught exception: {}", ExceptionUtils.getStackTrace(exception));
      LOG.debug("Bot entry: {} already exists.", bot.getName());
    }
  }

  private SubjectContext getSubjectContext(SecurityContext securityContext) {
    if (securityContext == null || securityContext.getUserPrincipal() == null) {
      throw new AuthenticationException("No principal in security context");
    }
    return getSubjectContext(SecurityUtil.getUserName(securityContext.getUserPrincipal()));
  }

  private SubjectContext getSubjectContext(String userName) {
    return SubjectCache.getInstance().getSubjectContext(userName);
  }

  private SubjectContext changeSubjectContext(String user, SubjectContext loggedInUser) {
    // Asking for some other user's permissions is admin only operation
    if (user != null && !loggedInUser.getUser().getName().equals(user)) {
      if (!loggedInUser.isAdmin()) {
        throw new AuthorizationException(notAdmin(loggedInUser.getUser().getName()));
      }
      LOG.debug("Changing subject context from logged-in user to {}", user);
      return getSubjectContext(user);
    }
    return loggedInUser;
  }
}
