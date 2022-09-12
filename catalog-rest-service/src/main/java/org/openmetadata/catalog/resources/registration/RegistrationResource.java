package org.openmetadata.catalog.resources.registration;

import at.favre.lib.crypto.bcrypt.BCrypt;
import com.fasterxml.jackson.core.JsonProcessingException;
import freemarker.template.TemplateException;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import javax.validation.Valid;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.teams.CreateUser;
import org.openmetadata.catalog.auth.EmailVerificationToken;
import org.openmetadata.catalog.auth.JwtResponse;
import org.openmetadata.catalog.auth.LoginRequest;
import org.openmetadata.catalog.auth.PasswordResetLinkRequest;
import org.openmetadata.catalog.auth.PasswordResetRequest;
import org.openmetadata.catalog.auth.PasswordResetToken;
import org.openmetadata.catalog.auth.RefreshToken;
import org.openmetadata.catalog.auth.TokenInterface;
import org.openmetadata.catalog.auth.TokenType;
import org.openmetadata.catalog.email.EmailRequest;
import org.openmetadata.catalog.email.EmailUtil;
import org.openmetadata.catalog.email.NameEmailPair;
import org.openmetadata.catalog.entity.teams.AuthenticationMechanism;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.TokenRepository;
import org.openmetadata.catalog.jdbi3.UserRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.resources.EntityResource;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.AuthorizerConfiguration;
import org.openmetadata.catalog.security.auth.RegistrationRequest;
import org.openmetadata.catalog.security.jwt.JWTTokenGenerator;
import org.openmetadata.catalog.teams.authn.BasicAuthMechanism;
import org.openmetadata.catalog.teams.authn.JWTAuthMechanism;
import org.openmetadata.catalog.teams.authn.JWTTokenExpiry;
import org.openmetadata.catalog.users.ChangePasswordRequest;
import org.openmetadata.catalog.util.ConfigurationHolder;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.PasswordUtil;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.TokenUtil;
import org.simplejavamail.api.email.Email;

@Slf4j
@Path("/v1/registration")
@Api(value = "Registration collection", tags = "Registration collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "registration")
public class RegistrationResource extends EntityResource<User, UserRepository> {
  public static final String COLLECTION_PATH = "v1/registration/";
  public static final String USER_PROTECTED_FIELDS = "authenticationMechanism";
  private final JWTTokenGenerator jwtTokenGenerator;
  private final TokenRepository tokenRepository;
  private final UserRepository userRepository;

  private final long emailValidity = 7 * 24 * 60 * 60; // 7 days

  @Override
  public User addHref(UriInfo uriInfo, User user) {
    Entity.withHref(uriInfo, user.getTeams());
    Entity.withHref(uriInfo, user.getRoles());
    Entity.withHref(uriInfo, user.getInheritedRoles());
    Entity.withHref(uriInfo, user.getOwns());
    Entity.withHref(uriInfo, user.getFollows());
    return user;
  }

  public RegistrationResource(CollectionDAO dao, Authorizer authorizer) {
    super(User.class, new UserRepository(dao), authorizer);
    userRepository = new UserRepository(dao);
    tokenRepository = new TokenRepository(dao);
    jwtTokenGenerator = JWTTokenGenerator.getInstance();
    //        allowedFields.remove(USER_PROTECTED_FIELDS);
  }

  static final String FIELDS = "profile,roles,teams,follows,owns";

  @POST
  @Path("/register")
  @Operation(
      operationId = "registerUser",
      summary = "Register User",
      tags = "registration",
      description = "Register a new User",
      responses = {
        @ApiResponse(responseCode = "200", description = "The user "),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response registerNewUser(@Context UriInfo uriInfo, @Valid RegistrationRequest create) throws IOException {
    User registeredUser = registerUser(uriInfo, create);
    try {
      sendEmailVerification(uriInfo, registeredUser);
    } catch (Exception e) {
      LOG.error("Error in sending mail to the User : {}", e.getMessage());
    }
    return Response.status(Response.Status.OK).build();
  }

  @GET
  @Path("/registrationConfirmation")
  @Operation(
      operationId = "confirmUserEmail",
      summary = "Confirm User Email",
      tags = "registration",
      description = "Confirm User Email",
      responses = {
        @ApiResponse(responseCode = "200", description = "The user "),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response confirmUserEmail(
      @Context UriInfo uriInfo,
      @Parameter(description = "Token sent for Email Confirmation", schema = @Schema(type = "string"))
          @QueryParam("token")
          String token)
      throws IOException {
    confirmEmailRegistration(uriInfo, token);
    return Response.status(Response.Status.OK).entity("User Verified Successfully").build();
  }

  @GET
  @Path("/resendRegistrationToken")
  @Operation(
      operationId = "resendRegistrationToken",
      summary = "Resend Registration Token",
      tags = "registration",
      description = "Resend Registration Token",
      responses = {
        @ApiResponse(responseCode = "200", description = "The user "),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response resendRegistrationToken(
      @Context UriInfo uriInfo,
      @Parameter(description = "Token sent for Email Confirmation Earlier", schema = @Schema(type = "string"))
          @QueryParam("token")
          String token)
      throws IOException {
    User registeredUser = recreateRegistrationToken(uriInfo, token);
    try {
      sendEmailVerification(uriInfo, registeredUser);
    } catch (Exception e) {
      LOG.error("Error in sending Email Verification mail to the User : {}", e.getMessage());
    }
    return Response.status(Response.Status.OK).build();
  }

  @POST
  @Path("/password/resetLink")
  @Operation(
      operationId = "generatePasswordResetLink",
      summary = "Generate Password Reset Link",
      tags = "registration",
      description = "Generate Password Reset Link",
      responses = {
        @ApiResponse(responseCode = "200", description = "The user "),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response generateResetPasswordLink(@Context UriInfo uriInfo, @Valid PasswordResetLinkRequest request)
      throws IOException {

    User registeredUser = dao.getByEmail(request.getEmail());
    // send a mail to the User with the Update
    try {
      sendPasswordResetLink(uriInfo, registeredUser);
    } catch (Exception ex) {
      LOG.error("Error in sending mail for reset password" + ex.getMessage());
    }

    return Response.status(Response.Status.OK).build();
  }

  @POST
  @Path("/reset/password")
  @Operation(
      operationId = "resetUserPassword",
      summary = "Reset Password For User",
      tags = "users",
      description = "Reset User Password",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The user ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = User.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response resetUserPassword(@Context UriInfo uriInfo, @Valid PasswordResetRequest request) throws IOException {
    String tokenID = request.getToken();
    PasswordResetToken passwordResetToken = (PasswordResetToken) tokenRepository.findByToken(tokenID);
    User storedUser = dao.getByName(uriInfo, request.getUsername(), getFields("*"));
    // token validity
    if (!passwordResetToken.getUserId().equals(storedUser.getId())) {
      throw new RuntimeException("Invalid token for the user");
    }
    verifyPasswordResetTokenExpiry(passwordResetToken);
    // passwords validity
    if (!request.getPassword().equals(request.getConfirmPassword())) {
      throw new RuntimeException("Password and Confirm Password should match");
    }
    PasswordUtil.validatePassword(request.getPassword());

    String newHashedPwd = BCrypt.withDefaults().hashToString(12, request.getPassword().toCharArray());
    BasicAuthMechanism newAuthForUser = new BasicAuthMechanism().withPassword(newHashedPwd);

    storedUser.getAuthenticationMechanism().setConfig(newAuthForUser);
    // Don't want to return the entity just a 201 or 200 should do
    RestUtil.PutResponse<User> response = dao.createOrUpdate(uriInfo, storedUser);

    // Update user about Password Change
    try {
      EmailUtil.getInstance().sendAccountChangeEmail("Update Password", "Change successful", storedUser.getEmail());
    } catch (Exception ex) {
      LOG.error("Error in sending Password Change Mail to User. Reason : " + ex.getMessage());
    }
    return Response.status(response.getStatus()).build();
  }

  @POST
  @Path("/changePassword/{id}")
  @Operation(
      operationId = "changeUserPassword",
      summary = "Change Password For User",
      tags = "registration",
      description = "Create a new user.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The user ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = User.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response changeUserPassword(
      @Context UriInfo uriInfo,
      @Parameter(description = "Username of the user trying to create password", schema = @Schema(type = "string"))
          @PathParam("id")
          String userId,
      @Valid ChangePasswordRequest request)
      throws IOException {
    // validate Password
    PasswordUtil.validatePassword(request.getNewPassword());
    User storedUser = dao.get(uriInfo, UUID.fromString(userId), getFields("*"));
    BasicAuthMechanism storedBasicAuthMechanism =
        JsonUtils.convertValue(storedUser.getAuthenticationMechanism().getConfig(), BasicAuthMechanism.class);
    String storedHashPassword = storedBasicAuthMechanism.getPassword();
    if (BCrypt.verifyer().verify(request.getOldPassword().toCharArray(), storedHashPassword).verified) {
      String newHashedPassword = BCrypt.withDefaults().hashToString(12, request.getNewPassword().toCharArray());
      storedBasicAuthMechanism.setPassword(newHashedPassword);
      storedUser.getAuthenticationMechanism().setConfig(storedBasicAuthMechanism);
      dao.createOrUpdate(uriInfo, storedUser);
      // it has to be 200 since we already fetched user , and we don't want to return any other data
      return Response.status(200).build();
    } else {
      return Response.status(403).entity("Old Password is not correct").build();
    }
  }

  @GET
  @Path("/checkEmailInUse/{email}")
  @Operation(
      operationId = "checkEmailInUse",
      summary = "Check if a mail is already in use",
      tags = "registration",
      description = "Check if a mail is already in use",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Return true or false",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = User.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response checkEmailInUse(
      @Parameter(description = "Email to be checked", schema = @Schema(type = "string")) @QueryParam("email")
          String email) {
    boolean emailExists = dao.checkEmailAlreadyExists(email);
    return Response.status(Response.Status.OK).entity(emailExists).build();
  }

  @POST
  @Path("/login")
  @Operation(
      operationId = "loginUserWithPwd",
      summary = "Login User by Password",
      tags = "users",
      description = "Login a user with Password",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The user ",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = JWTTokenExpiry.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response loginUserWithPassword(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid LoginRequest loginRequest)
      throws IOException {
    User storedUser = dao.getByEmail(loginRequest.getEmail());
    if (storedUser.getIsBot() != null && storedUser.getIsBot()) {
      throw new IllegalArgumentException("User are only allowed to login");
    }
    LinkedHashMap<String, String> storedData =
        (LinkedHashMap<String, String>) storedUser.getAuthenticationMechanism().getConfig();
    String requestPassword = loginRequest.getPassword();
    String storedHashPassword = storedData.get("password");
    if (BCrypt.verifyer().verify(requestPassword.toCharArray(), storedHashPassword).verified) {
      // successfully verified create a jwt token for frontend
      RefreshToken refreshToken = createRefreshTokenForLogin(storedUser.getId());
      JWTAuthMechanism jwtAuthMechanism =
          jwtTokenGenerator.generateJWTToken(
              storedUser.getName(), storedUser.getEmail(), JWTTokenExpiry.OneHour, false);

      JwtResponse response = new JwtResponse();
      response.setTokenType("Bearer");
      response.setAccessToken(jwtAuthMechanism.getJWTToken());
      response.setRefreshToken(refreshToken.getToken().toString());
      response.setExpiryDuration(jwtAuthMechanism.getJWTTokenExpiresAt());
      return Response.status(200).entity(response).build();
    } else {
      return Response.status(403).entity("Not Authorized!").build();
    }
  }

  private User getUser(SecurityContext securityContext, CreateUser create) {
    return new User()
        .withId(UUID.randomUUID())
        .withName(create.getName())
        .withFullyQualifiedName(create.getName())
        .withEmail(create.getEmail())
        .withDescription(create.getDescription())
        .withDisplayName(create.getDisplayName())
        .withIsBot(create.getIsBot())
        .withIsAdmin(create.getIsAdmin())
        .withProfile(create.getProfile())
        .withTimezone(create.getTimezone())
        .withUpdatedBy("admin")
        .withUpdatedAt(System.currentTimeMillis())
        .withTeams(EntityUtil.toEntityReferences(create.getTeams(), Entity.TEAM))
        .withRoles(EntityUtil.toEntityReferences(create.getRoles(), Entity.ROLE));
  }

  private void authorizeGenerateJWT(User user) {
    if (!Boolean.TRUE.equals(user.getIsBot())) {
      throw new IllegalArgumentException("Generating JWT token is only supported for bot users");
    }
  }

  public User registerUser(UriInfo uriInfo, RegistrationRequest newRegistrationRequest) throws IOException {
    String newRegistrationRequestEmail = newRegistrationRequest.getEmail();
    String[] tokens = newRegistrationRequest.getEmail().split("@");
    String userName = tokens[0];
    String emailDomain = tokens[1];
    Set<String> allowedDomains =
        ConfigurationHolder.getInstance()
            .getConfig(ConfigurationHolder.ConfigurationType.AUTHORIZERCONFIG, AuthorizerConfiguration.class)
            .getAllowedEmailRegistrationDomains();
    if (!allowedDomains.contains("all") && !allowedDomains.contains(emailDomain)) {
      LOG.error("Email with this Domain not allowed: " + newRegistrationRequestEmail);
      throw new RuntimeException("Email with the given domain is not allowed. Contact Administrator");
    }
    validateEmailAlreadyExists(newRegistrationRequestEmail);
    PasswordUtil.validatePassword(newRegistrationRequest.getPassword());
    LOG.info("Trying to register new user [" + newRegistrationRequestEmail + "]");
    User newUser = getUserFromRegistrationRequest(newRegistrationRequest);
    if (ConfigurationHolder.getInstance()
        .getConfig(ConfigurationHolder.ConfigurationType.AUTHORIZERCONFIG, AuthorizerConfiguration.class)
        .getAdminPrincipals()
        .contains(userName)) {
      newUser.setIsAdmin(true);
    }
    User registeredNewUser = dao.create(uriInfo, newUser);
    return registeredNewUser;
  }

  private void sendMailToUser(User user, String subject, String content) {
    try {
      EmailRequest request =
          new EmailRequest()
              .withRecipientMails(List.of(new NameEmailPair().withName(user.getName()).withEmail(user.getEmail())))
              .withSubject(subject)
              .withContent(content);
      Email email = EmailUtil.getInstance().buildEmailWithDefaultSender(request);
      EmailUtil.getInstance().sendMail(email);
    } catch (RuntimeException ex) {
      LOG.error("Error in sending mail to User : {}", ex.getMessage());
    }
  }

  private void sendEmailVerification(UriInfo uriInfo, User user) throws IOException, TemplateException {
    UUID mailVerificationToken = UUID.randomUUID();
    EmailVerificationToken emailVerificationToken =
        TokenUtil.getEmailVerificationToken(user.getId(), mailVerificationToken);
    tokenRepository.insertToken(emailVerificationToken);
    LOG.info("Generated Email verification token [" + mailVerificationToken + "]");

    String emailVerificationLink =
        String.format(
            "%s://%s/registration/registrationConfirmation?token=%s",
            uriInfo.getRequestUri().getScheme(), uriInfo.getRequestUri().getHost(), mailVerificationToken);
    EmailUtil.getInstance().sendEmailVerification(emailVerificationLink, user.getEmail());
    ;
  }

  private void sendPasswordResetLink(UriInfo uriInfo, User user) throws IOException, TemplateException {
    UUID mailVerificationToken = UUID.randomUUID();
    PasswordResetToken resetToken = TokenUtil.getPasswordResetToken(user.getId(), mailVerificationToken);
    tokenRepository.insertToken(resetToken);
    LOG.info("Generated Password Reset verification token [" + mailVerificationToken + "]");

    String passwordResetLink =
        String.format(
            "%s://%s/registration/reset/password?user=%s&token=%s",
            uriInfo.getRequestUri().getScheme(),
            uriInfo.getRequestUri().getHost(),
            user.getFullyQualifiedName(),
            mailVerificationToken);
    EmailUtil.getInstance().sendResetPasswordLink(passwordResetLink, user.getEmail());
  }

  public void confirmEmailRegistration(UriInfo uriInfo, String emailToken) throws IOException {
    EmailVerificationToken emailVerificationToken = (EmailVerificationToken) tokenRepository.findByToken(emailToken);

    User registeredUser = userRepository.get(uriInfo, emailVerificationToken.getUserId(), getFields("*"));
    if (registeredUser.getIsEmailVerified()) {
      LOG.info("User [{}] already registered.", emailToken);
      return;
    }

    // verify Token Expiry
    if (emailVerificationToken.getExpiryDate().compareTo(Instant.now().toEpochMilli()) < 0) {
      throw new RuntimeException(
          String.format(
              "Email Verification Token %s Expired token. Please issue a new request",
              emailVerificationToken.getToken()));
    }

    emailVerificationToken.setTokenStatus(EmailVerificationToken.TokenStatus.STATUS_CONFIRMED);
    tokenRepository.updateToken(emailVerificationToken);
    registeredUser.setIsEmailVerified(true);
    userRepository.createOrUpdate(uriInfo, registeredUser);
  }

  public User recreateRegistrationToken(UriInfo uriInfo, String existingToken) throws IOException {
    EmailVerificationToken emailVerificationToken = (EmailVerificationToken) tokenRepository.findByToken(existingToken);
    User registeredUser = userRepository.get(uriInfo, emailVerificationToken.getUserId(), getFields("*"));
    if (registeredUser.getIsEmailVerified()) {
      // no need to do anything
      return registeredUser;
    }
    // Update token with new Expiry and Status
    emailVerificationToken.setTokenStatus(EmailVerificationToken.TokenStatus.STATUS_PENDING);
    emailVerificationToken.setExpiryDate(Instant.now().plus(7, ChronoUnit.DAYS).toEpochMilli());

    tokenRepository.updateToken(emailVerificationToken);
    return registeredUser;
  }

  public RefreshToken createRefreshTokenForLogin(UUID currentUserId) throws JsonProcessingException {
    // first delete the existing user mapping for the token
    // TODO: Currently one user will be mapped to one refreshToken , so essentially each user is assigned one
    // refreshToken
    // TODO: Future : Each user will have multiple Devices to login with, where each will have refresh token, i.e
    // refreshTokenPerDevice
    List<TokenInterface> refreshTokenListForUser =
        tokenRepository.findByUserIdAndType(currentUserId.toString(), TokenType.REFRESH_TOKEN.toString());
    // just delete the existing token
    if (refreshTokenListForUser != null && refreshTokenListForUser.size() > 0) {
      tokenRepository.deleteToken(refreshTokenListForUser.get(0).getToken().toString());
    }
    RefreshToken newRefreshToken = TokenUtil.getRefreshToken(currentUserId, UUID.randomUUID());
    // save Refresh Token in Database
    tokenRepository.insertToken(newRefreshToken);

    return newRefreshToken;
  }

  public void verifyPasswordResetTokenExpiry(PasswordResetToken token) throws IOException {
    if (token.getExpiryDate().compareTo(Instant.now().toEpochMilli()) < 0) {
      throw new RuntimeException(
          "Password Reset Token" + token.getToken() + "Expired token. Please issue a new request");
    }
    if (!token.getIsActive()) {
      throw new RuntimeException("Password Reset Token" + token.getToken() + "Token was marked inactive");
    }
  }

  private User getUserFromRegistrationRequest(RegistrationRequest create) {
    String username = create.getEmail().split("@")[0];
    String hashedPwd = BCrypt.withDefaults().hashToString(12, create.getPassword().toCharArray());

    BasicAuthMechanism newAuthMechanism = new BasicAuthMechanism().withPassword(hashedPwd);
    return new User()
        .withId(UUID.randomUUID())
        .withName(username)
        .withFullyQualifiedName(username)
        .withEmail(create.getEmail())
        .withDisplayName(create.getFirstName() + create.getLastName())
        .withIsBot(false)
        .withUpdatedBy(username)
        .withUpdatedAt(System.currentTimeMillis())
        .withIsEmailVerified(false)
        .withAuthenticationMechanism(
            new AuthenticationMechanism()
                .withAuthType(AuthenticationMechanism.AuthType.BASIC)
                .withConfig(newAuthMechanism));
  }

  public void validateEmailAlreadyExists(String email) {
    if (dao.checkEmailAlreadyExists(email)) {
      throw new RuntimeException("User with Email Already Exists");
    }
  }
}
