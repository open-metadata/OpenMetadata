package org.openmetadata.service.security.auth;

import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.INTERNAL_SERVER_ERROR;
import static javax.ws.rs.core.Response.Status.UNAUTHORIZED;
import static org.openmetadata.schema.auth.TokenType.REFRESH_TOKEN;
import static org.openmetadata.service.exception.CatalogExceptionMessage.INVALID_EMAIL_PASSWORD;
import static org.openmetadata.service.exception.CatalogExceptionMessage.LDAP_MISSING_ATTR;
import static org.openmetadata.service.exception.CatalogExceptionMessage.MAX_FAILED_LOGIN_ATTEMPT;
import static org.openmetadata.service.exception.CatalogExceptionMessage.MULTIPLE_EMAIL_ENTRIES;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.unboundid.ldap.sdk.Attribute;
import com.unboundid.ldap.sdk.BindResult;
import com.unboundid.ldap.sdk.Filter;
import com.unboundid.ldap.sdk.LDAPConnection;
import com.unboundid.ldap.sdk.LDAPConnectionOptions;
import com.unboundid.ldap.sdk.LDAPConnectionPool;
import com.unboundid.ldap.sdk.LDAPException;
import com.unboundid.ldap.sdk.ResultCode;
import com.unboundid.ldap.sdk.SearchRequest;
import com.unboundid.ldap.sdk.SearchResult;
import com.unboundid.ldap.sdk.SearchResultEntry;
import com.unboundid.ldap.sdk.SearchScope;
import com.unboundid.util.ssl.SSLUtil;
import freemarker.template.TemplateException;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.auth.RefreshToken;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.util.EmailUtil;
import org.openmetadata.service.util.LdapUtil;
import org.openmetadata.service.util.TokenUtil;
import org.openmetadata.service.util.UserUtil;
import org.springframework.beans.BeanUtils;
import org.springframework.util.CollectionUtils;

@Slf4j
public class LdapAuthenticator implements AuthenticatorHandler {
  static final String LDAP_ERR_MSG = "[LDAP] Issue in creating a LookUp Connection SSL";
  private RoleRepository roleRepository;
  private UserRepository userRepository;
  private TokenRepository tokenRepository;
  private LoginAttemptCache loginAttemptCache;
  private LdapConfiguration ldapConfiguration;
  private LDAPConnectionPool ldapLookupConnectionPool;
  private LoginConfiguration loginConfiguration;

  @Override
  public void init(OpenMetadataApplicationConfig config) {
    if (config.getAuthenticationConfiguration().getProvider().equals(AuthProvider.LDAP)
        && config.getAuthenticationConfiguration().getLdapConfiguration() != null) {
      ldapLookupConnectionPool =
          getLdapConnectionPool(config.getAuthenticationConfiguration().getLdapConfiguration());
    } else {
      throw new IllegalStateException("Invalid or Missing Ldap Configuration.");
    }
    this.roleRepository = new RoleRepository(jdbi.onDemand(CollectionDAO.class));
    this.userRepository = new UserRepository(jdbi.onDemand(CollectionDAO.class));
    this.tokenRepository = Entity.getTokenRepository();
    this.ldapConfiguration = config.getAuthenticationConfiguration().getLdapConfiguration();
    this.loginAttemptCache = new LoginAttemptCache();
    this.loginConfiguration =
        SettingsCache.getSetting(SettingsType.LOGIN_CONFIGURATION, LoginConfiguration.class);
  }

  private LDAPConnectionPool getLdapConnectionPool(LdapConfiguration ldapConfiguration) {
    try {
      if (Boolean.TRUE.equals(ldapConfiguration.getSslEnabled())) {
        LDAPConnectionOptions connectionOptions = new LDAPConnectionOptions();
        LdapUtil ldapUtil = new LdapUtil();
        SSLUtil sslUtil =
            new SSLUtil(ldapUtil.getLdapSSLConnection(ldapConfiguration, connectionOptions));

        try (LDAPConnection connection =
            new LDAPConnection(
                sslUtil.createSSLSocketFactory(),
                connectionOptions,
                ldapConfiguration.getHost(),
                ldapConfiguration.getPort(),
                ldapConfiguration.getDnAdminPrincipal(),
                ldapConfiguration.getDnAdminPassword())) {
          // Use the connection here.
          return new LDAPConnectionPool(connection, ldapConfiguration.getMaxPoolSize());
        } catch (GeneralSecurityException e) {
          LOG.error(LDAP_ERR_MSG, e);
          throw new IllegalStateException(LDAP_ERR_MSG, e);
        }
      } else {
        try (LDAPConnection conn =
            new LDAPConnection(
                ldapConfiguration.getHost(),
                ldapConfiguration.getPort(),
                ldapConfiguration.getDnAdminPrincipal(),
                ldapConfiguration.getDnAdminPassword())) {
          return new LDAPConnectionPool(conn, ldapConfiguration.getMaxPoolSize());
        } catch (LDAPException e) {
          LOG.error("[LDAP] Issue in creating a LookUp Connection", e);
          throw new IllegalStateException("[LDAP] Issue in creating a LookUp Connection", e);
        }
      }
    } catch (LDAPException e) {
      throw new IllegalStateException(LDAP_ERR_MSG, e);
    }
  }

  @Override
  public JwtResponse loginUser(LoginRequest loginRequest) throws IOException, TemplateException {
    checkIfLoginBlocked(loginRequest.getEmail());
    User storedUser = lookUserInProvider(loginRequest.getEmail());
    validatePassword(storedUser.getEmail(), storedUser, loginRequest.getPassword());
    User omUser = checkAndCreateUser(storedUser.getEmail(), storedUser.getFullyQualifiedName(), storedUser.getName());
    return getJwtResponse(omUser, loginConfiguration.getJwtTokenExpiryTime());
  }

  private User checkAndCreateUser(String email) {
    // Check if the user exists in OM Database
    try {
      return userRepository.getByName(
          null, email.split("@")[0], userRepository.getFields("id,name,email"));
    } catch (EntityNotFoundException ex) {
      // User does not exist
      return userRepository.create(null, getUserForLdap(email));
    }
  }

  /**
   * Check if the user exists in database by userName, if user exist, reassign roles for user according to it's ldap
   * group else, create a new user and assign roles according to it's ldap group
   *
   * @param email email address of user
   * @param userName userName of user
   * @param userDn the dn of user from ldap
   * @return user info
   * @author Eric Wen@2023-07-16 17:06:43
   */
  private User checkAndCreateUser(String email, String userName, String userDn) throws IOException {
    // Check if the user exists in OM Database
    try {
      User omUser = userRepository.getByName(null, userName, userRepository.getFields("id,name,email,roles"));
      getRoleForLdap(omUser, userDn, Boolean.TRUE);
      return omUser;
    } catch (EntityNotFoundException ex) {
      // User does not exist
      return userRepository.create(null, getUserForLdap(email, userName, userDn, Boolean.FALSE));
    } catch (LDAPException e) {
      LOG.error("An error occurs when reassigning roles for an LDAP user({}): {}", userName, e.getMessage(), e);
      throw new RuntimeException(e);
    }
  }

  @Override
  public void checkIfLoginBlocked(String email) {
    if (loginAttemptCache.isLoginBlocked(email)) {
      throw new AuthenticationException(MAX_FAILED_LOGIN_ATTEMPT);
    }
  }

  @Override
  public void recordFailedLoginAttempt(String providedIdentity, User storedUser)
      throws TemplateException, IOException {
    loginAttemptCache.recordFailedLogin(providedIdentity);
    int failedLoginAttempt = loginAttemptCache.getUserFailedLoginCount(providedIdentity);
    if (failedLoginAttempt == loginConfiguration.getMaxLoginFailAttempts()) {
      EmailUtil.sendAccountStatus(
          storedUser,
          "Multiple Failed Login Attempts.",
          String.format(
              "Someone is tried accessing your account. Login is Blocked for %s seconds.",
              loginConfiguration.getAccessBlockTime()));
    }
  }

  @Override
  public void validatePassword(String providedIdentity, User storedUser, String reqPassword)
      throws TemplateException, IOException {
    // performed in LDAP , the storedUser's name set as DN of the User in Ldap
    BindResult bindingResult = null;
    try {
      bindingResult = ldapLookupConnectionPool.bind(storedUser.getName(), reqPassword);
      if (Objects.equals(bindingResult.getResultCode().getName(), ResultCode.SUCCESS.getName())) {
        return;
      }
    } catch (Exception ex) {
      if (bindingResult != null
          && Objects.equals(
              bindingResult.getResultCode().getName(), ResultCode.INVALID_CREDENTIALS.getName())) {
        recordFailedLoginAttempt(providedIdentity, storedUser);
        throw new CustomExceptionMessage(UNAUTHORIZED, INVALID_EMAIL_PASSWORD);
      }
    }
    if (bindingResult != null) {
      throw new CustomExceptionMessage(
          INTERNAL_SERVER_ERROR, bindingResult.getResultCode().getName());
    } else {
      throw new CustomExceptionMessage(INTERNAL_SERVER_ERROR, INVALID_EMAIL_PASSWORD);
    }
  }

  @Override
  public User lookUserInProvider(String email) {
    try {
      Filter filter;
          Filter.create(String.format("%s=%s", ldapConfiguration.getMailAttributeName(), email));
      SearchRequest searchRequest =
          new SearchRequest(
              ldapConfiguration.getUserBaseDN(),
              SearchScope.SUB,
              emailFilter,
              ldapConfiguration.getMailAttributeName());
      SearchResult result = ldapLookupConnectionPool.search(searchRequest);
      // there has to be a unique entry for username and email in LDAP under the group
      if (result.getSearchEntries().size() == 1) {
        // Get the user using DN directly
        SearchResultEntry searchResultEntry = result.getSearchEntries().get(0);
        String userDN = searchResultEntry.getDN();
        Attribute emailAttr =
            searchResultEntry.getAttribute(ldapConfiguration.getMailAttributeName());

        if (!CommonUtil.nullOrEmpty(userDN) && emailAttr != null) {
          return getUserForLdap(emailAttr.getValue(), userNameAttr.getValue()).withName(userDN);
        } else {
          throw new CustomExceptionMessage(FORBIDDEN, LDAP_MISSING_ATTR);
        }
      } else if (result.getSearchEntries().size() > 1) {
        throw new CustomExceptionMessage(INTERNAL_SERVER_ERROR, MULTIPLE_EMAIL_ENTRIES);
      } else {
        throw new CustomExceptionMessage(INTERNAL_SERVER_ERROR, INVALID_EMAIL_PASSWORD);
      }
    } catch (LDAPException ex) {
      throw new CustomExceptionMessage(INTERNAL_SERVER_ERROR, ex.getMessage());
    }
  }

  private User getUserForLdap(String email) {
    String userName = email.split("@")[0];
    return new User()
        .withId(UUID.randomUUID())
        .withName(userName)
        .withFullyQualifiedName(userName)
        .withEmail(email)
        .withIsBot(false)
        .withUpdatedBy(userName)
        .withUpdatedAt(System.currentTimeMillis())
        .withIsEmailVerified(false)
        .withAuthenticationMechanism(null);
  }

  /**
   * Generating a new user object for ldap Getting user's name from attribute instead of separating from email
   *
   * @param email user's email address
   * @param userName user's name
   * @return new user object for ldap
   * @author Eric Wen@2023-07-16 17:23:57
   */
  private User getUserForLdap(String email, String userName) {
    return new User()
        .withId(UUID.randomUUID())
        .withName(userName)
        .withFullyQualifiedName(userName)
        .withEmail(email)
        .withIsBot(false)
        .withUpdatedBy(userName)
        .withUpdatedAt(System.currentTimeMillis())
        .withIsEmailVerified(false)
        .withAuthenticationMechanism(null);
  }

  /**
   * Generating a new user object for ldap Getting user's name from attribute instead of separating from email Reassign
   * roles for user according to it's ldap group
   *
   * @param email user's email address
   * @param userName user's name
   * @param userDn the dn of user from ldap
   * @param reAssignRole flag to decide whether to reassign roles
   * @return new user object for ldap with roles
   * @author Eric Wen@2023-07-16 17:23:57
   */
  private User getUserForLdap(String email, String userName, String userDn, Boolean reAssignRole) {
    User user =
        new User()
            .withId(UUID.randomUUID())
            .withName(userName)
            .withFullyQualifiedName(userName)
            .withEmail(email)
            .withIsBot(false)
            .withUpdatedBy(userName)
            .withUpdatedAt(System.currentTimeMillis())
            .withIsEmailVerified(false)
            .withAuthenticationMechanism(null);

    try {
      this.getRoleForLdap(user, userDn, reAssignRole);
    } catch (LDAPException | JsonProcessingException e) {
      throw new RuntimeException(e);
    }

    return user;
  }

  /**
   * Getting user's roles according to the mapping between ldap groups and roles
   *
   * @param user user object
   * @param userDn the dn of user from ldap
   * @param reAssign flag to decide whether to reassign roles
   * @author Eric Wen@2023-07-16 17:23:57
   */
  private void getRoleForLdap(User user, String userDn, Boolean reAssign)
      throws LDAPException, JsonProcessingException {
    // Get user's groups from LDAP server using the DN of the user
    String searchFilter =
        String.format(
            "(&(%s=%s)(%s=%s))",
            ldapConfiguration.getGroupAttributeName(),
            ldapConfiguration.getGroupAttributeValue(),
            ldapConfiguration.getGroupMemberAttributeName(),
            userDn);
    SearchRequest searchRequest =
        new SearchRequest(
            ldapConfiguration.getGroupBaseDN(), SearchScope.SUB, searchFilter, ldapConfiguration.getAllAttributeName());
    SearchResult searchResult = ldapLookupConnectionPool.search(searchRequest);

    // if user don't belong to any group, assign empty role list to it
    if (CollectionUtils.isEmpty(searchResult.getSearchEntries())) {
      if (reAssign) {
        user.setRoles(this.getReassignRoles(user, new ArrayList<>(0), Boolean.FALSE));
        UserUtil.addOrUpdateUser(user);
      }
      return;
    }

    // get the role mapping from LDAP configuration
    ObjectMapper objectMapper = new ObjectMapper();
    Map<String, List<String>> roleMapping = objectMapper.readValue(ldapConfiguration.getAuthRolesMapping(), Map.class);

    List<EntityReference> roleReferenceList = new ArrayList<>();

    boolean adminFlag = Boolean.FALSE;

    // match the user's ldap groups with the role mapping according to groupDN
    for (SearchResultEntry searchResultEntry : searchResult.getSearchEntries()) {
      String groupDN = searchResultEntry.getDN();
      if (roleMapping.containsKey(groupDN) && !CollectionUtils.isEmpty(roleMapping.get(groupDN))) {
        List<String> roles = roleMapping.get(groupDN);
        for (String roleName : roles) {
          if (ldapConfiguration.getRoleAdminName().equals(roleName)) {
            adminFlag = Boolean.TRUE;
          } else {
            // Check if the role exists in OM Database
            try {
              Role roleOm = roleRepository.getByName(null, roleName, roleRepository.getFields("id,name"));
              EntityReference entityReference = new EntityReference();
              BeanUtils.copyProperties(roleOm, entityReference);
              entityReference.setType(Entity.ROLE);
              roleReferenceList.add(entityReference);
            } catch (EntityNotFoundException ex) {
              // Role does not exist
              LOG.error("Role {} does not exist in OM Database", roleName);
            } catch (IOException e) {
              throw new RuntimeException(e);
            }
          }
        }
      }
    }
    // Remove duplicate roles by role name
    roleReferenceList =
        new ArrayList<>(
            roleReferenceList.stream()
                .collect(
                    Collectors.toMap(
                        EntityReference::getName,
                        Function.identity(),
                        (entityReference1, entityReference2) -> entityReference1,
                        LinkedHashMap::new))
                .values());
    user.setRoles(this.getReassignRoles(user, roleReferenceList, adminFlag));

    if (reAssign) {
      // Re-assign the roles to the user
      UserUtil.addOrUpdateUser(user);
    }
  }

  /**
   * get the roles which should be reassigned from ldap mapping role list and remove the roles which should be
   * reassigned from user's old role list
   *
   * @param user user object that should be reassigned roles
   * @param mapRoleList the roles mapping from user's ldap groups
   * @param adminFlag whether user is admin in ldap groups
   * @return role list that should be reassigned to user
   */
  private List<EntityReference> getReassignRoles(User user, List<EntityReference> mapRoleList, Boolean adminFlag) {
    Set<String> reassignRolesSet = ldapConfiguration.getAuthReassignRoles();

    // if setting indicates that all roles should be reassigned, just return the mapping roles
    if (!reassignRolesSet.contains(ldapConfiguration.getAllAttributeName())) {
      // if the ldap mapping roles shouldn't be reassigned, remove it
      if (!CollectionUtils.isEmpty(mapRoleList)) {
        for (int i = mapRoleList.size() - 1; i >= 0; i--) {
          EntityReference mappingRole = mapRoleList.get(i);
          if (!reassignRolesSet.contains(mappingRole.getName())) {
            mapRoleList.remove(i);
          }
        }
      }

      // if the old role shouldn't be reassigned, add it to the mapping list
      List<EntityReference> oldRoleList = user.getRoles();
      if (!CollectionUtils.isEmpty(oldRoleList)) {
        for (EntityReference oldRole : oldRoleList) {
          if (!reassignRolesSet.contains(oldRole.getName())) {
            mapRoleList.add(oldRole);
          }
        }
      }

      // check whether to reassign Admin or not
      if (reassignRolesSet.contains(ldapConfiguration.getRoleAdminName())) {
        user.setIsAdmin(adminFlag);
      }
    } else {
      user.setIsAdmin(adminFlag);
    }

    return mapRoleList;
  }

  @Override
  public RefreshToken createRefreshTokenForLogin(UUID currentUserId) {
    // just delete the existing token
    tokenRepository.deleteTokenByUserAndType(currentUserId, REFRESH_TOKEN.toString());
    RefreshToken newRefreshToken = TokenUtil.getRefreshToken(currentUserId, UUID.randomUUID());
    // save Refresh Token in Database
    tokenRepository.insertToken(newRefreshToken);

    return newRefreshToken;
  }
}
