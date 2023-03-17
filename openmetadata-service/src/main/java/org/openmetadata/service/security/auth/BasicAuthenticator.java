package org.openmetadata.service.security.auth;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.INTERNAL_SERVER_ERROR;
import static javax.ws.rs.core.Response.Status.NOT_IMPLEMENTED;
import static javax.ws.rs.core.Response.Status.UNAUTHORIZED;
import static org.openmetadata.schema.api.teams.CreateUser.CreatePasswordType.ADMIN_CREATE;
import static org.openmetadata.schema.auth.ChangePasswordRequest.RequestType.SELF;
import static org.openmetadata.schema.auth.ChangePasswordRequest.RequestType.USER;
import static org.openmetadata.schema.auth.TokenType.EMAIL_VERIFICATION;
import static org.openmetadata.schema.auth.TokenType.PASSWORD_RESET;
import static org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.BASIC;
import static org.openmetadata.service.exception.CatalogExceptionMessage.EMAIL_SENDING_ISSUE;
import static org.openmetadata.service.exception.CatalogExceptionMessage.INVALID_USERNAME_PASSWORD;
import static org.openmetadata.service.exception.CatalogExceptionMessage.MAX_FAILED_LOGIN_ATTEMPT;
import static org.openmetadata.service.exception.CatalogExceptionMessage.SELF_SIGNUP_ERROR;
import static org.openmetadata.service.exception.CatalogExceptionMessage.TOKEN_EXPIRY_ERROR;
import static org.openmetadata.service.resources.teams.UserResource.USER_PROTECTED_FIELDS;

import at.favre.lib.crypto.bcrypt.BCrypt;
import com.fasterxml.jackson.core.JsonProcessingException;
import freemarker.template.TemplateException;
import java.io.IOException;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.ws.rs.BadRequestException;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.TokenInterface;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.BasicAuthMechanism;
import org.openmetadata.schema.auth.ChangePasswordRequest;
import org.openmetadata.schema.auth.EmailVerificationToken;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.auth.PasswordResetRequest;
import org.openmetadata.schema.auth.PasswordResetToken;
import org.openmetadata.schema.auth.RefreshToken;
import org.openmetadata.schema.auth.RegistrationRequest;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.auth.TokenRefreshRequest;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.util.EmailUtil;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.PasswordUtil;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.TokenUtil;

@Slf4j
public class BasicAuthenticator implements AuthenticatorHandler {
  // No of cycles to perform hashing, increasing too much slows the algorithm
  private static final int HASHING_COST = 12;
  private UserRepository userRepository;
  private TokenRepository tokenRepository;
  private LoginAttemptCache loginAttemptCache;
  private AuthorizerConfiguration authorizerConfiguration;
  private LoginConfiguration loginConfiguration;
  private boolean isEmailServiceEnabled;
  private boolean isSelfSignUpAvailable;

  @Override
  public void init(OpenMetadataApplicationConfig config, Jdbi jdbi) {
    this.userRepository = new UserRepository(jdbi.onDemand(CollectionDAO.class));
    this.tokenRepository = new TokenRepository(jdbi.onDemand(CollectionDAO.class));
    this.authorizerConfiguration = config.getAuthorizerConfiguration();
    this.loginAttemptCache = new LoginAttemptCache(config);
    SmtpSettings smtpSettings = config.getSmtpSettings();
    this.isEmailServiceEnabled = smtpSettings != null && smtpSettings.getEnableSmtpServer();
    this.isSelfSignUpAvailable = config.getAuthenticationConfiguration().getEnableSelfSignup();
    this.loginConfiguration = config.getApplicationConfiguration().getLoginConfig();
  }

  @Override
  public User registerUser(RegistrationRequest newRegistrationRequest) throws IOException {
    if (isSelfSignUpAvailable) {
      String newRegistrationRequestEmail = newRegistrationRequest.getEmail();
      String[] tokens = newRegistrationRequest.getEmail().split("@");
      String emailDomain = tokens[1];
      Set<String> allowedDomains = authorizerConfiguration.getAllowedEmailRegistrationDomains();
      if (!allowedDomains.contains("all") && !allowedDomains.contains(emailDomain)) {
        LOG.error("Email with this Domain not allowed: " + newRegistrationRequestEmail);
        throw new BadRequestException("Email with the given domain is not allowed. Contact Administrator");
      }
      validateEmailAlreadyExists(newRegistrationRequestEmail);
      PasswordUtil.validatePassword(newRegistrationRequest.getPassword());
      LOG.info("Trying to register new user [" + newRegistrationRequestEmail + "]");
      User newUser = getUserFromRegistrationRequest(newRegistrationRequest);
      // remove auth mechanism from the user
      User registeredUser = userRepository.create(null, newUser);
      registeredUser.setAuthenticationMechanism(null);
      return registeredUser;
    } else {
      throw new CustomExceptionMessage(NOT_IMPLEMENTED, SELF_SIGNUP_ERROR);
    }
  }

  @Override
  public void confirmEmailRegistration(UriInfo uriInfo, String emailToken) throws IOException {
    EmailVerificationToken emailVerificationToken = (EmailVerificationToken) tokenRepository.findByToken(emailToken);
    if (emailVerificationToken == null) {
      throw new EntityNotFoundException("Invalid Token. Please issue a new Request");
    }
    User registeredUser =
        userRepository.get(null, emailVerificationToken.getUserId(), userRepository.getFieldsWithUserAuth("*"));
    if (Boolean.TRUE.equals(registeredUser.getIsEmailVerified())) {
      LOG.info("User [{}] already registered.", emailToken);
      return;
    }

    // verify Token Expiry
    if (emailVerificationToken.getExpiryDate().compareTo(Instant.now().toEpochMilli()) < 0) {
      throw new CustomExceptionMessage(
          INTERNAL_SERVER_ERROR, String.format(TOKEN_EXPIRY_ERROR, emailVerificationToken.getToken()));
    }

    // Update the user
    registeredUser.setIsEmailVerified(true);
    userRepository.createOrUpdate(uriInfo, registeredUser);

    // deleting the entry for the token from the Database
    tokenRepository.deleteTokenByUserAndType(registeredUser.getId().toString(), EMAIL_VERIFICATION.toString());
  }

  @Override
  public void resendRegistrationToken(UriInfo uriInfo, User registeredUser) throws IOException {
    tokenRepository.deleteTokenByUserAndType(registeredUser.getId().toString(), EMAIL_VERIFICATION.toString());
    sendEmailVerification(uriInfo, registeredUser);
  }

  @Override
  public void sendEmailVerification(UriInfo uriInfo, User user) throws IOException {
    if (isEmailServiceEnabled) {
      UUID mailVerificationToken = UUID.randomUUID();
      EmailVerificationToken emailVerificationToken =
          TokenUtil.getEmailVerificationToken(user.getId(), mailVerificationToken);
      LOG.info("Generated Email verification token [" + mailVerificationToken + "]");
      String emailVerificationLink =
          String.format(
              "%s/users/registrationConfirmation?user=%s&token=%s",
              EmailUtil.getInstance().buildBaseUrl(uriInfo.getRequestUri()),
              user.getFullyQualifiedName(),
              mailVerificationToken);
      try {
        EmailUtil.getInstance().sendEmailVerification(emailVerificationLink, user);
      } catch (TemplateException e) {
        LOG.error("Error in sending mail to the User : {}", e.getMessage(), e);
        throw new CustomExceptionMessage(424, EMAIL_SENDING_ISSUE);
      }
      // insert the token
      tokenRepository.insertToken(emailVerificationToken);
    }
  }

  @Override
  public void sendPasswordResetLink(UriInfo uriInfo, User user, String subject, String templateFilePath)
      throws IOException {
    UUID mailVerificationToken = UUID.randomUUID();
    PasswordResetToken resetToken = TokenUtil.getPasswordResetToken(user.getId(), mailVerificationToken);
    LOG.info("Generated Password Reset verification token [" + mailVerificationToken + "]");
    String passwordResetLink =
        String.format(
            "%s/users/password/reset?user=%s&token=%s",
            EmailUtil.getInstance().buildBaseUrl(uriInfo.getRequestUri()),
            user.getFullyQualifiedName(),
            mailVerificationToken);
    try {
      EmailUtil.getInstance().sendPasswordResetLink(passwordResetLink, user, subject, templateFilePath);
    } catch (TemplateException e) {
      LOG.error("Error in sending mail to the User : {}", e.getMessage(), e);
      throw new CustomExceptionMessage(424, EMAIL_SENDING_ISSUE);
    }
    // don't persist tokens delete existing
    tokenRepository.deleteTokenByUserAndType(user.getId().toString(), PASSWORD_RESET.toString());
    tokenRepository.insertToken(resetToken);
  }

  @Override
  public void resetUserPasswordWithToken(UriInfo uriInfo, PasswordResetRequest request) throws IOException {
    String tokenID = request.getToken();
    PasswordResetToken passwordResetToken = (PasswordResetToken) tokenRepository.findByToken(tokenID);
    if (passwordResetToken == null) {
      throw new EntityNotFoundException("Invalid Password Request. Please issue a new request.");
    }
    List<String> fields = userRepository.getAllowedFieldsCopy();
    fields.add(USER_PROTECTED_FIELDS);
    User storedUser =
        userRepository.getByName(
            uriInfo, request.getUsername(), new EntityUtil.Fields(fields, String.join(",", fields)));
    // token validity
    if (!passwordResetToken.getUserId().equals(storedUser.getId())) {
      throw new RuntimeException("Token does not belong to the user.");
    }
    verifyPasswordResetTokenExpiry(passwordResetToken);
    // passwords validity
    if (!request.getPassword().equals(request.getConfirmPassword())) {
      throw new IllegalArgumentException("Password and Confirm Password should match");
    }
    PasswordUtil.validatePassword(request.getPassword());

    String newHashedPwd = BCrypt.withDefaults().hashToString(HASHING_COST, request.getPassword().toCharArray());
    BasicAuthMechanism newAuthForUser = new BasicAuthMechanism().withPassword(newHashedPwd);

    storedUser.setAuthenticationMechanism(new AuthenticationMechanism().withAuthType(BASIC).withConfig(newAuthForUser));

    userRepository.createOrUpdate(uriInfo, storedUser);

    // delete the user's all password reset token as well , since already updated
    tokenRepository.deleteTokenByUserAndType(storedUser.getId().toString(), PASSWORD_RESET.toString());

    // Update user about Password Change
    try {
      EmailUtil.getInstance().sendAccountStatus(storedUser, "Update Password", "Change Successful");
    } catch (TemplateException ex) {
      LOG.error("Error in sending Password Change Mail to User. Reason : " + ex.getMessage(), ex);
      throw new CustomExceptionMessage(424, EMAIL_SENDING_ISSUE);
    }
    loginAttemptCache.recordSuccessfulLogin(request.getUsername());
  }

  @Override
  public void changeUserPwdWithOldPwd(UriInfo uriInfo, String userName, ChangePasswordRequest request)
      throws IOException {
    // passwords validity
    if (!request.getNewPassword().equals(request.getConfirmPassword())) {
      throw new IllegalArgumentException("Password and Confirm Password should match");
    }
    PasswordUtil.validatePassword(request.getNewPassword());

    // Fetch user
    User storedUser = userRepository.getByName(uriInfo, userName, userRepository.getFieldsWithUserAuth("*"));

    // when basic auth is enabled and the user is created through the API without password, the stored auth mechanism
    // for the user is null
    if (storedUser.getAuthenticationMechanism() == null) {
      storedUser.setAuthenticationMechanism(
          new AuthenticationMechanism().withAuthType(BASIC).withConfig(new BasicAuthMechanism().withPassword("")));
    }

    BasicAuthMechanism storedBasicAuthMechanism =
        JsonUtils.convertValue(storedUser.getAuthenticationMechanism().getConfig(), BasicAuthMechanism.class);

    String storedHashPassword = storedBasicAuthMechanism.getPassword();
    String newHashedPassword = BCrypt.withDefaults().hashToString(HASHING_COST, request.getNewPassword().toCharArray());

    if (request.getRequestType() == SELF
        && !BCrypt.verifyer().verify(request.getOldPassword().toCharArray(), storedHashPassword).verified) {
      throw new CustomExceptionMessage(UNAUTHORIZED, "Old Password is not correct");
    }

    storedBasicAuthMechanism.setPassword(newHashedPassword);
    storedUser.getAuthenticationMechanism().setConfig(storedBasicAuthMechanism);
    RestUtil.PutResponse<User> response = userRepository.createOrUpdate(uriInfo, storedUser);
    // remove login/details from cache
    loginAttemptCache.recordSuccessfulLogin(userName);

    // in case admin updates , send email to user
    if (request.getRequestType() == USER && isEmailServiceEnabled) {
      // Send mail
      sendInviteMailToUser(
          uriInfo,
          response.getEntity(),
          String.format("%s: Password Update", EmailUtil.getInstance().getEmailingEntity()),
          ADMIN_CREATE,
          request.getNewPassword());
    }
  }

  public void sendInviteMailToUser(
      UriInfo uriInfo, User user, String subject, CreateUser.CreatePasswordType requestType, String pwd)
      throws IOException {
    switch (requestType) {
      case ADMIN_CREATE:
        Map<String, String> templatePopulator = new HashMap<>();
        templatePopulator.put(EmailUtil.ENTITY, EmailUtil.getInstance().getEmailingEntity());
        templatePopulator.put(EmailUtil.SUPPORT_URL, EmailUtil.getInstance().getSupportUrl());
        templatePopulator.put(EmailUtil.USERNAME, user.getName());
        templatePopulator.put(EmailUtil.PASSWORD, pwd);
        templatePopulator.put(EmailUtil.APPLICATION_LOGIN_LINK, EmailUtil.getInstance().getOMUrl());
        try {
          EmailUtil.getInstance()
              .sendMail(
                  subject,
                  templatePopulator,
                  user.getEmail(),
                  EmailUtil.EMAIL_TEMPLATE_BASEPATH,
                  EmailUtil.INVITE_RANDOM_PWD);
        } catch (TemplateException ex) {
          LOG.error("Failed in sending Mail to user [{}]. Reason : {}", user.getEmail(), ex.getMessage(), ex);
        }
        break;
      case USER_CREATE:
        sendPasswordResetLink(uriInfo, user, subject, EmailUtil.INVITE_CREATE_PWD);
        break;
      default:
        LOG.error("Invalid Password Create Type");
    }
  }

  @Override
  public RefreshToken createRefreshTokenForLogin(UUID currentUserId) throws JsonProcessingException {
    // just delete the existing token
    RefreshToken newRefreshToken = TokenUtil.getRefreshToken(currentUserId, UUID.randomUUID());
    // save Refresh Token in Database
    tokenRepository.insertToken(newRefreshToken);

    return newRefreshToken;
  }

  @Override
  public JwtResponse getNewAccessToken(TokenRefreshRequest request) throws IOException {
    TokenInterface tokenInterface = tokenRepository.findByToken(request.getRefreshToken());
    User storedUser = userRepository.get(null, tokenInterface.getUserId(), userRepository.getFieldsWithUserAuth("*"));
    if (storedUser.getIsBot() != null && storedUser.getIsBot()) {
      throw new IllegalArgumentException("User are only allowed to login");
    }
    RefreshToken refreshToken = validateAndReturnNewRefresh(storedUser.getId(), request);
    JWTAuthMechanism jwtAuthMechanism =
        JWTTokenGenerator.getInstance()
            .generateJWTToken(
                storedUser.getName(),
                storedUser.getEmail(),
                loginConfiguration.getJwtTokenExpiryTime(),
                false,
                ServiceTokenType.OM_USER);
    JwtResponse response = new JwtResponse();
    response.setTokenType("Bearer");
    response.setAccessToken(jwtAuthMechanism.getJWTToken());
    response.setRefreshToken(refreshToken.getToken().toString());
    response.setExpiryDuration(jwtAuthMechanism.getJWTTokenExpiresAt());

    return response;
  }

  public void verifyPasswordResetTokenExpiry(PasswordResetToken token) {
    if (token.getExpiryDate().compareTo(Instant.now().toEpochMilli()) < 0) {
      throw new CustomExceptionMessage(
          INTERNAL_SERVER_ERROR,
          String.format("Password Reset Token %s Expired token. Please issue a new request", token.getToken()));
    }
    if (Boolean.FALSE.equals(token.getIsActive())) {
      throw new CustomExceptionMessage(
          INTERNAL_SERVER_ERROR, String.format("Password Reset Token %s Token was marked inactive", token.getToken()));
    }
  }

  public RefreshToken validateAndReturnNewRefresh(UUID currentUserId, TokenRefreshRequest tokenRefreshRequest)
      throws JsonProcessingException {
    String requestRefreshToken = tokenRefreshRequest.getRefreshToken();
    RefreshToken storedRefreshToken = (RefreshToken) tokenRepository.findByToken(requestRefreshToken);
    if (storedRefreshToken == null) {
      throw new RuntimeException("Invalid Refresh Token");
    }
    if (storedRefreshToken.getExpiryDate().compareTo(Instant.now().toEpochMilli()) < 0) {
      throw new RuntimeException("Expired token. Please login again : " + storedRefreshToken.getToken().toString());
    }
    // TODO: currently allow single login from a place, later multiple login can be added
    // just delete the existing token
    tokenRepository.deleteToken(requestRefreshToken);
    // we use rotating refresh token , generate new token
    RefreshToken newRefreshToken = TokenUtil.getRefreshToken(currentUserId, UUID.randomUUID());
    // save Refresh Token in Database
    tokenRepository.insertToken(newRefreshToken);
    return newRefreshToken;
  }

  private User getUserFromRegistrationRequest(RegistrationRequest create) {
    String username = create.getEmail().split("@")[0];
    String hashedPwd = BCrypt.withDefaults().hashToString(HASHING_COST, create.getPassword().toCharArray());

    BasicAuthMechanism newAuthMechanism = new BasicAuthMechanism().withPassword(hashedPwd);
    return new User()
        .withId(UUID.randomUUID())
        .withName(username)
        .withFullyQualifiedName(username)
        .withEmail(create.getEmail())
        .withDisplayName(create.getFirstName() + create.getLastName())
        .withIsBot(false)
        .withIsAdmin(false)
        .withUpdatedBy(username)
        .withUpdatedAt(System.currentTimeMillis())
        .withIsEmailVerified(false)
        .withAuthenticationMechanism(
            new AuthenticationMechanism()
                .withAuthType(AuthenticationMechanism.AuthType.BASIC)
                .withConfig(newAuthMechanism));
  }

  public void validateEmailAlreadyExists(String email) {
    if (userRepository.checkEmailAlreadyExists(email)) {
      throw new RuntimeException("User with Email Already Exists");
    }
  }

  @Override
  public JwtResponse loginUser(LoginRequest loginRequest) throws IOException, TemplateException {
    String userName =
        loginRequest.getEmail().contains("@") ? loginRequest.getEmail().split("@")[0] : loginRequest.getEmail();
    checkIfLoginBlocked(userName);
    User storedUser = lookUserInProvider(userName);
    validatePassword(storedUser, loginRequest.getPassword());
    return getJwtResponse(storedUser, loginConfiguration.getJwtTokenExpiryTime());
  }

  @Override
  public void checkIfLoginBlocked(String userName) {
    if (loginAttemptCache.isLoginBlocked(userName)) {
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
                  "Someone is trying to access your account. Login is Blocked for %s minutes. Please change your password.",
                  loginConfiguration.getAccessBlockTime()));
    }
  }

  public void validatePassword(User storedUser, String reqPassword) throws TemplateException, IOException {
    // when basic auth is enabled and the user is created through the API without password, the stored auth mechanism
    // for the user is null
    if (storedUser.getAuthenticationMechanism() == null) {
      throw new AuthenticationException(INVALID_USERNAME_PASSWORD);
    }
    @SuppressWarnings("unchecked")
    LinkedHashMap<String, String> storedData =
        (LinkedHashMap<String, String>) storedUser.getAuthenticationMechanism().getConfig();
    String storedHashPassword = storedData.get("password");
    if (!BCrypt.verifyer().verify(reqPassword.toCharArray(), storedHashPassword).verified) {
      // record Failed Login Attempts
      recordFailedLoginAttempt(storedUser);
      throw new AuthenticationException(INVALID_USERNAME_PASSWORD);
    }
  }

  @Override
  public User lookUserInProvider(String userName) {
    User storedUser;
    try {
      storedUser =
          userRepository.getByName(
              null, userName, new EntityUtil.Fields(List.of(USER_PROTECTED_FIELDS), USER_PROTECTED_FIELDS));
      if (storedUser != null && Boolean.TRUE.equals(storedUser.getIsBot())) {
        throw new CustomExceptionMessage(BAD_REQUEST, INVALID_USERNAME_PASSWORD);
      }
    } catch (Exception ex) {
      throw new CustomExceptionMessage(BAD_REQUEST, INVALID_USERNAME_PASSWORD);
    }
    return storedUser;
  }
}
