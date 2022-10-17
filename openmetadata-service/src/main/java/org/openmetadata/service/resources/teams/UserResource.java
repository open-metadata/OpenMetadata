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

package org.openmetadata.service.resources.teams;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.OK;
import static javax.ws.rs.core.Response.Status.UNAUTHORIZED;
import static org.openmetadata.schema.api.teams.CreateUser.CreatePasswordType.ADMINCREATE;
import static org.openmetadata.schema.auth.ChangePasswordRequest.RequestType.SELF;
import static org.openmetadata.schema.auth.TokenType.EMAIL_VERIFICATION;
import static org.openmetadata.schema.auth.TokenType.PASSWORD_RESET;
import static org.openmetadata.schema.auth.TokenType.REFRESH_TOKEN;
import static org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.BASIC;
import static org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT;
import static org.openmetadata.service.exception.CatalogExceptionMessage.EMAIL_SENDING_ISSUE;
import static org.openmetadata.service.exception.CatalogExceptionMessage.INVALID_USERNAME_PASSWORD;
import static org.openmetadata.service.exception.CatalogExceptionMessage.MAX_FAILED_LOGIN_ATTEMPT;

import at.favre.lib.crypto.bcrypt.BCrypt;
import com.fasterxml.jackson.core.JsonProcessingException;
import freemarker.template.TemplateException;
import io.dropwizard.jersey.PATCH;
import io.dropwizard.jersey.errors.ErrorMessage;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.json.JsonObject;
import javax.json.JsonPatch;
import javax.json.JsonValue;
import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.BadRequestException;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
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
import org.apache.commons.lang3.StringUtils;
import org.jetbrains.annotations.Nullable;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.ChangePasswordRequest;
import org.openmetadata.schema.auth.EmailRequest;
import org.openmetadata.schema.auth.EmailVerificationToken;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.auth.LogoutRequest;
import org.openmetadata.schema.auth.PasswordResetRequest;
import org.openmetadata.schema.auth.PasswordResetToken;
import org.openmetadata.schema.auth.RefreshToken;
import org.openmetadata.schema.auth.RegistrationRequest;
import org.openmetadata.schema.auth.TokenRefreshRequest;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.teams.authn.BasicAuthMechanism;
import org.openmetadata.schema.teams.authn.GenerateTokenRequest;
import org.openmetadata.schema.teams.authn.JWTAuthMechanism;
import org.openmetadata.schema.teams.authn.JWTTokenExpiry;
import org.openmetadata.schema.teams.authn.SSOAuthMechanism;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.LoginAttemptCache;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.saml.JwtTokenCacheManager;
import org.openmetadata.service.util.EmailUtil;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.PasswordUtil;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TokenUtil;

@Slf4j
@Path("/v1/users")
@Api(value = "User collection", tags = "User collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "users")
public class UserResource extends EntityResource<User, UserRepository> {
  public static final String COLLECTION_PATH = "v1/users/";
  public static final String USER_PROTECTED_FIELDS = "authenticationMechanism";
  private final JWTTokenGenerator jwtTokenGenerator;
  private final TokenRepository tokenRepository;
  private boolean isEmailServiceEnabled;
  private LoginAttemptCache loginAttemptCache;

  private AuthenticationConfiguration authenticationConfiguration;

  private AuthorizerConfiguration authorizerConfiguration;

  @Override
  public User addHref(UriInfo uriInfo, User user) {
    Entity.withHref(uriInfo, user.getTeams());
    Entity.withHref(uriInfo, user.getRoles());
    Entity.withHref(uriInfo, user.getInheritedRoles());
    Entity.withHref(uriInfo, user.getOwns());
    Entity.withHref(uriInfo, user.getFollows());
    return user;
  }

  public UserResource(CollectionDAO dao, Authorizer authorizer) {
    super(User.class, new UserRepository(dao), authorizer);
    jwtTokenGenerator = JWTTokenGenerator.getInstance();
    allowedFields.remove(USER_PROTECTED_FIELDS);
    tokenRepository = new TokenRepository(dao);
  }

  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    this.authenticationConfiguration = config.getAuthenticationConfiguration();
    this.authorizerConfiguration = config.getAuthorizerConfiguration();
    SmtpSettings smtpSettings = config.getSmtpSettings();
    this.isEmailServiceEnabled = smtpSettings != null && smtpSettings.getEnableSmtpServer();
    this.loginAttemptCache = new LoginAttemptCache(config);
  }

  public static class UserList extends ResultList<User> {
    @SuppressWarnings("unused") // Used for deserialization
    public UserList() {}

    public UserList(List<User> users, String beforeCursor, String afterCursor, int total) {
      super(users, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS = "profile,roles,teams,follows,owns";

  @GET
  @Valid
  @Operation(
      operationId = "listUsers",
      summary = "List users",
      tags = "users",
      description =
          "Get a list of users. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The user ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = UserList.class)))
      })
  public ResultList<User> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Filter users by team", schema = @Schema(type = "string", example = "Legal"))
          @QueryParam("team")
          String teamParam,
      @Parameter(description = "Limit the number users returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of users before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of users after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(description = "Returns list of admin users if set to true", schema = @Schema(type = "boolean"))
          @QueryParam("isAdmin")
          Boolean isAdmin,
      @Parameter(description = "Returns list of bot users if set to true", schema = @Schema(type = "boolean"))
          @QueryParam("isBot")
          Boolean isBot,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    ListFilter filter = new ListFilter(include).addQueryParam("team", teamParam);
    if (isAdmin != null) {
      filter.addQueryParam("isAdmin", String.valueOf(isAdmin));
    }
    if (isBot != null) {
      filter.addQueryParam("isBot", String.valueOf(isBot));
    }
    ResultList<User> users = listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
    users.getData().forEach(user -> decryptOrNullify(securityContext, user));
    return users;
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllUserVersion",
      summary = "List user versions",
      tags = "users",
      description = "Get a list of all the versions of a user identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of user versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "user Id", schema = @Schema(type = "string")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/generateRandomPwd")
  @Operation(
      operationId = "generateRandomPwd",
      summary = "generateRandomPwd",
      tags = "users",
      description = "Generate a random pwd",
      responses = {@ApiResponse(responseCode = "200", description = "Random pwd")})
  public Response generateRandomPassword(@Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    authorizer.authorizeAdmin(securityContext, false);
    return Response.status(OK).entity(PasswordUtil.generateRandomPassword()).build();
  }

  @GET
  @Valid
  @Path("/{id}")
  @Operation(
      operationId = "getUserByID",
      summary = "Get a user",
      tags = "users",
      description = "Get a user by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The user",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = User.class))),
        @ApiResponse(responseCode = "404", description = "User for instance {id} is not found")
      })
  public User get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    return decryptOrNullify(securityContext, getInternal(uriInfo, securityContext, id, fieldsParam, include));
  }

  @GET
  @Valid
  @Path("/name/{name}")
  @Operation(
      operationId = "getUserByFQN",
      summary = "Get a user by name",
      tags = "users",
      description = "Get a user by `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The user",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = User.class))),
        @ApiResponse(responseCode = "404", description = "User for instance {id} is not found")
      })
  public User getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("name") String name,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    return decryptOrNullify(securityContext, getByNameInternal(uriInfo, securityContext, name, fieldsParam, include));
  }

  @GET
  @Valid
  @Path("/loggedInUser")
  @Operation(
      operationId = "getCurrentLoggedInUser",
      summary = "Get current logged in user",
      tags = "users",
      description = "Get the user who is authenticated and is currently logged in.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The user",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = User.class))),
        @ApiResponse(responseCode = "404", description = "User not found")
      })
  public User getCurrentLoggedInUser(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam)
      throws IOException {
    Fields fields = getFields(fieldsParam);
    String currentUserName = securityContext.getUserPrincipal().getName();
    User user = dao.getByName(uriInfo, currentUserName, fields);
    return addHref(uriInfo, user);
  }

  @GET
  @Valid
  @Path("/loggedInUser/groupTeams")
  @Operation(
      operationId = "getCurrentLoggedInUserGroupTeams",
      summary = "Get group type of teams for current logged in user",
      tags = "users",
      description = "Get the group type of teams of user who is authenticated and is currently logged in.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The teams of type 'Group' that a user belongs to",
            content =
                @Content(
                    mediaType = "application/json",
                    array = @ArraySchema(schema = @Schema(implementation = EntityReference.class)))),
        @ApiResponse(responseCode = "404", description = "User not found")
      })
  public List<EntityReference> getCurrentLoggedInUser(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext) throws IOException {
    String currentUserName = securityContext.getUserPrincipal().getName();
    return dao.getGroupTeams(uriInfo, currentUserName);
  }

  @POST
  @Path("/logout")
  @Operation(
      operationId = "logoutUser",
      summary = "Logout a User(Only called for saml and basic Auth)",
      tags = "users",
      description = "Logout a User(Only called for saml and basic Auth)",
      responses = {
        @ApiResponse(responseCode = "200", description = "The user "),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response logoutUser(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid LogoutRequest request) {
    Date logoutTime = Date.from(LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant());
    JwtTokenCacheManager.getInstance()
        .markLogoutEventForToken(
            new LogoutRequest()
                .withUsername(securityContext.getUserPrincipal().getName())
                .withToken(request.getToken())
                .withLogoutTime(logoutTime));
    if (isBasicAuth() && request.getRefreshToken() != null) {
      // need to clear the refresh token as well
      tokenRepository.deleteToken(request.getRefreshToken());
    }
    return Response.status(200).entity("Logout Successful").build();
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificUserVersion",
      summary = "Get a version of the user",
      tags = "users",
      description = "Get a version of the user by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "user",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = User.class))),
        @ApiResponse(
            responseCode = "404",
            description = "User for instance {id} and version {version} is " + "not found")
      })
  public User getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "User Id", schema = @Schema(type = "string")) @PathParam("id") UUID id,
      @Parameter(
              description = "User version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createUser",
      summary = "Create a user",
      tags = "users",
      description = "Create a new user.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The user ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = User.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createUser(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateUser create) throws IOException {
    User user = getUser(securityContext, create);
    if (Boolean.TRUE.equals(create.getIsAdmin())) {
      authorizer.authorizeAdmin(securityContext, true);
    }
    if (Boolean.TRUE.equals(create.getIsBot())) {
      addAuthMechanismToBot(user, create, uriInfo);
    }
    // Basic Auth Related
    if (isBasicAuth()) {
      // basic auth doesn't allow duplicate emails
      try {
        validateEmailAlreadyExists(create.getEmail());
      } catch (RuntimeException ex) {
        return Response.status(CONFLICT)
            .type(MediaType.APPLICATION_JSON_TYPE)
            .entity(new ErrorMessage(CONFLICT.getStatusCode(), CatalogExceptionMessage.ENTITY_ALREADY_EXISTS))
            .build();
      }
      // this is also important since username is used for a lot of stuff
      user.setName(user.getEmail().split("@")[0]);
      if (Boolean.FALSE.equals(create.getIsBot()) && create.getCreatePasswordType() == ADMINCREATE) {
        addAuthMechanismToUser(user, create);
      }
      // else the user will get a mail if configured smtp
    }
    // TODO do we need to authenticate user is creating himself?
    addHref(uriInfo, dao.create(uriInfo, user));
    if (isBasicAuth() && isEmailServiceEnabled) {
      try {
        sendInviteMailToUser(
            uriInfo,
            user,
            String.format("Welcome to %s", EmailUtil.getInstance().getEmailingEntity()),
            create.getCreatePasswordType(),
            create.getPassword());
      } catch (Exception ex) {
        LOG.error("Error in sending invite to User" + ex.getMessage());
      }
    }
    Response response = Response.created(user.getHref()).entity(user).build();
    decryptOrNullify(securityContext, (User) response.getEntity());
    return response;
  }

  private boolean isBasicAuth() {
    return authenticationConfiguration.getProvider().equals(SSOAuthMechanism.SsoServiceType.BASIC.toString());
  }

  @PUT
  @Operation(
      summary = "Update user",
      tags = "users",
      description = "Create or Update a user.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The user ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = CreateUser.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdateUser(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateUser create) throws IOException {
    User user = getUser(securityContext, create);
    dao.prepare(user);
    if (Boolean.TRUE.equals(create.getIsAdmin()) || Boolean.TRUE.equals(create.getIsBot())) {
      authorizer.authorizeAdmin(securityContext, true);
    } else if (!securityContext.getUserPrincipal().getName().equals(user.getName())) {
      // doing authorization check outside of authorizer here. We are checking if the logged-in user same as the user
      // we are trying to update. One option is to set users.owner as user, however thats not supported User entity.
      OperationContext createOperationContext = new OperationContext(entityType, MetadataOperation.CREATE);
      ResourceContext resourceContext = getResourceContextByName(user.getName());
      authorizer.authorize(securityContext, createOperationContext, resourceContext, true);
    }
    if (Boolean.TRUE.equals(create.getIsBot())) {
      return createOrUpdateBot(user, create, uriInfo, securityContext);
    }
    RestUtil.PutResponse<User> response = dao.createOrUpdate(uriInfo, user);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @PUT
  @Path("/generateToken/{id}")
  @Operation(
      operationId = "generateJWTTokenForBotUser",
      summary = "Generate JWT Token for a Bot User",
      tags = "users",
      description = "Generate JWT Token for a Bot User.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The user ",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = JWTTokenExpiry.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response generateToken(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Valid GenerateTokenRequest generateTokenRequest)
      throws IOException {
    User user = dao.get(uriInfo, id, Fields.EMPTY_FIELDS);
    authorizeGenerateJWT(user);
    authorizer.authorizeAdmin(securityContext, false);
    JWTAuthMechanism jwtAuthMechanism =
        jwtTokenGenerator.generateJWTToken(user, generateTokenRequest.getJWTTokenExpiry());
    AuthenticationMechanism authenticationMechanism =
        new AuthenticationMechanism().withConfig(jwtAuthMechanism).withAuthType(AuthenticationMechanism.AuthType.JWT);
    user.setAuthenticationMechanism(authenticationMechanism);
    User updatedUser = dao.createOrUpdate(uriInfo, user).getEntity();
    jwtAuthMechanism =
        JsonUtils.convertValue(updatedUser.getAuthenticationMechanism().getConfig(), JWTAuthMechanism.class);
    return Response.status(Response.Status.OK).entity(jwtAuthMechanism).build();
  }

  @PUT
  @Path("/revokeToken/{id}")
  @Operation(
      operationId = "revokeJWTTokenForBotUser",
      summary = "Revoke JWT Token for a Bot User",
      tags = "users",
      description = "Revoke JWT Token for a Bot User.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The user ",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = JWTAuthMechanism.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response revokeToken(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @PathParam("id") UUID id) throws IOException {

    User user = dao.get(uriInfo, id, Fields.EMPTY_FIELDS);
    authorizeGenerateJWT(user);
    authorizer.authorizeAdmin(securityContext, false);
    JWTAuthMechanism jwtAuthMechanism = new JWTAuthMechanism().withJWTToken(StringUtils.EMPTY);
    AuthenticationMechanism authenticationMechanism =
        new AuthenticationMechanism().withConfig(jwtAuthMechanism).withAuthType(JWT);
    user.setAuthenticationMechanism(authenticationMechanism);
    RestUtil.PutResponse<User> response = dao.createOrUpdate(uriInfo, user);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @GET
  @Path("/token/{id}")
  @Operation(
      operationId = "getJWTTokenForBotUser",
      summary = "Get JWT Token for a Bot User",
      tags = "users",
      description = "Get JWT Token for a Bot User.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The user ",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = JWTAuthMechanism.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public JWTAuthMechanism getToken(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @PathParam("id") UUID id) throws IOException {

    User user = dao.get(uriInfo, id, new Fields(List.of("authenticationMechanism")));
    if (!Boolean.TRUE.equals(user.getIsBot())) {
      throw new IllegalArgumentException("JWT token is only supported for bot users");
    }
    decryptOrNullify(securityContext, user);
    authorizer.authorizeAdmin(securityContext, false);
    AuthenticationMechanism authenticationMechanism = user.getAuthenticationMechanism();
    if (authenticationMechanism != null
        && authenticationMechanism.getConfig() != null
        && authenticationMechanism.getAuthType() == JWT) {
      return JsonUtils.convertValue(authenticationMechanism.getConfig(), JWTAuthMechanism.class);
    }
    return new JWTAuthMechanism();
  }

  @GET
  @Path("/auth-mechanism/{id}")
  @Operation(
      operationId = "getAuthenticationMechanismBotUser",
      summary = "Get Authentication Mechanism for a Bot User",
      tags = "users",
      description = "Get Authentication Mechanism for a Bot User.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The user ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AuthenticationMechanism.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public AuthenticationMechanism getAuthenticationMechanism(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @PathParam("id") UUID id) throws IOException {

    User user = dao.get(uriInfo, id, new Fields(List.of("authenticationMechanism")));
    if (!Boolean.TRUE.equals(user.getIsBot())) {
      throw new IllegalArgumentException("JWT token is only supported for bot users");
    }
    decryptOrNullify(securityContext, user);
    authorizer.authorizeAdmin(securityContext, false);
    return user.getAuthenticationMechanism();
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(
      operationId = "patchUser",
      summary = "Update a user",
      tags = "users",
      description = "Update an existing user using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[" + "{op:remove, path:/a}," + "{op:add, path: /b, value: val}" + "]")
                      }))
          JsonPatch patch)
      throws IOException {
    for (JsonValue patchOp : patch.toJsonArray()) {
      JsonObject patchOpObject = patchOp.asJsonObject();
      if (patchOpObject.containsKey("path") && patchOpObject.containsKey("value")) {
        String path = patchOpObject.getString("path");
        if (path.equals("/isAdmin") || path.equals("/isBot")) {
          authorizer.authorizeAdmin(securityContext, true);
        }
        // if path contains team, check if team is joinable by any user
        if (patchOpObject.containsKey("op")
            && patchOpObject.getString("op").equals("add")
            && path.startsWith("/teams/")) {
          JsonObject value = null;
          try {
            value = patchOpObject.getJsonObject("value");
          } catch (Exception ex) {
            // ignore exception if value is not an object
          }
          if (value != null) {
            String teamId = value.getString("id");
            dao.validateTeamAddition(id, UUID.fromString(teamId));
            if (!dao.isTeamJoinable(teamId)) {
              // Only admin can join closed teams
              authorizer.authorizeAdmin(securityContext, false);
            }
          }
        }
      }
    }
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteUser",
      summary = "Delete a user",
      tags = "users",
      description = "Users can't be deleted but are soft-deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "User for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "User Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    Response response = delete(uriInfo, securityContext, id, false, hardDelete, true);
    decryptOrNullify(securityContext, (User) response.getEntity());
    return response;
  }

  @POST
  @Path("/signup")
  @Operation(
      operationId = "registerUser",
      summary = "Register User",
      tags = "users",
      description = "Register a new User",
      responses = {
        @ApiResponse(responseCode = "200", description = "The user "),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response registerNewUser(@Context UriInfo uriInfo, @Valid RegistrationRequest create) throws IOException {
    if (Boolean.TRUE.equals(authenticationConfiguration.getEnableSelfSignup())) {
      User registeredUser = registerUser(uriInfo, create);
      if (isEmailServiceEnabled) {
        try {
          sendEmailVerification(uriInfo, registeredUser);
        } catch (Exception e) {
          LOG.error("Error in sending mail to the User : {}", e.getMessage());
          return Response.status(424, EMAIL_SENDING_ISSUE).build();
        }
      }
      return Response.status(Response.Status.CREATED.getStatusCode(), "User Registration Successful.")
          .entity(registeredUser)
          .build();
    } else {
      return Response.status(Response.Status.BAD_REQUEST.getStatusCode(), "Signup is not available").build();
    }
  }

  @GET
  @Path("/registrationConfirmation")
  @Operation(
      operationId = "confirmUserEmail",
      summary = "Confirm User Email",
      tags = "users",
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
    return Response.status(Response.Status.OK).entity("Email Verified Successfully").build();
  }

  @GET
  @Path("/resendRegistrationToken")
  @Operation(
      operationId = "resendRegistrationToken",
      summary = "Resend Registration Token",
      tags = "users",
      description = "Resend Registration Token",
      responses = {
        @ApiResponse(responseCode = "200", description = "The user "),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response resendRegistrationToken(
      @Context UriInfo uriInfo,
      @Parameter(description = "Token sent for Email Confirmation Earlier", schema = @Schema(type = "string"))
          @QueryParam("user")
          String user)
      throws IOException {
    User registeredUser = dao.getByName(uriInfo, user, getFields("isEmailVerified"));
    if (Boolean.TRUE.equals(registeredUser.getIsEmailVerified())) {
      // no need to do anything
      return Response.status(Response.Status.OK).entity("Email Already Verified For User.").build();
    }
    tokenRepository.deleteTokenByUserAndType(registeredUser.getId().toString(), EMAIL_VERIFICATION.toString());
    if (isEmailServiceEnabled) {
      try {
        sendEmailVerification(uriInfo, registeredUser);
      } catch (Exception e) {
        LOG.error("Error in sending Email Verification mail to the User : {}", e.getMessage());
        return Response.status(424).entity(new ErrorMessage(424, EMAIL_SENDING_ISSUE)).build();
      }
    }
    return Response.status(Response.Status.OK)
        .entity("Email Verification Mail Sent. Please check your Mailbox.")
        .build();
  }

  @POST
  @Path("/generatePasswordResetLink")
  @Operation(
      operationId = "generatePasswordResetLink",
      summary = "Generate Password Reset Link",
      tags = "users",
      description = "Generate Password Reset Link",
      responses = {
        @ApiResponse(responseCode = "200", description = "The user "),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response generateResetPasswordLink(@Context UriInfo uriInfo, @Valid EmailRequest request) {
    String userName = request.getEmail().split("@")[0];
    User registeredUser;
    try {
      registeredUser =
          dao.getByName(uriInfo, userName, new Fields(List.of(USER_PROTECTED_FIELDS), USER_PROTECTED_FIELDS));
    } catch (IOException ex) {
      throw new BadRequestException("Email is not valid.");
    }
    // send a mail to the User with the Update
    if (isEmailServiceEnabled) {
      try {
        sendPasswordResetLink(
            uriInfo,
            registeredUser,
            EmailUtil.getInstance().getPasswordResetSubject(),
            EmailUtil.PASSWORD_RESET_TEMPLATE_FILE);
      } catch (Exception ex) {
        LOG.error("Error in sending mail for reset password" + ex.getMessage());
        return Response.status(424).entity(new ErrorMessage(424, EMAIL_SENDING_ISSUE)).build();
      }
    }
    return Response.status(Response.Status.OK).entity("Please check your mail to for Reset Password Link.").build();
  }

  @POST
  @Path("/password/reset")
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
    if (passwordResetToken == null) {
      throw new EntityNotFoundException("Invalid Password Request. Please issue a new request.");
    }
    List<String> fields = dao.getAllowedFieldsCopy();
    fields.add(USER_PROTECTED_FIELDS);
    User storedUser = dao.getByName(uriInfo, request.getUsername(), new Fields(fields, String.join(",", fields)));
    // token validity
    if (!passwordResetToken.getUserId().equals(storedUser.getId())) {
      throw new RuntimeException("Token does not belong to the user.");
    }
    verifyPasswordResetTokenExpiry(passwordResetToken);
    // passwords validity
    if (!request.getPassword().equals(request.getConfirmPassword())) {
      throw new RuntimeException("Password and Confirm Password should match");
    }
    PasswordUtil.validatePassword(request.getPassword());

    String newHashedPwd = BCrypt.withDefaults().hashToString(12, request.getPassword().toCharArray());
    BasicAuthMechanism newAuthForUser = new BasicAuthMechanism().withPassword(newHashedPwd);

    storedUser.setAuthenticationMechanism(new AuthenticationMechanism().withAuthType(BASIC).withConfig(newAuthForUser));

    // Don't want to return the entity just a 201 or 200 should do
    RestUtil.PutResponse<User> response = dao.createOrUpdate(uriInfo, storedUser);

    // delete the user's all password reset token as well , since already updated
    tokenRepository.deleteTokenByUserAndType(storedUser.getId().toString(), PASSWORD_RESET.toString());

    // Update user about Password Change
    if (isEmailServiceEnabled) {
      try {
        sendAccountStatus(storedUser, "Update Password", "Change Successful");
      } catch (Exception ex) {
        LOG.error("Error in sending Password Change Mail to User. Reason : " + ex.getMessage());
        return Response.status(424).entity(new ErrorMessage(424, EMAIL_SENDING_ISSUE)).build();
      }
    }
    loginAttemptCache.recordSuccessfulLogin(request.getUsername());
    return Response.status(response.getStatus()).entity("Password Changed Successfully").build();
  }

  @PUT
  @Path("/changePassword")
  @Operation(
      operationId = "changeUserPassword",
      summary = "Change Password For User",
      tags = "users",
      description = "Create a new user.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The user ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = User.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response changeUserPassword(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid ChangePasswordRequest request)
      throws IOException {
    // passwords validity
    if (!request.getNewPassword().equals(request.getConfirmPassword())) {
      throw new RuntimeException("Password and Confirm Password should match");
    }
    PasswordUtil.validatePassword(request.getNewPassword());
    List<String> fields = dao.getAllowedFieldsCopy();
    fields.add(USER_PROTECTED_FIELDS);
    if (request.getRequestType() == SELF) {
      User storedUser =
          dao.getByName(
              uriInfo, securityContext.getUserPrincipal().getName(), new Fields(fields, String.join(",", fields)));
      BasicAuthMechanism storedBasicAuthMechanism =
          JsonUtils.convertValue(storedUser.getAuthenticationMechanism().getConfig(), BasicAuthMechanism.class);
      String storedHashPassword = storedBasicAuthMechanism.getPassword();
      if (BCrypt.verifyer().verify(request.getOldPassword().toCharArray(), storedHashPassword).verified) {
        String newHashedPassword = BCrypt.withDefaults().hashToString(12, request.getNewPassword().toCharArray());
        storedBasicAuthMechanism.setPassword(newHashedPassword);
        storedUser.getAuthenticationMechanism().setConfig(storedBasicAuthMechanism);
        dao.createOrUpdate(uriInfo, storedUser);
        // it has to be 200 since we already fetched user , and we don't want to return any other data
        // remove login/details from cache
        loginAttemptCache.recordSuccessfulLogin(securityContext.getUserPrincipal().getName());
        return Response.status(200).entity("Password Updated Successfully").build();
      } else {
        return Response.status(403).entity(new ErrorMessage(403, "Old Password is not correct")).build();
      }
    } else {
      authorizer.authorizeAdmin(securityContext, false);
      User storedUser = dao.getByName(uriInfo, request.getUsername(), new Fields(fields, String.join(",", fields)));
      String newHashedPassword = BCrypt.withDefaults().hashToString(12, request.getNewPassword().toCharArray());
      // Admin is allowed to set password for User directly
      BasicAuthMechanism storedBasicAuthMechanism =
          JsonUtils.convertValue(storedUser.getAuthenticationMechanism().getConfig(), BasicAuthMechanism.class);
      storedBasicAuthMechanism.setPassword(newHashedPassword);
      storedUser.getAuthenticationMechanism().setConfig(storedBasicAuthMechanism);
      RestUtil.PutResponse<User> response = dao.createOrUpdate(uriInfo, storedUser);
      // remove login/details from cache
      loginAttemptCache.recordSuccessfulLogin(request.getUsername());
      if (isEmailServiceEnabled) {
        try {
          sendInviteMailToUser(
              uriInfo,
              response.getEntity(),
              String.format("%s: Password Update", EmailUtil.getInstance().getEmailingEntity()),
              ADMINCREATE,
              request.getNewPassword());
        } catch (Exception ex) {
          LOG.error("Error in sending invite to User" + ex.getMessage());
        }
      }
      return Response.status(response.getStatus()).entity("Password Updated Successfully").build();
    }
  }

  @POST
  @Path("/checkEmailInUse")
  @Operation(
      operationId = "checkEmailInUse",
      summary = "Check if a mail is already in use",
      tags = "users",
      description = "Check if a mail is already in use",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Return true or false",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Boolean.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response checkEmailInUse(@Valid EmailRequest request) {
    boolean emailExists = dao.checkEmailAlreadyExists(request.getEmail());
    return Response.status(Response.Status.OK).entity(emailExists).build();
  }

  @POST
  @Path("/checkEmailVerified")
  @Operation(
      operationId = "checkEmailIsVerified",
      summary = "Check if a mail is verified",
      tags = "users",
      description = "Check if a mail is already in use",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Return true or false",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Boolean.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response checkEmailVerified(@Context UriInfo uriInfo, @Valid EmailRequest request) throws IOException {
    User user = dao.getByName(uriInfo, request.getEmail().split("@")[0], getFields("isEmailVerified"));
    return Response.status(Response.Status.OK).entity(user.getIsEmailVerified()).build();
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
      throws IOException, TemplateException {
    String userName =
        loginRequest.getEmail().contains("@") ? loginRequest.getEmail().split("@")[0] : loginRequest.getEmail();

    if (!loginAttemptCache.isLoginBlocked(userName)) {
      User storedUser;
      try {
        storedUser =
            dao.getByName(uriInfo, userName, new Fields(List.of(USER_PROTECTED_FIELDS), USER_PROTECTED_FIELDS));
      } catch (Exception ex) {
        return Response.status(BAD_REQUEST)
            .entity(new ErrorMessage(BAD_REQUEST.getStatusCode(), INVALID_USERNAME_PASSWORD))
            .build();
      }

      if (storedUser != null && Boolean.TRUE.equals(storedUser.getIsBot())) {
        return Response.status(BAD_REQUEST)
            .entity(new ErrorMessage(BAD_REQUEST.getStatusCode(), INVALID_USERNAME_PASSWORD))
            .build();
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
        return Response.status(OK).entity(response).build();
      } else {
        loginAttemptCache.recordFailedLogin(userName);
        int failedLoginAttempt = loginAttemptCache.getUserFailedLoginCount(userName);
        if (failedLoginAttempt == 3) {
          // send a mail to the user
          sendAccountStatus(
              storedUser, "Multiple Failed Login Attempts.", "Login Blocked for 10 mins. Please change your password.");
        }
        return Response.status(UNAUTHORIZED)
            .entity(new ErrorMessage(UNAUTHORIZED.getStatusCode(), INVALID_USERNAME_PASSWORD))
            .build();
      }
    } else {
      return Response.status(BAD_REQUEST)
          .entity(new ErrorMessage(BAD_REQUEST.getStatusCode(), MAX_FAILED_LOGIN_ATTEMPT))
          .build();
    }
  }

  @POST
  @Path("/refresh")
  @Operation(
      operationId = "refreshToken",
      summary = "Provide access token to User with refresh token",
      tags = "users",
      description = "Provide access token to User with refresh token",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The user ",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = JWTTokenExpiry.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response refreshToken(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid TokenRefreshRequest refreshRequest)
      throws IOException {
    User storedUser = dao.getByName(uriInfo, securityContext.getUserPrincipal().getName(), getFields("*"));
    if (storedUser.getIsBot() != null && storedUser.getIsBot()) {
      throw new IllegalArgumentException("User are only allowed to login");
    }
    RefreshToken refreshToken = validateAndReturnNewRefresh(storedUser.getId(), refreshRequest);
    JWTAuthMechanism jwtAuthMechanism =
        jwtTokenGenerator.generateJWTToken(storedUser.getName(), storedUser.getEmail(), JWTTokenExpiry.OneHour, false);
    JwtResponse response = new JwtResponse();
    response.setTokenType("Bearer");
    response.setAccessToken(jwtAuthMechanism.getJWTToken());
    response.setRefreshToken(refreshToken.getToken().toString());
    response.setExpiryDuration(jwtAuthMechanism.getJWTTokenExpiresAt());
    return Response.status(Response.Status.OK).entity(response).build();
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
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
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
    Set<String> allowedDomains = authorizerConfiguration.getAllowedEmailRegistrationDomains();
    if (!allowedDomains.contains("all") && !allowedDomains.contains(emailDomain)) {
      LOG.error("Email with this Domain not allowed: " + newRegistrationRequestEmail);
      throw new BadRequestException("Email with the given domain is not allowed. Contact Administrator");
    }
    validateEmailAlreadyExists(newRegistrationRequestEmail);
    PasswordUtil.validatePassword(newRegistrationRequest.getPassword());
    LOG.info("Trying to register new user [" + newRegistrationRequestEmail + "]");
    User newUser = getUserFromRegistrationRequest(newRegistrationRequest);
    if (authorizerConfiguration.getAdminPrincipals().contains(userName)) {
      newUser.setIsAdmin(true);
    }
    // remove auth mechanism from the user
    User registeredUser = dao.create(uriInfo, newUser);
    registeredUser.setAuthenticationMechanism(null);
    return registeredUser;
  }

  public void confirmEmailRegistration(UriInfo uriInfo, String emailToken) throws IOException {
    EmailVerificationToken emailVerificationToken = (EmailVerificationToken) tokenRepository.findByToken(emailToken);
    if (emailVerificationToken == null) {
      throw new EntityNotFoundException("Invalid Token. Please issue a new Request");
    }
    User registeredUser = dao.get(uriInfo, emailVerificationToken.getUserId(), dao.getFieldsWithUserAuth("*"));
    if (Boolean.TRUE.equals(registeredUser.getIsEmailVerified())) {
      LOG.info("User [{}] already registered.", emailToken);
      return;
    }

    // verify Token Expiry
    if (emailVerificationToken.getExpiryDate().compareTo(Instant.now().toEpochMilli()) < 0) {
      throw new RuntimeException(
          String.format(
              "Email Verification Token %s is expired. Please issue a new request for email verification",
              emailVerificationToken.getToken()));
    }

    // Update the user
    registeredUser.setIsEmailVerified(true);
    dao.createOrUpdate(uriInfo, registeredUser);

    // deleting the entry for the token from the Database
    tokenRepository.deleteTokenByUserAndType(registeredUser.getId().toString(), EMAIL_VERIFICATION.toString());
  }

  private void sendEmailVerification(UriInfo uriInfo, User user) throws IOException, TemplateException {
    UUID mailVerificationToken = UUID.randomUUID();
    EmailVerificationToken emailVerificationToken =
        TokenUtil.getEmailVerificationToken(user.getId(), mailVerificationToken);

    LOG.info("Generated Email verification token [" + mailVerificationToken + "]");

    String emailVerificationLink =
        String.format(
            "%s://%s/users/registrationConfirmation?user=%s&token=%s",
            uriInfo.getRequestUri().getScheme(),
            uriInfo.getRequestUri().getHost(),
            user.getFullyQualifiedName(),
            mailVerificationToken);
    Map<String, String> templatePopulator = new HashMap<>();

    templatePopulator.put(EmailUtil.ENTITY, EmailUtil.getInstance().getEmailingEntity());
    templatePopulator.put(EmailUtil.SUPPORT_URL, EmailUtil.getInstance().getSupportUrl());
    templatePopulator.put(EmailUtil.USERNAME, user.getName());
    templatePopulator.put(EmailUtil.EMAIL_VERIFICATION_LINKKEY, emailVerificationLink);
    templatePopulator.put(EmailUtil.EXPIRATION_TIME_KEY, "24");
    EmailUtil.getInstance()
        .sendMail(
            EmailUtil.getInstance().getEmailVerificationSubject(),
            templatePopulator,
            user.getEmail(),
            EmailUtil.EMAIL_TEMPLATE_BASEPATH,
            EmailUtil.EMAIL_VERIFICATION_TEMPLATE_PATH);

    // insert the token
    tokenRepository.insertToken(emailVerificationToken);
  }

  private void sendAccountStatus(User user, String action, String status) throws IOException, TemplateException {
    Map<String, String> templatePopulator = new HashMap<>();
    templatePopulator.put(EmailUtil.ENTITY, EmailUtil.getInstance().getEmailingEntity());
    templatePopulator.put(EmailUtil.SUPPORT_URL, EmailUtil.getInstance().getSupportUrl());
    templatePopulator.put(EmailUtil.USERNAME, user.getName());
    templatePopulator.put(EmailUtil.ACTION_KEY, action);
    templatePopulator.put(EmailUtil.ACTION_STATUS_KEY, status);
    EmailUtil.getInstance()
        .sendMail(
            EmailUtil.getInstance().getAccountStatusChangeSubject(),
            templatePopulator,
            user.getEmail(),
            EmailUtil.EMAIL_TEMPLATE_BASEPATH,
            EmailUtil.ACCOUNT_STATUS_TEMPLATE_FILE);
  }

  private void sendPasswordResetLink(UriInfo uriInfo, User user, String subject, String templateFilePath)
      throws IOException, TemplateException {
    UUID mailVerificationToken = UUID.randomUUID();
    PasswordResetToken resetToken = TokenUtil.getPasswordResetToken(user.getId(), mailVerificationToken);

    LOG.info("Generated Password Reset verification token [" + mailVerificationToken + "]");

    String passwordResetLink =
        String.format(
            "%s://%s/users/password/reset?user=%s&token=%s",
            uriInfo.getRequestUri().getScheme(),
            uriInfo.getRequestUri().getHost(),
            user.getFullyQualifiedName(),
            mailVerificationToken);
    Map<String, String> templatePopulator = new HashMap<>();
    templatePopulator.put(EmailUtil.ENTITY, EmailUtil.getInstance().getEmailingEntity());
    templatePopulator.put(EmailUtil.SUPPORT_URL, EmailUtil.getInstance().getSupportUrl());
    templatePopulator.put(EmailUtil.USERNAME, user.getName());
    templatePopulator.put(EmailUtil.PASSWORD_RESET_LINKKEY, passwordResetLink);
    templatePopulator.put(EmailUtil.EXPIRATION_TIME_KEY, EmailUtil.DEFAULT_EXPIRATION_TIME);

    EmailUtil.getInstance()
        .sendMail(subject, templatePopulator, user.getEmail(), EmailUtil.EMAIL_TEMPLATE_BASEPATH, templateFilePath);
    // don't persist tokens delete existing
    tokenRepository.deleteTokenByUserAndType(user.getId().toString(), PASSWORD_RESET.toString());
    tokenRepository.insertToken(resetToken);
  }

  private void sendInviteMailToUser(
      UriInfo uriInfo, User user, String subject, CreateUser.CreatePasswordType requestType, String pwd)
      throws TemplateException, IOException {
    switch (requestType) {
      case ADMINCREATE:
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
        } catch (Exception ex) {
          LOG.error("Failed in sending Mail to user [{}]. Reason : {}", user.getEmail(), ex.getMessage());
        }
        break;
      case USERCREATE:
        sendPasswordResetLink(uriInfo, user, subject, EmailUtil.INVITE_CREATE_PWD);
        break;
      default:
        LOG.error("Invalid Password Create Type");
    }
  }

  public RefreshToken createRefreshTokenForLogin(UUID currentUserId) throws JsonProcessingException {
    // first delete the existing user mapping for the token
    // TODO: Currently one user will be mapped to one refreshToken , so essentially each user is assigned one
    // refreshToken
    // TODO: Future : Each user will have multiple Devices to login with, where each will have refresh token, i.e per
    // devie
    // just delete the existing token
    tokenRepository.deleteTokenByUserAndType(currentUserId.toString(), REFRESH_TOKEN.toString());
    RefreshToken newRefreshToken = TokenUtil.getRefreshToken(currentUserId, UUID.randomUUID());
    // save Refresh Token in Database
    tokenRepository.insertToken(newRefreshToken);

    return newRefreshToken;
  }

  public void verifyPasswordResetTokenExpiry(PasswordResetToken token) {
    if (token.getExpiryDate().compareTo(Instant.now().toEpochMilli()) < 0) {
      throw new RuntimeException(
          "Password Reset Token" + token.getToken() + "Expired token. Please issue a new request");
    }
    if (Boolean.FALSE.equals(token.getIsActive())) {
      throw new RuntimeException("Password Reset Token" + token.getToken() + "Token was marked inactive");
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
    tokenRepository.deleteTokenByUserAndType(currentUserId.toString(), REFRESH_TOKEN.toString());
    // we use rotating refresh token , generate new token
    RefreshToken newRefreshToken = TokenUtil.getRefreshToken(currentUserId, UUID.randomUUID());
    // save Refresh Token in Database
    tokenRepository.insertToken(newRefreshToken);
    return newRefreshToken;
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

  private Response createOrUpdateBot(User user, CreateUser create, UriInfo uriInfo, SecurityContext securityContext)
      throws IOException {
    User original = retrieveBotUser(user, uriInfo);
    String botName = create.getBotName();
    EntityInterface bot = retrieveBot(botName);
    // check if the bot user exists
    if (!botHasRelationshipWithUser(bot, original)
        && original != null
        && userHasRelationshipWithAnyBot(original, bot)) {
      // throw an exception if user already has a relationship with a bot
      List<CollectionDAO.EntityRelationshipRecord> userBotRelationship = retrieveBotRelationshipsFor(original);
      bot =
          Entity.getEntityRepository(Entity.BOT)
              .get(null, userBotRelationship.stream().findFirst().orElseThrow().getId(), Fields.EMPTY_FIELDS);
      throw new IllegalArgumentException(
          String.format("Bot user [%s] is already used by [%s] bot.", user.getName(), bot.getName()));
    }
    addAuthMechanismToBot(user, create, uriInfo);
    RestUtil.PutResponse<User> response = dao.createOrUpdate(uriInfo, user);
    decryptOrNullify(securityContext, response.getEntity());
    return response.toResponse();
  }

  private EntityInterface retrieveBot(String botName) {
    try {
      return Entity.getEntityRepository(Entity.BOT).getByName(null, botName, Fields.EMPTY_FIELDS);
    } catch (Exception e) {
      return null;
    }
  }

  private boolean userHasRelationshipWithAnyBot(User user, EntityInterface botUser) {
    List<CollectionDAO.EntityRelationshipRecord> userBotRelationship = retrieveBotRelationshipsFor(user);
    return !userBotRelationship.isEmpty()
        && (botUser == null
            || (userBotRelationship.stream().anyMatch(relationship -> !relationship.getId().equals(botUser.getId()))));
  }

  private List<CollectionDAO.EntityRelationshipRecord> retrieveBotRelationshipsFor(User user) {
    return dao.findFrom(user.getId(), Entity.USER, Relationship.CONTAINS, Entity.BOT);
  }

  private boolean botHasRelationshipWithUser(EntityInterface bot, User user) {
    if (bot == null || user == null) {
      return false;
    }
    List<CollectionDAO.EntityRelationshipRecord> botUserRelationships = retrieveBotRelationshipsFor(bot);
    return !botUserRelationships.isEmpty() && botUserRelationships.get(0).getId().equals(user.getId());
  }

  private List<CollectionDAO.EntityRelationshipRecord> retrieveBotRelationshipsFor(EntityInterface bot) {
    return dao.findTo(bot.getId(), Entity.BOT, Relationship.CONTAINS, Entity.USER);
  }

  private void addAuthMechanismToBot(User user, @Valid CreateUser create, UriInfo uriInfo) {
    if (!Boolean.TRUE.equals(user.getIsBot())) {
      throw new IllegalArgumentException("Authentication mechanism change is only supported for bot users");
    }
    if (isValidAuthenticationMechanism(create)) {
      AuthenticationMechanism authMechanism = create.getAuthenticationMechanism();
      AuthenticationMechanism.AuthType authType = authMechanism.getAuthType();
      SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
      switch (authType) {
        case JWT:
          User original = retrieveBotUser(user, uriInfo);
          if (original != null && !secretsManager.isLocal() && authMechanism.getConfig() != null) {
            original
                .getAuthenticationMechanism()
                .setConfig(
                    secretsManager.encryptOrDecryptBotUserCredentials(
                        user.getName(), authMechanism.getConfig(), false));
          }
          if (original == null || !hasAJWTAuthMechanism(original.getAuthenticationMechanism())) {
            JWTAuthMechanism jwtAuthMechanism =
                JsonUtils.convertValue(authMechanism.getConfig(), JWTAuthMechanism.class);
            authMechanism.setConfig(jwtTokenGenerator.generateJWTToken(user, jwtAuthMechanism.getJWTTokenExpiry()));
          } else {
            authMechanism = original.getAuthenticationMechanism();
          }
          break;
        case SSO:
          SSOAuthMechanism ssoAuthMechanism = JsonUtils.convertValue(authMechanism.getConfig(), SSOAuthMechanism.class);
          authMechanism.setConfig(ssoAuthMechanism);
          break;
        default:
          throw new IllegalArgumentException(
              String.format("Not supported authentication mechanism type: [%s]", authType.value()));
      }
      user.setAuthenticationMechanism(authMechanism);
    } else {
      throw new IllegalArgumentException(
          String.format("Authentication mechanism is empty bot user: [%s]", user.getName()));
    }
  }

  @Nullable
  private User retrieveBotUser(User user, UriInfo uriInfo) {
    User original;
    try {
      original = dao.getByName(uriInfo, user.getFullyQualifiedName(), new Fields(List.of("authenticationMechanism")));
    } catch (EntityNotFoundException | IOException exc) {
      LOG.debug(String.format("User not found when adding auth mechanism for: [%s]", user.getName()));
      original = null;
    }
    return original;
  }

  private void addAuthMechanismToUser(User user, @Valid CreateUser create) {
    if (!create.getPassword().equals(create.getConfirmPassword())) {
      throw new IllegalArgumentException("Password and Confirm Password should be same.");
    }
    PasswordUtil.validatePassword(create.getPassword());
    String newHashedPwd = BCrypt.withDefaults().hashToString(12, create.getPassword().toCharArray());
    BasicAuthMechanism newAuthForUser = new BasicAuthMechanism().withPassword(newHashedPwd);
    user.setAuthenticationMechanism(new AuthenticationMechanism().withAuthType(BASIC).withConfig(newAuthForUser));
  }

  private boolean hasAJWTAuthMechanism(AuthenticationMechanism authMechanism) {
    if (authMechanism != null && JWT.equals(authMechanism.getAuthType())) {
      JWTAuthMechanism jwtAuthMechanism = JsonUtils.convertValue(authMechanism.getConfig(), JWTAuthMechanism.class);
      return jwtAuthMechanism != null
          && jwtAuthMechanism.getJWTToken() != null
          && !StringUtils.EMPTY.equals(jwtAuthMechanism.getJWTToken());
    }
    return false;
  }

  private boolean isValidAuthenticationMechanism(CreateUser create) {
    if (create.getAuthenticationMechanism() == null) {
      return false;
    }
    if (create.getAuthenticationMechanism().getConfig() != null
        && create.getAuthenticationMechanism().getAuthType() != null) {
      return true;
    }
    throw new IllegalArgumentException(
        String.format("Incomplete authentication mechanism parameters for bot user: [%s]", create.getName()));
  }

  private User decryptOrNullify(SecurityContext securityContext, User user) {
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    if (Boolean.TRUE.equals(user.getIsBot()) && user.getAuthenticationMechanism() != null) {
      try {
        authorizer.authorize(
            securityContext,
            new OperationContext(entityType, MetadataOperation.VIEW_ALL),
            getResourceContextById(user.getId()),
            secretsManager.isLocal());
      } catch (AuthorizationException | IOException e) {
        user.getAuthenticationMechanism().setConfig(null);
        return user;
      }
      user.getAuthenticationMechanism()
          .setConfig(
              secretsManager.encryptOrDecryptBotUserCredentials(
                  user.getName(), user.getAuthenticationMechanism().getConfig(), false));
      return user;
    }
    return user;
  }
}
