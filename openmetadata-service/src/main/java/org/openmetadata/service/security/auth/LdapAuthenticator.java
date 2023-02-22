package org.openmetadata.service.security.auth;

import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.INTERNAL_SERVER_ERROR;
import static javax.ws.rs.core.Response.Status.UNAUTHORIZED;
import static org.openmetadata.schema.auth.TokenType.REFRESH_TOKEN;
import static org.openmetadata.service.exception.CatalogExceptionMessage.INVALID_EMAIL_PASSWORD;
import static org.openmetadata.service.exception.CatalogExceptionMessage.LDAP_MISSING_ATTR;
import static org.openmetadata.service.exception.CatalogExceptionMessage.MAX_FAILED_LOGIN_ATTEMPT;
import static org.openmetadata.service.exception.CatalogExceptionMessage.MULTIPLE_EMAIl_ENTRIES;

import com.fasterxml.jackson.core.JsonProcessingException;
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
import java.util.Objects;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.auth.RefreshToken;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.util.EmailUtil;
import org.openmetadata.service.util.LdapUtil;
import org.openmetadata.service.util.TokenUtil;

@Slf4j
public class LdapAuthenticator implements AuthenticatorHandler {
  private UserRepository userRepository;
  private TokenRepository tokenRepository;
  private LoginAttemptCache loginAttemptCache;
  private LdapConfiguration ldapConfiguration;
  private LDAPConnectionPool ldapLookupConnectionPool;
  private LoginConfiguration loginConfiguration;

  @Override
  public void init(OpenMetadataApplicationConfig config, Jdbi jdbi) {
    if (config.getAuthenticationConfiguration().getProvider().equals("ldap")
        && config.getAuthenticationConfiguration().getLdapConfiguration() != null) {
      ldapLookupConnectionPool = getLdapConnectionPool(config.getAuthenticationConfiguration().getLdapConfiguration());
    } else {
      throw new IllegalStateException("Invalid or Missing Ldap Configuration.");
    }
    this.userRepository = new UserRepository(jdbi.onDemand(CollectionDAO.class));
    this.tokenRepository = new TokenRepository(jdbi.onDemand(CollectionDAO.class));
    this.ldapConfiguration = config.getAuthenticationConfiguration().getLdapConfiguration();
    this.loginAttemptCache = new LoginAttemptCache(config);
    this.loginConfiguration = config.getLoginSettings();
  }

  private LDAPConnectionPool getLdapConnectionPool(LdapConfiguration ldapConfiguration) {
    try {
      if (ldapConfiguration.getSslEnabled()) {
        LDAPConnectionOptions connectionOptions = new LDAPConnectionOptions();
        LdapUtil ldapUtil = new LdapUtil();
        SSLUtil sslUtil = new SSLUtil(ldapUtil.getLdapSSLConnection(ldapConfiguration, connectionOptions));

        try (LDAPConnection connection =
            new LDAPConnection(
                sslUtil.createSSLSocketFactory(),
                connectionOptions,
                ldapConfiguration.getHost(),
                ldapConfiguration.getPort())) {
          // Use the connection here.
          return new LDAPConnectionPool(connection, ldapConfiguration.getMaxPoolSize());
        } catch (GeneralSecurityException e) {
          LOG.error("[LDAP] Issue in creating a LookUp Connection SSL", e);
          throw new IllegalStateException("[LDAP] Issue in creating a LookUp Connection SSL", e);
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
      throw new IllegalStateException("[LDAP] Issue in creating a LookUp Connection SSL", e);
    }
  }

  @Override
  public JwtResponse loginUser(LoginRequest loginRequest) throws IOException, TemplateException {
    checkIfLoginBlocked(loginRequest.getEmail());
    User storedUser = lookUserInProvider(loginRequest.getEmail());
    validatePassword(storedUser, loginRequest.getPassword());
    User omUser = checkAndCreateUser(loginRequest.getEmail());
    return getJwtResponse(omUser);
  }

  private User checkAndCreateUser(String email) throws IOException {
    // Check if the user exists in OM Database
    try {
      return userRepository.getByName(null, email.split("@")[0], userRepository.getFields("id,name,email"));
    } catch (EntityNotFoundException ex) {
      // User does not exist
      return userRepository.create(null, getUserForLdap(email));
    }
  }

  @Override
  public void checkIfLoginBlocked(String email) {
    if (loginAttemptCache.isLoginBlocked(email)) {
      throw new AuthenticationException(MAX_FAILED_LOGIN_ATTEMPT);
    }
  }

  @Override
  public void recordFailedLoginAttempt(User storedUser) throws TemplateException, IOException {
    loginAttemptCache.recordFailedLogin(storedUser.getName());
    int failedLoginAttempt = loginAttemptCache.getUserFailedLoginCount(storedUser.getName());
    if (failedLoginAttempt == loginConfiguration.getMaxLoginFailAttempts()) {
      EmailUtil.getInstance()
          .sendAccountStatus(
              storedUser,
              "Multiple Failed Login Attempts.",
              String.format(
                  "Someone is tried accessing your account. Login is Blocked for %s minutes.",
                  loginConfiguration.getAccessBlockTime()));
    }
  }

  @Override
  public void validatePassword(User storedUser, String reqPassword) throws TemplateException, IOException {
    // performed in LDAP , the storedUser's name set as DN of the User in Ldap
    BindResult bindingResult = null;
    try {
      bindingResult = ldapLookupConnectionPool.bind(storedUser.getName(), reqPassword);
      if (Objects.equals(bindingResult.getResultCode().getName(), ResultCode.SUCCESS.getName())) {
        return;
      }
    } catch (Exception ex) {
      if (bindingResult != null
          && Objects.equals(bindingResult.getResultCode().getName(), ResultCode.INVALID_CREDENTIALS.getName())) {
        recordFailedLoginAttempt(storedUser);
        throw new CustomExceptionMessage(UNAUTHORIZED, INVALID_EMAIL_PASSWORD);
      }
    }
    if (bindingResult != null) {
      throw new CustomExceptionMessage(INTERNAL_SERVER_ERROR, bindingResult.getResultCode().getName());
    } else {
      throw new CustomExceptionMessage(INTERNAL_SERVER_ERROR, "Binding for User in LDAP Failed.");
    }
  }

  @Override
  public User lookUserInProvider(String email) {
    try {
      Filter emailFilter = Filter.create(String.format("%s=%s", ldapConfiguration.getMailAttributeName(), email));
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
        Attribute emailAttr = searchResultEntry.getAttribute(ldapConfiguration.getMailAttributeName());

        if (!CommonUtil.nullOrEmpty(userDN) && emailAttr != null) {
          return getUserForLdap(email).withName(userDN);
        } else {
          throw new CustomExceptionMessage(FORBIDDEN, LDAP_MISSING_ATTR);
        }
      } else if (result.getSearchEntries().size() > 1) {
        throw new CustomExceptionMessage(INTERNAL_SERVER_ERROR, MULTIPLE_EMAIl_ENTRIES);
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

  @Override
  public RefreshToken createRefreshTokenForLogin(UUID currentUserId) throws JsonProcessingException {
    // just delete the existing token
    tokenRepository.deleteTokenByUserAndType(currentUserId.toString(), REFRESH_TOKEN.toString());
    RefreshToken newRefreshToken = TokenUtil.getRefreshToken(currentUserId, UUID.randomUUID());
    // save Refresh Token in Database
    tokenRepository.insertToken(newRefreshToken);

    return newRefreshToken;
  }
}
