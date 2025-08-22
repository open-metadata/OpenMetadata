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

package org.openmetadata.service.security.auth;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.INTERNAL_SERVER_ERROR;
import static jakarta.ws.rs.core.Response.Status.NOT_IMPLEMENTED;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.api.teams.CreateUser.CreatePasswordType.ADMIN_CREATE;
import static org.openmetadata.schema.auth.ChangePasswordRequest.RequestType.SELF;
import static org.openmetadata.schema.auth.ChangePasswordRequest.RequestType.USER;
import static org.openmetadata.schema.auth.TokenType.EMAIL_VERIFICATION;
import static org.openmetadata.schema.auth.TokenType.PASSWORD_RESET;
import static org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.BASIC;
import static org.openmetadata.service.exception.CatalogExceptionMessage.EMAIL_EXISTS;
import static org.openmetadata.service.exception.CatalogExceptionMessage.EMAIL_SENDING_ISSUE;
import static org.openmetadata.service.exception.CatalogExceptionMessage.FAILED_SEND_EMAIL;
import static org.openmetadata.service.exception.CatalogExceptionMessage.INCORRECT_OLD_PASSWORD;
import static org.openmetadata.service.exception.CatalogExceptionMessage.INVALID_TOKEN;
import static org.openmetadata.service.exception.CatalogExceptionMessage.INVALID_USERNAME_PASSWORD;
import static org.openmetadata.service.exception.CatalogExceptionMessage.INVALID_USER_OR_PASSWORD;
import static org.openmetadata.service.exception.CatalogExceptionMessage.MAX_FAILED_LOGIN_ATTEMPT;
import static org.openmetadata.service.exception.CatalogExceptionMessage.PASSWORD_RESET_TOKEN_EXPIRED;
import static org.openmetadata.service.exception.CatalogExceptionMessage.SELF_SIGNUP_DISABLED_MESSAGE;
import static org.openmetadata.service.exception.CatalogExceptionMessage.SELF_SIGNUP_NOT_ENABLED;
import static org.openmetadata.service.exception.CatalogExceptionMessage.TOKEN_EXPIRED;
import static org.openmetadata.service.exception.CatalogExceptionMessage.TOKEN_EXPIRY_ERROR;
import static org.openmetadata.service.resources.teams.UserResource.USER_PROTECTED_FIELDS;
import static org.openmetadata.service.util.UserUtil.getRoleListFromUser;
import static org.openmetadata.service.util.UserUtil.getUser;
import static org.openmetadata.service.util.email.EmailUtil.getSmtpSettings;
import static org.openmetadata.service.util.email.EmailUtil.sendAccountStatus;
import static org.openmetadata.service.util.email.TemplateConstants.APPLICATION_LOGIN_LINK;
import static org.openmetadata.service.util.email.TemplateConstants.ENTITY;
import static org.openmetadata.service.util.email.TemplateConstants.INVITE_CREATE_PASSWORD_TEMPLATE;
import static org.openmetadata.service.util.email.TemplateConstants.INVITE_RANDOM_PASSWORD_TEMPLATE;
import static org.openmetadata.service.util.email.TemplateConstants.PASSWORD;
import static org.openmetadata.service.util.email.TemplateConstants.SUPPORT_URL;
import static org.openmetadata.service.util.email.TemplateConstants.USERNAME;

import at.favre.lib.crypto.bcrypt.BCrypt;
import freemarker.template.TemplateException;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.TokenInterface;
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
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.PasswordUtil;
import org.openmetadata.service.util.RestUtil.PutResponse;
import org.openmetadata.service.util.TokenUtil;
import org.openmetadata.service.util.email.EmailUtil;

@Slf4j
public class BasicAuthenticator implements AuthenticatorHandler {
  // No of cycles to perform hashing, increasing too much slows the algorithm
  private static final int HASHING_COST = 12;
  private UserRepository userRepository;
  private TokenRepository tokenRepository;
  private AuthorizerConfiguration authorizerConfiguration;
  private boolean isSelfSignUpAvailable;

  @Override
  public void init(OpenMetadataApplicationConfig config) {
    this.userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    this.tokenRepository = Entity.getTokenRepository();
    this.authorizerConfiguration = config.getAuthorizerConfiguration();
    this.isSelfSignUpAvailable =
        SecurityConfigurationManager.getInstance().getCurrentAuthConfig().getEnableSelfSignup();
  }

  @Override
  public User registerUser(RegistrationRequest newRegistrationRequest) {
    if (isSelfSignUpAvailable) {
      String newRegistrationRequestEmail = newRegistrationRequest.getEmail();
      String[] tokens = newRegistrationRequest.getEmail().split("@");
      String emailDomain = tokens[1];
      Set<String> allowedDomains = authorizerConfiguration.getAllowedEmailRegistrationDomains();
      if (!allowedDomains.contains("all") && !allowedDomains.contains(emailDomain)) {
        LOG.error("Email with this Domain not allowed: " + newRegistrationRequestEmail);
        throw new BadRequestException(
            "Email with the given domain is not allowed. Contact Administrator");
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
      throw new CustomExceptionMessage(
          NOT_IMPLEMENTED, SELF_SIGNUP_NOT_ENABLED, SELF_SIGNUP_DISABLED_MESSAGE);
    }
  }

  @Override
  public void confirmEmailRegistration(UriInfo uriInfo, String emailToken) {
    EmailVerificationToken emailVerificationToken =
        (EmailVerificationToken) tokenRepository.findByToken(emailToken);
    User registeredUser =
        userRepository.get(
            null, emailVerificationToken.getUserId(), userRepository.getFieldsWithUserAuth("*"));
    if (Boolean.TRUE.equals(registeredUser.getIsEmailVerified())) {
      LOG.info("User [{}] already registered.", emailToken);
      return;
    }

    // verify Token Expiry
    if (emailVerificationToken.getExpiryDate().compareTo(Instant.now().toEpochMilli()) < 0) {
      throw new CustomExceptionMessage(
          INTERNAL_SERVER_ERROR,
          TOKEN_EXPIRED,
          String.format(TOKEN_EXPIRY_ERROR, emailVerificationToken.getToken()));
    }

    // Update the user
    registeredUser.setIsEmailVerified(true);
    userRepository.createOrUpdate(uriInfo, registeredUser, registeredUser.getName());

    // deleting the entry for the token from the Database
    tokenRepository.deleteTokenByUserAndType(registeredUser.getId(), EMAIL_VERIFICATION.toString());
  }

  @Override
  public void resendRegistrationToken(UriInfo uriInfo, User registeredUser) throws IOException {
    tokenRepository.deleteTokenByUserAndType(registeredUser.getId(), EMAIL_VERIFICATION.toString());
    sendEmailVerification(uriInfo, registeredUser);
  }

  @Override
  public void sendEmailVerification(UriInfo uriInfo, User user) throws IOException {
    if (getSmtpSettings().getEnableSmtpServer()) {
      UUID mailVerificationToken = UUID.randomUUID();
      EmailVerificationToken emailVerificationToken =
          TokenUtil.getEmailVerificationToken(user.getId(), mailVerificationToken);
      LOG.info("Generated Email verification token [" + mailVerificationToken + "]");
      String emailVerificationLink =
          String.format(
              "%s/users/registrationConfirmation?user=%s&token=%s",
              EmailUtil.getOMBaseURL(),
              URLEncoder.encode(user.getFullyQualifiedName(), StandardCharsets.UTF_8),
              mailVerificationToken);
      try {
        EmailUtil.sendEmailVerification(emailVerificationLink, user);
      } catch (TemplateException e) {
        LOG.error("Error in sending mail to the User : {}", e.getMessage(), e);
        throw new CustomExceptionMessage(424, FAILED_SEND_EMAIL, EMAIL_SENDING_ISSUE);
      }
      // insert the token
      tokenRepository.insertToken(emailVerificationToken);
    }
  }

  @Override
  public void sendPasswordResetLink(
      UriInfo uriInfo, User user, String subject, String templateFilePath) throws IOException {
    UUID mailVerificationToken = UUID.randomUUID();
    PasswordResetToken resetToken =
        TokenUtil.getPasswordResetToken(user.getId(), mailVerificationToken);
    LOG.info("Generated Password Reset verification token [" + mailVerificationToken + "]");
    String passwordResetLink =
        String.format(
            "%s/users/password/reset?user=%s&token=%s",
            EmailUtil.getOMBaseURL(),
            URLEncoder.encode(user.getName(), StandardCharsets.UTF_8),
            mailVerificationToken);
    try {
      EmailUtil.sendPasswordResetLink(passwordResetLink, user, subject, templateFilePath);
    } catch (TemplateException e) {
      LOG.error("Error in sending mail to the User : {}", e.getMessage(), e);
      throw new CustomExceptionMessage(424, FAILED_SEND_EMAIL, EMAIL_SENDING_ISSUE);
    }
    // don't persist tokens delete existing
    tokenRepository.deleteTokenByUserAndType(user.getId(), PASSWORD_RESET.toString());
    tokenRepository.insertToken(resetToken);
  }

  @Override
  public void resetUserPasswordWithToken(UriInfo uriInfo, PasswordResetRequest request)
      throws IOException {
    String tokenID = request.getToken();
    PasswordResetToken passwordResetToken =
        (PasswordResetToken) tokenRepository.findByToken(tokenID);
    Set<String> fields = userRepository.getAllowedFieldsCopy();
    fields.add(USER_PROTECTED_FIELDS);
    User storedUser =
        userRepository.getByName(
            uriInfo,
            request.getUsername(),
            new EntityUtil.Fields(fields, String.join(",", fields)));
    // token validity
    if (!passwordResetToken.getUserId().equals(storedUser.getId())) {
      throw new CustomExceptionMessage(BAD_REQUEST, INVALID_TOKEN, "Invalid Token.");
    }
    verifyPasswordResetTokenExpiry(passwordResetToken);
    // passwords validity
    if (!request.getPassword().equals(request.getConfirmPassword())) {
      throw new IllegalArgumentException("Password and Confirm Password should match");
    }
    PasswordUtil.validatePassword(request.getPassword());

    String newHashedPwd =
        BCrypt.withDefaults().hashToString(HASHING_COST, request.getPassword().toCharArray());
    BasicAuthMechanism newAuthForUser = new BasicAuthMechanism().withPassword(newHashedPwd);

    storedUser.setAuthenticationMechanism(
        new AuthenticationMechanism().withAuthType(BASIC).withConfig(newAuthForUser));

    userRepository.createOrUpdate(uriInfo, storedUser, storedUser.getName());

    // delete the user's all password reset token as well , since already updated
    tokenRepository.deleteTokenByUserAndType(storedUser.getId(), PASSWORD_RESET.toString());

    // Update user about Password Change
    try {
      sendAccountStatus(
          storedUser.getName(), storedUser.getEmail(), "Update Password", "Change Successful");
    } catch (TemplateException ex) {
      LOG.error("Error in sending Password Change Mail to User. Reason : " + ex.getMessage(), ex);
      throw new CustomExceptionMessage(424, FAILED_SEND_EMAIL, EMAIL_SENDING_ISSUE);
    }
    LoginAttemptCache.getInstance().recordSuccessfulLogin(request.getUsername());
  }

  @Override
  public void changeUserPwdWithOldPwd(
      UriInfo uriInfo, String userName, ChangePasswordRequest request) throws IOException {
    // passwords validity
    if (!request.getNewPassword().equals(request.getConfirmPassword())) {
      throw new IllegalArgumentException("Password and Confirm Password should match");
    }
    PasswordUtil.validatePassword(request.getNewPassword());

    // Fetch user
    User storedUser =
        userRepository.getByName(uriInfo, userName, userRepository.getFieldsWithUserAuth("*"));

    // when basic auth is enabled and the user is created through the API without password, the
    // stored auth mechanism for the user is null
    if (storedUser.getAuthenticationMechanism() == null) {
      storedUser.setAuthenticationMechanism(
          new AuthenticationMechanism()
              .withAuthType(BASIC)
              .withConfig(new BasicAuthMechanism().withPassword("")));
    }

    BasicAuthMechanism storedBasicAuthMechanism =
        JsonUtils.convertValue(
            storedUser.getAuthenticationMechanism().getConfig(), BasicAuthMechanism.class);

    String storedHashPassword = storedBasicAuthMechanism.getPassword();
    String newHashedPassword =
        BCrypt.withDefaults().hashToString(HASHING_COST, request.getNewPassword().toCharArray());

    if (request.getRequestType() == SELF
        && !BCrypt.verifyer()
            .verify(request.getOldPassword().toCharArray(), storedHashPassword)
            .verified) {
      throw new CustomExceptionMessage(
          BAD_REQUEST, INCORRECT_OLD_PASSWORD, "Old Password is not correct");
    }

    storedBasicAuthMechanism.setPassword(newHashedPassword);
    storedUser.getAuthenticationMechanism().setConfig(storedBasicAuthMechanism);
    PutResponse<User> response =
        userRepository.createOrUpdate(uriInfo, storedUser, storedUser.getName());
    // remove login/details from cache
    LoginAttemptCache.getInstance().recordSuccessfulLogin(userName);

    // in case admin updates , send email to user
    if (request.getRequestType() == USER && getSmtpSettings().getEnableSmtpServer()) {
      // Send mail
      sendInviteMailToUser(
          uriInfo,
          response.getEntity(),
          String.format("%s: Password Update", getSmtpSettings().getEmailingEntity()),
          ADMIN_CREATE,
          request.getNewPassword());
    }
  }

  @Override
  public void sendInviteMailToUser(
      UriInfo uriInfo,
      User user,
      String subject,
      CreateUser.CreatePasswordType requestType,
      String pwd)
      throws IOException {
    switch (requestType) {
      case ADMIN_CREATE -> {
        Map<String, Object> templatePopulator = new HashMap<>();
        templatePopulator.put(ENTITY, getSmtpSettings().getEmailingEntity());
        templatePopulator.put(SUPPORT_URL, getSmtpSettings().getSupportUrl());
        templatePopulator.put(USERNAME, user.getName());
        templatePopulator.put(PASSWORD, pwd);
        templatePopulator.put(APPLICATION_LOGIN_LINK, EmailUtil.getOMBaseURL());
        try {
          EmailUtil.sendMail(
              subject, templatePopulator, user.getEmail(), INVITE_RANDOM_PASSWORD_TEMPLATE, true);
        } catch (TemplateException ex) {
          LOG.error(
              "Failed in sending Mail to user [{}]. Reason : {}",
              user.getEmail(),
              ex.getMessage(),
              ex);
        }
      }
      case USER_CREATE -> sendPasswordResetLink(
          uriInfo, user, subject, INVITE_CREATE_PASSWORD_TEMPLATE);
      default -> LOG.error("Invalid Password Create Type");
    }
  }

  @Override
  public RefreshToken createRefreshTokenForLogin(UUID currentUserId) {
    // just delete the existing token
    RefreshToken newRefreshToken = TokenUtil.getRefreshToken(currentUserId, UUID.randomUUID());
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

  public void verifyPasswordResetTokenExpiry(PasswordResetToken token) {
    if (token.getExpiryDate().compareTo(Instant.now().toEpochMilli()) < 0) {
      throw new CustomExceptionMessage(
          INTERNAL_SERVER_ERROR,
          PASSWORD_RESET_TOKEN_EXPIRED,
          String.format(
              "Password Reset Token %s Expired token. Please issue a new request",
              token.getToken()));
    }
    if (Boolean.FALSE.equals(token.getIsActive())) {
      throw new CustomExceptionMessage(
          INTERNAL_SERVER_ERROR,
          PASSWORD_RESET_TOKEN_EXPIRED,
          String.format("Password Reset Token %s Token was marked inactive", token.getToken()));
    }
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
    String hashedPwd =
        BCrypt.withDefaults().hashToString(HASHING_COST, create.getPassword().toCharArray());

    BasicAuthMechanism newAuthMechanism = new BasicAuthMechanism().withPassword(hashedPwd);
    return getUser(
            username,
            new CreateUser()
                .withName(username)
                .withEmail(create.getEmail())
                .withDisplayName(String.format("%s%s", create.getFirstName(), create.getLastName()))
                .withIsBot(false)
                .withIsAdmin(false))
        .withAuthenticationMechanism(
            new AuthenticationMechanism()
                .withAuthType(AuthenticationMechanism.AuthType.BASIC)
                .withConfig(newAuthMechanism));
  }

  public void validateEmailAlreadyExists(String email) {
    if (userRepository.checkEmailAlreadyExists(email)) {
      throw new CustomExceptionMessage(BAD_REQUEST, EMAIL_EXISTS, "User with Email Already Exists");
    }
  }

  @Override
  public JwtResponse loginUser(LoginRequest loginRequest) throws IOException, TemplateException {
    String email = loginRequest.getEmail();
    checkIfLoginBlocked(email);
    User storedUser = lookUserInProvider(email, loginRequest.getPassword());
    validatePassword(email, loginRequest.getPassword(), storedUser);
    Entity.getUserRepository().updateUserLastLoginTime(storedUser, System.currentTimeMillis());
    return getJwtResponse(storedUser, SecurityUtil.getLoginConfiguration().getJwtTokenExpiryTime());
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
      sendAccountStatus(
          userName,
          email,
          "Multiple Failed Login Attempts.",
          String.format(
              "Someone is trying to access your account. Login is Blocked for %s seconds. Please change your password.",
              SecurityUtil.getLoginConfiguration().getAccessBlockTime()));
    }
  }

  public void validatePassword(String providedIdentity, String reqPassword, User omUser)
      throws TemplateException, IOException {
    // when basic auth is enabled and the user is created through the API without password, the
    // stored auth mechanism
    // for the user is null
    if (omUser.getAuthenticationMechanism() == null) {
      throw new AuthenticationException(INVALID_USERNAME_PASSWORD);
    }
    @SuppressWarnings("unchecked")
    LinkedHashMap<String, String> storedData =
        (LinkedHashMap<String, String>) omUser.getAuthenticationMechanism().getConfig();
    String storedHashPassword = storedData.get("password");
    if (!BCrypt.verifyer().verify(reqPassword.toCharArray(), storedHashPassword).verified) {
      // record Failed Login Attempts
      recordFailedLoginAttempt(omUser.getEmail(), omUser.getName());
      throw new AuthenticationException(INVALID_USERNAME_PASSWORD);
    }
  }

  @Override
  public User lookUserInProvider(String email, String pwd) {
    User storedUser = null;
    try {
      if (email.contains("@")) {
        // lookup by User Email
        storedUser =
            userRepository.getByEmail(
                null,
                email,
                new EntityUtil.Fields(
                    Set.of(USER_PROTECTED_FIELDS, "roles"), "authenticationMechanism,roles"));
      }
    } catch (Exception ignored) {

    }

    if (storedUser == null || Boolean.TRUE.equals(storedUser.getIsBot())) {
      throw new CustomExceptionMessage(
          BAD_REQUEST, INVALID_USER_OR_PASSWORD, INVALID_USERNAME_PASSWORD);
    }

    return storedUser;
  }
}
