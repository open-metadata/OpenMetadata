package org.openmetadata.service.security.auth;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static jakarta.ws.rs.core.Response.Status.INTERNAL_SERVER_ERROR;
import static jakarta.ws.rs.core.Response.Status.SERVICE_UNAVAILABLE;
import static jakarta.ws.rs.core.Response.Status.UNAUTHORIZED;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.auth.TokenType.REFRESH_TOKEN;
import static org.openmetadata.service.exception.CatalogExceptionMessage.INVALID_EMAIL_PASSWORD;
import static org.openmetadata.service.exception.CatalogExceptionMessage.INVALID_USER_OR_PASSWORD;
import static org.openmetadata.service.exception.CatalogExceptionMessage.LDAP_MISSING_ATTR;
import static org.openmetadata.service.exception.CatalogExceptionMessage.MAX_FAILED_LOGIN_ATTEMPT;
import static org.openmetadata.service.exception.CatalogExceptionMessage.MULTIPLE_EMAIL_ENTRIES;
import static org.openmetadata.service.exception.CatalogExceptionMessage.PASSWORD_RESET_TOKEN_EXPIRED;
import static org.openmetadata.service.util.UserUtil.getRoleListFromUser;
import static org.openmetadata.service.util.UserUtil.isAdminEmail;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
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
import jakarta.ws.rs.BadRequestException;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.TokenInterface;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.auth.RefreshToken;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.auth.TokenRefreshRequest;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.LdapUtil;
import org.openmetadata.service.util.TokenUtil;
import org.openmetadata.service.util.UserUtil;
import org.openmetadata.service.util.email.EmailUtil;
import org.springframework.beans.BeanUtils;
import org.springframework.util.CollectionUtils;

@Slf4j
public class LdapAuthenticator implements AuthenticatorHandler {
  static final String LDAP_ERR_MSG = "[LDAP] Issue in creating a LookUp Connection ";
  private static final int MAX_RETRIES = 3;
  private static final int BASE_DELAY_MS = 500;
  private RoleRepository roleRepository;
  private UserRepository userRepository;
  private TokenRepository tokenRepository;
  private LdapConfiguration ldapConfiguration;
  private LDAPConnectionPool ldapLookupConnectionPool;
  private boolean isSelfSignUpEnabled;

  @Override
  public void init(OpenMetadataApplicationConfig config) {
    if (SecurityConfigurationManager.getCurrentAuthConfig().getProvider().equals(AuthProvider.LDAP)
        && SecurityConfigurationManager.getCurrentAuthConfig().getLdapConfiguration() != null) {
      ldapLookupConnectionPool =
          getLdapConnectionPool(
              SecurityConfigurationManager.getCurrentAuthConfig().getLdapConfiguration());
    } else {
      throw new IllegalStateException("Invalid or Missing Ldap Configuration.");
    }
    this.userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    this.roleRepository = (RoleRepository) Entity.getEntityRepository(Entity.ROLE);
    this.tokenRepository = Entity.getTokenRepository();
    this.ldapConfiguration =
        SecurityConfigurationManager.getCurrentAuthConfig().getLdapConfiguration();
    this.isSelfSignUpEnabled =
        SecurityConfigurationManager.getCurrentAuthConfig().getEnableSelfSignup();
  }

  private LDAPConnectionPool getLdapConnectionPool(LdapConfiguration ldapConfiguration) {
    LDAPConnectionPool connectionPool;
    try {
      if (Boolean.TRUE.equals(ldapConfiguration.getSslEnabled())) {
        LDAPConnectionOptions connectionOptions = new LDAPConnectionOptions();
        LdapUtil ldapUtil = new LdapUtil();
        SSLUtil sslUtil =
            new SSLUtil(ldapUtil.getLdapSSLConnection(ldapConfiguration, connectionOptions));
        LDAPConnection connection =
            new LDAPConnection(
                sslUtil.createSSLSocketFactory(),
                connectionOptions,
                ldapConfiguration.getHost(),
                ldapConfiguration.getPort(),
                ldapConfiguration.getDnAdminPrincipal(),
                ldapConfiguration.getDnAdminPassword());
        // Use the connection here.
        connectionPool = new LDAPConnectionPool(connection, ldapConfiguration.getMaxPoolSize());
      } else {
        LDAPConnection conn =
            new LDAPConnection(
                ldapConfiguration.getHost(),
                ldapConfiguration.getPort(),
                ldapConfiguration.getDnAdminPrincipal(),
                ldapConfiguration.getDnAdminPassword());
        connectionPool = new LDAPConnectionPool(conn, ldapConfiguration.getMaxPoolSize());
      }
    } catch (LDAPException | GeneralSecurityException e) {
      LOG.error("[LDAP] Issue in creating a LookUp Connection", e);
      throw new IllegalStateException(LDAP_ERR_MSG, e);
    }
    return connectionPool;
  }

  @Override
  public JwtResponse loginUser(LoginRequest loginRequest) throws IOException, TemplateException {
    String email = loginRequest.getEmail();
    checkIfLoginBlocked(email);
    User omUser = lookUserInProvider(email, loginRequest.getPassword());
    Entity.getUserRepository().updateUserLastLoginTime(omUser, System.currentTimeMillis());
    return getJwtResponse(omUser, SecurityUtil.getLoginConfiguration().getJwtTokenExpiryTime());
  }

  /**
   * Gets an existing user by email or creates a new one following the email-first flow.
   * This method follows the same pattern as OIDC and SAML handlers.
   */
  private User getOrCreateLdapUser(String userDn, String email, String displayName)
      throws IOException {
    AuthorizerConfiguration authzConfig = SecurityConfigurationManager.getCurrentAuthzConfig();

    List<String> allowedDomains =
        authzConfig.getAllowedEmailDomains() != null
            ? new ArrayList<>(authzConfig.getAllowedEmailDomains())
            : new ArrayList<>();
    SecurityUtil.validateEmailDomain(email, allowedDomains);

    try {
      User user =
          userRepository.getByEmail(
              null, email, new Fields(Set.of("id", "roles", "teams", "displayName", "isAdmin")));

      boolean needsUpdate = false;

      boolean shouldBeAdmin = isUserAdmin(email, user.getName());
      LOG.info(
          "LDAP login - Email: {}, Username: {}, Should be admin: {}, Current admin status: {}",
          email,
          user.getName(),
          shouldBeAdmin,
          user.getIsAdmin());

      if (shouldBeAdmin && !Boolean.TRUE.equals(user.getIsAdmin())) {
        LOG.info("Updating user {} to admin based on adminEmails/adminPrincipals", user.getName());
        user.setIsAdmin(true);
        needsUpdate = true;
      }

      if (displayName != null && !displayName.equals(user.getDisplayName())) {
        LOG.info(
            "Updating displayName for user {} from '{}' to '{}'",
            user.getName(),
            user.getDisplayName(),
            displayName);
        user.setDisplayName(displayName);
        needsUpdate = true;
      }

      getRoleForLdap(userDn, user, Boolean.TRUE);

      if (needsUpdate) {
        return UserUtil.addOrUpdateUser(user);
      }

      return user;
    } catch (EntityNotFoundException e) {
      LOG.debug("User not found by email {}, will create new user", email);
    }

    if (!isSelfSignUpEnabled) {
      throw new AuthenticationException(
          "User not registered. Contact administrator to create an account.");
    }

    String userName = UserUtil.generateUsernameFromEmail(email, this::usernameExists);
    boolean isAdmin = isUserAdmin(email, userName);
    LOG.info(
        "Creating new LDAP user - Email: {}, Generated username: {}, Is admin: {}",
        email,
        userName,
        isAdmin);

    String domain = email.split("@")[1];
    User newUser =
        UserUtil.user(userName, domain, userName)
            .withEmail(email)
            .withDisplayName(displayName != null ? displayName : userName)
            .withIsAdmin(isAdmin)
            .withIsEmailVerified(true);

    try {
      getRoleForLdap(userDn, newUser, false);
    } catch (JsonProcessingException ex) {
      LOG.error(
          "Failed to assign roles from LDAP for user {} due to {}", userName, ex.getMessage());
    }

    return UserUtil.addOrUpdateUser(newUser);
  }

  @Override
  public void checkIfLoginBlocked(String email) {
    if (LoginAttemptCache.getInstance().isLoginBlocked(email)) {
      throw new AuthenticationException(MAX_FAILED_LOGIN_ATTEMPT);
    }
  }

  @Override
  public void recordFailedLoginAttempt(String email, String userName)
      throws TemplateException, IOException {
    LoginAttemptCache.getInstance().recordFailedLogin(email);
    int failedLoginAttempt = LoginAttemptCache.getInstance().getUserFailedLoginCount(email);
    if (failedLoginAttempt == SecurityUtil.getLoginConfiguration().getMaxLoginFailAttempts()) {
      EmailUtil.sendAccountStatus(
          userName,
          email,
          "Multiple Failed Login Attempts.",
          String.format(
              "Someone is tried accessing your account. Login is Blocked for %s seconds.",
              SecurityUtil.getLoginConfiguration().getAccessBlockTime()));
    }
  }

  @Override
  public void validatePassword(String userDn, String reqPassword, User dummy)
      throws TemplateException, IOException {
    // Retry configuration for connection establishment
    final int maxRetries = 3;
    final int baseDelayMs = 500;

    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        performLdapBind(userDn, reqPassword, dummy);
        return; // Success
      } catch (CustomExceptionMessage e) {
        handleRetryableException(e, attempt, "LDAP connection failed for authentication");
      }
    }

    throw new CustomExceptionMessage(
        SERVICE_UNAVAILABLE,
        "LDAP_CONNECTION_ERROR",
        "Unable to connect to authentication server after " + maxRetries + " attempts.");
  }

  private void performLdapBind(String userDn, String reqPassword, User dummy)
      throws TemplateException, IOException {
    BindResult bindingResult = null;
    LDAPConnection userConnection = null;
    try {
      // Create a new connection for user authentication with proper SSL/TLS support
      if (Boolean.TRUE.equals(ldapConfiguration.getSslEnabled())) {
        // LDAPS (LDAP over SSL) - same configuration as connection pool
        LDAPConnectionOptions connectionOptions = new LDAPConnectionOptions();
        LdapUtil ldapUtil = new LdapUtil();
        SSLUtil sslUtil =
            new SSLUtil(ldapUtil.getLdapSSLConnection(ldapConfiguration, connectionOptions));
        userConnection =
            new LDAPConnection(
                sslUtil.createSSLSocketFactory(),
                connectionOptions,
                ldapConfiguration.getHost(),
                ldapConfiguration.getPort());
      } else {
        userConnection =
            new LDAPConnection(ldapConfiguration.getHost(), ldapConfiguration.getPort());
      }

      // Perform the bind operation
      bindingResult = userConnection.bind(userDn, reqPassword);
      if (Objects.equals(bindingResult.getResultCode().getName(), ResultCode.SUCCESS.getName())) {
        return;
      }

      if (Objects.equals(
          bindingResult.getResultCode().getName(), ResultCode.INVALID_CREDENTIALS.getName())) {
        recordFailedLoginAttempt(dummy.getEmail(), dummy.getName());
        throw new CustomExceptionMessage(
            UNAUTHORIZED, INVALID_USER_OR_PASSWORD, INVALID_EMAIL_PASSWORD);
      }
    } catch (Exception ex) {
      handleLdapException(ex);
    } finally {
      if (userConnection != null) {
        userConnection.close();
      }
    }

    LOG.error(
        "LDAP bind failed with unexpected result: {}", bindingResult.getResultCode().getName());
    throw new CustomExceptionMessage(
        INTERNAL_SERVER_ERROR,
        "LDAP_AUTH_ERROR",
        "Authentication failed: " + bindingResult.getResultCode().getName());
  }

  @Override
  public User lookUserInProvider(String email, String pwd) throws TemplateException, IOException {
    LdapUserInfo ldapUserInfo = getLdapUserInfo(email);

    if (ldapUserInfo != null && !nullOrEmpty(ldapUserInfo.userDn)) {
      User dummy = getUserForLdap(ldapUserInfo.email);
      validatePassword(ldapUserInfo.userDn, pwd, dummy);

      String normalizedEmail = ldapUserInfo.email.toLowerCase();
      return getOrCreateLdapUser(ldapUserInfo.userDn, normalizedEmail, ldapUserInfo.displayName);
    }

    throw new CustomExceptionMessage(
        INTERNAL_SERVER_ERROR, INVALID_USER_OR_PASSWORD, INVALID_EMAIL_PASSWORD);
  }

  private record LdapUserInfo(String userDn, String email, String displayName) {}

  private LdapUserInfo getLdapUserInfo(String email) {
    final int maxRetries = 3;

    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return performLdapUserSearch(email);
      } catch (CustomExceptionMessage e) {
        handleRetryableException(e, attempt, "LDAP connection failed for user lookup");
      }
    }
    throw new CustomExceptionMessage(
        SERVICE_UNAVAILABLE,
        "LDAP_CONNECTION_ERROR",
        "Unable to connect to authentication server after " + maxRetries + " attempts.");
  }

  private LdapUserInfo performLdapUserSearch(String email) {
    AuthenticationConfiguration authConfig = SecurityConfigurationManager.getCurrentAuthConfig();

    String emailAttribute = authConfig.getEmailClaim();
    if (nullOrEmpty(emailAttribute)) {
      emailAttribute = ldapConfiguration.getMailAttributeName();
    }
    if (nullOrEmpty(emailAttribute)) {
      emailAttribute = "mail";
    }

    String displayNameAttribute = authConfig.getDisplayNameClaim();
    if (nullOrEmpty(displayNameAttribute)) {
      displayNameAttribute = "displayName";
    }

    try {
      Filter emailFilter = Filter.createEqualityFilter(emailAttribute, email);
      SearchRequest searchRequest =
          new SearchRequest(
              ldapConfiguration.getUserBaseDN(),
              SearchScope.SUB,
              emailFilter,
              emailAttribute,
              displayNameAttribute);
      SearchResult result = ldapLookupConnectionPool.search(searchRequest);

      if (result.getSearchEntries().size() == 1) {
        SearchResultEntry entry = result.getSearchEntries().get(0);
        String userDN = entry.getDN();
        Attribute emailAttr = entry.getAttribute(emailAttribute);

        if (CommonUtil.nullOrEmpty(userDN) || emailAttr == null) {
          throw new CustomExceptionMessage(FORBIDDEN, INVALID_USER_OR_PASSWORD, LDAP_MISSING_ATTR);
        }

        String ldapEmail = emailAttr.getValue();
        if (!email.equalsIgnoreCase(ldapEmail)) {
          throw new CustomExceptionMessage(FORBIDDEN, INVALID_USER_OR_PASSWORD, LDAP_MISSING_ATTR);
        }

        String displayName = null;
        Attribute displayNameAttr = entry.getAttribute(displayNameAttribute);
        if (displayNameAttr != null && !nullOrEmpty(displayNameAttr.getValue())) {
          displayName = displayNameAttr.getValue();
        }

        if (nullOrEmpty(displayName)) {
          displayName = ldapEmail.split("@")[0];
        }

        LOG.debug(
            "LDAP user info extracted - DN: {}, email: {}, displayName: {}",
            userDN,
            ldapEmail,
            displayName);

        return new LdapUserInfo(userDN, ldapEmail, displayName);
      } else if (result.getSearchEntries().size() > 1) {
        throw new CustomExceptionMessage(
            INTERNAL_SERVER_ERROR, MULTIPLE_EMAIL_ENTRIES, MULTIPLE_EMAIL_ENTRIES);
      } else {
        throw new CustomExceptionMessage(
            INTERNAL_SERVER_ERROR, INVALID_USER_OR_PASSWORD, INVALID_EMAIL_PASSWORD);
      }
    } catch (LDAPException ex) {
      ResultCode resultCode = ex.getResultCode();
      String errorMessage = ex.getMessage();

      if (resultCode == ResultCode.CONNECT_ERROR
          || resultCode == ResultCode.SERVER_DOWN
          || resultCode == ResultCode.UNAVAILABLE
          || resultCode == ResultCode.TIMEOUT
          || errorMessage.contains("Connection refused")
          || errorMessage.contains("Connection reset")
          || errorMessage.contains("No route to host")) {
        LOG.error("LDAP connection error for user lookup: {}", errorMessage);
        throw new CustomExceptionMessage(
            SERVICE_UNAVAILABLE,
            "LDAP_CONNECTION_ERROR",
            "Unable to connect to authentication server. Please try again later.");
      }
      LOG.error("LDAP error during user lookup: {}", errorMessage);
      throw new CustomExceptionMessage(
          INTERNAL_SERVER_ERROR, "LDAP_ERROR", "Authentication server error: " + errorMessage);
    }
  }

  private User getUserForLdap(String email) {
    String userName = email.split("@")[0];
    return UserUtil.getUser(
            userName, new CreateUser().withName(userName).withEmail(email).withIsBot(false))
        .withIsEmailVerified(false)
        .withAuthenticationMechanism(null);
  }

  /**
   * Getting user's roles according to the mapping between ldap groups and roles
   */
  private void getRoleForLdap(String userDn, User user, Boolean reAssign)
      throws JsonProcessingException {
    // Get user's groups from LDAP server using the DN of the user
    try {
      Filter groupFilter =
          Filter.createEqualityFilter(
              ldapConfiguration.getGroupAttributeName(),
              ldapConfiguration.getGroupAttributeValue());
      Filter groupMemberAttr =
          Filter.createEqualityFilter(ldapConfiguration.getGroupMemberAttributeName(), userDn);
      Filter groupAndMemberFilter = Filter.createANDFilter(groupFilter, groupMemberAttr);
      SearchRequest searchRequest =
          new SearchRequest(
              ldapConfiguration.getGroupBaseDN(),
              SearchScope.SUB,
              groupAndMemberFilter,
              ldapConfiguration.getAllAttributeName());
      SearchResult searchResult = ldapLookupConnectionPool.search(searchRequest);

      // if user don't belong to any group, assign empty role list to it
      if (CollectionUtils.isEmpty(searchResult.getSearchEntries())) {
        if (Boolean.TRUE.equals(reAssign)) {
          user.setRoles(this.getReassignRoles(user, new ArrayList<>(0), Boolean.FALSE));
          UserUtil.addOrUpdateUser(user);
        }
        return;
      }

      // get the role mapping from LDAP configuration
      Map<String, List<String>> roleMapping =
          JsonUtils.readValue(ldapConfiguration.getAuthRolesMapping(), new TypeReference<>() {});
      List<EntityReference> roleReferenceList = new ArrayList<>();

      boolean adminFlag = Boolean.FALSE;

      // match the user's ldap groups with the role mapping according to groupDN
      for (SearchResultEntry searchResultEntry : searchResult.getSearchEntries()) {
        String groupDN = searchResultEntry.getDN();
        if (roleMapping.containsKey(groupDN)
            && !CollectionUtils.isEmpty(roleMapping.get(groupDN))) {
          List<String> roles = roleMapping.get(groupDN);
          for (String roleName : roles) {
            if (ldapConfiguration.getRoleAdminName().equals(roleName)) {
              adminFlag = Boolean.TRUE;
            } else {
              // Check if the role exists in OM Database
              try {
                Role roleOm =
                    roleRepository.getByName(null, roleName, roleRepository.getFields("id,name"));
                EntityReference entityReference = new EntityReference();
                BeanUtils.copyProperties(roleOm, entityReference);
                entityReference.setType(Entity.ROLE);
                roleReferenceList.add(entityReference);
              } catch (EntityNotFoundException ex) {
                // Role does not exist
                LOG.error("Role {} does not exist in OM Database", roleName);
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

      if (Boolean.TRUE.equals(reAssign)) {
        UserUtil.addOrUpdateUser(user);
      }
    } catch (Exception ex) {
      LOG.warn(
          "Failed to get user's groups from LDAP server using the DN of the user {} due to {}",
          user.getName(),
          ex.getMessage());
    }
  }

  private boolean isUserAdmin(String email, String username) {
    AuthorizerConfiguration authzConfig = SecurityConfigurationManager.getCurrentAuthzConfig();
    List<String> adminEmails =
        authzConfig.getAdminEmails() != null
            ? new ArrayList<>(authzConfig.getAdminEmails())
            : new ArrayList<>();
    if (isAdminEmail(email, adminEmails)) {
      return true;
    }
    return getAdminPrincipals().contains(username);
  }

  private boolean usernameExists(String username) {
    try {
      Entity.getEntityByName(Entity.USER, username, "id", Include.NON_DELETED);
      return true;
    } catch (EntityNotFoundException e) {
      return false;
    }
  }

  private Set<String> getAdminPrincipals() {
    AuthorizerConfiguration authzConfig = SecurityConfigurationManager.getCurrentAuthzConfig();
    Set<String> principals = authzConfig.getAdminPrincipals();
    return principals != null ? new HashSet<>(principals) : new HashSet<>();
  }

  private List<EntityReference> getReassignRoles(
      User user, List<EntityReference> mapRoleList, Boolean adminFlag) {
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
    RefreshToken newRefreshToken =
        TokenUtil.getRefreshTokenForLDAP(currentUserId, UUID.randomUUID());
    // save Refresh Token in Database
    tokenRepository.insertToken(newRefreshToken);

    return newRefreshToken;
  }

  @Override
  public JwtResponse getNewAccessToken(TokenRefreshRequest request) {
    if (CommonUtil.nullOrEmpty(request.getRefreshToken())) {
      throw new BadRequestException("Token Cannot be Null or Empty String");
    }
    TokenInterface tokenInterface = tokenRepository.findByToken(request.getRefreshToken());
    User storedUser =
        userRepository.get(
            null, tokenInterface.getUserId(), userRepository.getFieldsWithUserAuth("*"));
    if (storedUser.getIsBot() != null && storedUser.getIsBot()) {
      throw new IllegalArgumentException("User are only allowed to login");
    }
    RefreshToken refreshToken = validateAndReturnNewRefresh(storedUser.getId(), request);
    JWTAuthMechanism jwtAuthMechanism =
        JWTTokenGenerator.getInstance()
            .generateJWTToken(
                storedUser.getName(),
                getRoleListFromUser(storedUser),
                !nullOrEmpty(storedUser.getIsAdmin()) && storedUser.getIsAdmin(),
                storedUser.getEmail(),
                SecurityUtil.getLoginConfiguration().getJwtTokenExpiryTime(),
                false,
                ServiceTokenType.OM_USER);
    JwtResponse response = new JwtResponse();
    response.setTokenType("Bearer");
    response.setAccessToken(jwtAuthMechanism.getJWTToken());
    response.setRefreshToken(refreshToken.getToken().toString());
    response.setExpiryDuration(jwtAuthMechanism.getJWTTokenExpiresAt());

    return response;
  }

  public RefreshToken validateAndReturnNewRefresh(
      UUID currentUserId, TokenRefreshRequest tokenRefreshRequest) {
    String requestRefreshToken = tokenRefreshRequest.getRefreshToken();
    RefreshToken storedRefreshToken =
        (RefreshToken) tokenRepository.findByToken(requestRefreshToken);
    if (storedRefreshToken.getExpiryDate().compareTo(Instant.now().toEpochMilli()) < 0) {
      throw new CustomExceptionMessage(
          BAD_REQUEST,
          PASSWORD_RESET_TOKEN_EXPIRED,
          "Expired token. Please login again : " + storedRefreshToken.getToken().toString());
    }

    // just delete the existing token
    tokenRepository.deleteToken(requestRefreshToken);
    // we use rotating refresh token , generate new token
    RefreshToken newRefreshToken =
        TokenUtil.getRefreshTokenForLDAP(currentUserId, UUID.randomUUID());
    // save Refresh Token in Database
    tokenRepository.insertToken(newRefreshToken);

    return newRefreshToken;
  }

  private void handleRetryableException(CustomExceptionMessage e, int attempt, String logMessage) {
    if (e.getMessage().contains("Unable to connect to authentication server")
        && attempt < MAX_RETRIES) {
      int delayMs = BASE_DELAY_MS * attempt;
      LOG.warn(
          "{} (attempt {}/{}). Retrying in {}ms...", logMessage, attempt, MAX_RETRIES, delayMs);
      try {
        Thread.sleep(delayMs);
      } catch (InterruptedException ie) {
        Thread.currentThread().interrupt();
        LOG.error("LDAP retry interrupted");
        throw e;
      }
    } else {
      throw e;
    }
  }

  private void handleLdapException(Exception ex) throws TemplateException, IOException {
    if (ex instanceof LDAPException ldapEx) {
      ResultCode resultCode = ldapEx.getResultCode();
      String errorMessage = ldapEx.getMessage();

      // Check if it's a connection/network error
      if (resultCode == ResultCode.CONNECT_ERROR
          || resultCode == ResultCode.SERVER_DOWN
          || resultCode == ResultCode.UNAVAILABLE
          || resultCode == ResultCode.TIMEOUT
          || errorMessage.contains("Connection refused")
          || errorMessage.contains("Connection reset")
          || errorMessage.contains("No route to host")) {
        LOG.error("LDAP connection error during authentication: {}", errorMessage);
        throw new CustomExceptionMessage(
            SERVICE_UNAVAILABLE,
            "LDAP_CONNECTION_ERROR",
            "Unable to connect to authentication server. Please try again later.");
      }
      LOG.error("LDAP error during authentication: {}", errorMessage);
      throw new CustomExceptionMessage(
          INTERNAL_SERVER_ERROR, "LDAP_ERROR", "Authentication server error: " + errorMessage);
    } else if (ex instanceof GeneralSecurityException) {
      LOG.error("SSL/TLS error during LDAP authentication", ex);
      throw new CustomExceptionMessage(
          INTERNAL_SERVER_ERROR,
          "LDAP_SSL_ERROR",
          "SSL/TLS configuration error: " + ex.getMessage());
    } else {
      LOG.error("Unexpected error during LDAP authentication", ex);
      throw new CustomExceptionMessage(
          INTERNAL_SERVER_ERROR,
          "LDAP_UNEXPECTED_ERROR",
          "Unexpected authentication error: " + ex.getMessage());
    }
  }
}
