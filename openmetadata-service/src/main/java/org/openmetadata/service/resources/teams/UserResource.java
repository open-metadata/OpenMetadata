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
import static org.openmetadata.schema.api.teams.CreateUser.CreatePasswordType.ADMIN_CREATE;
import static org.openmetadata.schema.auth.ChangePasswordRequest.RequestType.SELF;
import static org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.BASIC;
import static org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT;
import static org.openmetadata.service.exception.CatalogExceptionMessage.EMAIL_SENDING_ISSUE;
import static org.openmetadata.service.security.jwt.JWTTokenGenerator.getExpiryDate;

import at.favre.lib.crypto.bcrypt.BCrypt;
import freemarker.template.TemplateException;
import io.dropwizard.jersey.PATCH;
import io.dropwizard.jersey.errors.ErrorMessage;
import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
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
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.TokenInterface;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.BasicAuthMechanism;
import org.openmetadata.schema.auth.ChangePasswordRequest;
import org.openmetadata.schema.auth.CreatePersonalToken;
import org.openmetadata.schema.auth.EmailRequest;
import org.openmetadata.schema.auth.GenerateTokenRequest;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.auth.LogoutRequest;
import org.openmetadata.schema.auth.PasswordResetRequest;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.auth.RegistrationRequest;
import org.openmetadata.schema.auth.RevokePersonalTokenRequest;
import org.openmetadata.schema.auth.RevokeTokenRequest;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.auth.TokenRefreshRequest;
import org.openmetadata.schema.auth.TokenType;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.jdbi3.UserRepository.UserCsv;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.AuthenticatorHandler;
import org.openmetadata.service.security.auth.BotTokenCache;
import org.openmetadata.service.security.auth.UserTokenCache;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.security.saml.JwtTokenCacheManager;
import org.openmetadata.service.util.EmailUtil;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.PasswordUtil;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TokenUtil;
import org.openmetadata.service.util.UserUtil;

@Slf4j
@Path("/v1/users")
@Tag(
    name = "Users",
    description =
        "A `User` represents a user of OpenMetadata. A user can be part of 0 or more teams. A special type of user called Bot is used for automation. A user can be an owner of zero or more data assets. A user can also follow zero or more data assets.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "users", order = 3) // Initialize user resource before bot resource (at default order 9)
public class UserResource extends EntityResource<User, UserRepository> {
  public static final String COLLECTION_PATH = "v1/users/";
  public static final String USER_PROTECTED_FIELDS = "authenticationMechanism";
  private final JWTTokenGenerator jwtTokenGenerator;
  private final TokenRepository tokenRepository;
  private boolean isEmailServiceEnabled;
  private AuthenticationConfiguration authenticationConfiguration;
  private final AuthenticatorHandler authHandler;

  @Override
  public User addHref(UriInfo uriInfo, User user) {
    Entity.withHref(uriInfo, user.getTeams());
    Entity.withHref(uriInfo, user.getRoles());
    Entity.withHref(uriInfo, user.getInheritedRoles());
    Entity.withHref(uriInfo, user.getOwns());
    Entity.withHref(uriInfo, user.getFollows());
    return user;
  }

  public UserResource(CollectionDAO dao, Authorizer authorizer, AuthenticatorHandler authenticatorHandler) {
    super(User.class, new UserRepository(dao), authorizer);
    jwtTokenGenerator = JWTTokenGenerator.getInstance();
    allowedFields.remove(USER_PROTECTED_FIELDS);
    tokenRepository = new TokenRepository(dao);
    UserTokenCache.initialize(dao);
    authHandler = authenticatorHandler;
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) {
    this.authenticationConfiguration = config.getAuthenticationConfiguration();
    SmtpSettings smtpSettings = config.getSmtpSettings();
    this.isEmailServiceEnabled = smtpSettings != null && smtpSettings.getEnableSmtpServer();
    // Keep this before initializeUsers, else getUpdater() will fail
    SubjectCache.initialize();
    this.dao.initializeUsers(config);
  }

  public static class UserList extends ResultList<User> {
    @SuppressWarnings("unused") // Used for deserialization
    public UserList() {}
  }

  public static class PersonalAccessTokenList extends ResultList<PersonalAccessToken> {
    @SuppressWarnings("unused") // Used for deserialization
    public PersonalAccessTokenList() {}
  }

  static final String FIELDS = "profile,roles,teams,follows,owns";

  @GET
  @Valid
  @Operation(
      operationId = "listUsers",
      summary = "List users",
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
      @Parameter(description = "Id of the user", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/generateRandomPwd")
  @Operation(
      operationId = "generateRandomPwd",
      summary = "Generate a random password",
      description = "Generate a random password",
      responses = {@ApiResponse(responseCode = "200", description = "Random pwd")})
  public Response generateRandomPassword(@Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    authorizer.authorizeAdmin(securityContext);
    return Response.status(OK).entity(PasswordUtil.generateRandomPassword()).build();
  }

  @GET
  @Valid
  @Path("/{id}")
  @Operation(
      operationId = "getUserByID",
      summary = "Get a user",
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
      @Parameter(description = "Id of the user", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
    User user = getInternal(uriInfo, securityContext, id, fieldsParam, include);
    decryptOrNullify(securityContext, user);
    return user;
  }

  @GET
  @Valid
  @Path("/name/{name}")
  @Operation(
      operationId = "getUserByFQN",
      summary = "Get a user by name",
      description = "Get a user by `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The user",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = User.class))),
        @ApiResponse(responseCode = "404", description = "User for instance {name} is not found")
      })
  public User getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the user", schema = @Schema(type = "string")) @PathParam("name") String name,
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
    User user = getByNameInternal(uriInfo, securityContext, EntityInterfaceUtil.quoteName(name), fieldsParam, include);
    decryptOrNullify(securityContext, user);
    return user;
  }

  @GET
  @Valid
  @Path("/loggedInUser")
  @Operation(
      operationId = "getCurrentLoggedInUser",
      summary = "Get current logged in user",
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
      @Parameter(description = "Id of the user", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
      authorizer.authorizeAdmin(securityContext);
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
      if (Boolean.FALSE.equals(create.getIsBot()) && create.getCreatePasswordType() == ADMIN_CREATE) {
        addAuthMechanismToUser(user, create);
      }
      // else the user will get a mail if configured smtp
    }
    // TODO do we need to authenticate user is creating himself?
    addHref(uriInfo, dao.create(uriInfo, user));
    if (isBasicAuth() && isEmailServiceEnabled) {
      try {
        authHandler.sendInviteMailToUser(
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

    // If entity does not exist, this is a create operation, else update operation
    ResourceContext resourceContext = getResourceContextByName(user.getFullyQualifiedName());

    dao.prepareInternal(user);
    if (Boolean.TRUE.equals(create.getIsAdmin()) || Boolean.TRUE.equals(create.getIsBot())) {
      authorizer.authorizeAdmin(securityContext);
    } else if (!securityContext.getUserPrincipal().getName().equals(user.getName())) {
      // doing authorization check outside of authorizer here. We are checking if the logged-in user same as the user
      // we are trying to update. One option is to set users.owner as user, however that is not supported for User.
      OperationContext createOperationContext =
          new OperationContext(entityType, EntityUtil.createOrUpdateOperation(resourceContext));
      authorizer.authorize(securityContext, createOperationContext, resourceContext);
    }
    if (Boolean.TRUE.equals(create.getIsBot())) { // TODO expect bot to be created separately
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
      @Parameter(description = "Id of the user", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Valid GenerateTokenRequest generateTokenRequest)
      throws IOException {
    authorizer.authorizeAdmin(securityContext);
    User user = dao.get(uriInfo, id, dao.getFieldsWithUserAuth("*"));
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
  @Path("/revokeToken")
  @Operation(
      operationId = "revokeJWTTokenForBotUser",
      summary = "Revoke JWT Token for a Bot User",
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
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RevokeTokenRequest revokeTokenRequest)
      throws IOException {
    authorizer.authorizeAdmin(securityContext);
    User user = dao.get(uriInfo, revokeTokenRequest.getId(), dao.getFieldsWithUserAuth("*"));
    if (!user.getIsBot()) {
      throw new IllegalStateException(CatalogExceptionMessage.INVALID_BOT_USER);
    }
    JWTAuthMechanism jwtAuthMechanism = new JWTAuthMechanism().withJWTToken(StringUtils.EMPTY);
    AuthenticationMechanism authenticationMechanism =
        new AuthenticationMechanism().withConfig(jwtAuthMechanism).withAuthType(JWT);
    user.setAuthenticationMechanism(authenticationMechanism);
    RestUtil.PutResponse<User> response = dao.createOrUpdate(uriInfo, user);
    addHref(uriInfo, response.getEntity());
    // Invalidate Bot Token in Cache
    BotTokenCache.getInstance().invalidateToken(user.getName());
    return response.toResponse();
  }

  @GET
  @Path("/token/{id}")
  @Operation(
      operationId = "getJWTTokenForBotUser",
      summary = "Get JWT Token for a Bot User",
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
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the user", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {

    User user = dao.get(uriInfo, id, new Fields(List.of("authenticationMechanism")));
    if (!Boolean.TRUE.equals(user.getIsBot())) {
      throw new IllegalArgumentException("JWT token is only supported for bot users");
    }
    decryptOrNullify(securityContext, user);
    authorizer.authorizeAdmin(securityContext);
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
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the user", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {

    User user = dao.get(uriInfo, id, new Fields(List.of("authenticationMechanism")));
    if (!Boolean.TRUE.equals(user.getIsBot())) {
      throw new IllegalArgumentException("JWT token is only supported for bot users");
    }
    decryptOrNullify(securityContext, user);
    authorizer.authorizeAdmin(securityContext);
    return user.getAuthenticationMechanism();
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(
      operationId = "patchUser",
      summary = "Update a user",
      description = "Update an existing user using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the user", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
          authorizer.authorizeAdmin(securityContext);
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
              authorizer.authorizeAdmin(securityContext);
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
      @Parameter(description = "Id of the user", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    Response response = delete(uriInfo, securityContext, id, false, hardDelete);
    decryptOrNullify(securityContext, (User) response.getEntity());
    return response;
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteUserByName",
      summary = "Delete a user",
      description = "Users can't be deleted but are soft-deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "User for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the user", schema = @Schema(type = "string")) @PathParam("name") String name)
      throws IOException {
    return deleteByName(uriInfo, securityContext, EntityInterfaceUtil.quoteName(name), false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted User.",
      description = "Restore a soft deleted User.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the User ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = User.class)))
      })
  public Response restoreTable(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @POST
  @Path("/signup")
  @Operation(
      operationId = "registerUser",
      summary = "Register User",
      description = "Register a new User",
      responses = {
        @ApiResponse(responseCode = "200", description = "The user "),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response registerNewUser(@Context UriInfo uriInfo, @Valid RegistrationRequest create) throws IOException {
    User registeredUser = authHandler.registerUser(create);
    authHandler.sendEmailVerification(uriInfo, registeredUser);
    return Response.status(Response.Status.CREATED.getStatusCode(), "User Registration Successful.")
        .entity(registeredUser)
        .build();
  }

  @PUT
  @Path("/registrationConfirmation")
  @Operation(
      operationId = "confirmUserEmail",
      summary = "Confirm User Email",
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
    authHandler.confirmEmailRegistration(uriInfo, token);
    return Response.status(Response.Status.OK).entity("Email Verified Successfully").build();
  }

  @PUT
  @Path("/resendRegistrationToken")
  @Operation(
      operationId = "resendRegistrationToken",
      summary = "Resend Registration Token",
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
      return Response.status(Response.Status.OK).entity("Email Already Verified.").build();
    }
    authHandler.resendRegistrationToken(uriInfo, registeredUser);
    return Response.status(Response.Status.OK)
        .entity("Email Verification Mail Sent. Please check your Mailbox.")
        .build();
  }

  @POST
  @Path("/generatePasswordResetLink")
  @Operation(
      operationId = "generatePasswordResetLink",
      summary = "Generate Password Reset Link",
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
    try {
      // send a mail to the User with the Update
      authHandler.sendPasswordResetLink(
          uriInfo,
          registeredUser,
          EmailUtil.getInstance().getPasswordResetSubject(),
          EmailUtil.PASSWORD_RESET_TEMPLATE_FILE);
    } catch (Exception ex) {
      LOG.error("Error in sending mail for reset password" + ex.getMessage());
      return Response.status(424).entity(new ErrorMessage(424, EMAIL_SENDING_ISSUE)).build();
    }
    return Response.status(Response.Status.OK).entity("Please check your mail to for Reset Password Link.").build();
  }

  @POST
  @Path("/password/reset")
  @Operation(
      operationId = "resetUserPassword",
      summary = "Reset Password For User",
      description = "Reset User Password",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The user ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = User.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response resetUserPassword(@Context UriInfo uriInfo, @Valid PasswordResetRequest request) throws IOException {
    authHandler.resetUserPasswordWithToken(uriInfo, request);
    return Response.status(200).entity("Password Changed Successfully").build();
  }

  @PUT
  @Path("/changePassword")
  @Operation(
      operationId = "changeUserPassword",
      summary = "Change Password For User",
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
    if (request.getRequestType() == SELF) {
      authHandler.changeUserPwdWithOldPwd(uriInfo, securityContext.getUserPrincipal().getName(), request);
    } else {
      authorizer.authorizeAdmin(securityContext);
      authHandler.changeUserPwdWithOldPwd(uriInfo, request.getUsername(), request);
    }
    return Response.status(OK).entity("Password Updated Successfully").build();
  }

  @POST
  @Path("/checkEmailInUse")
  @Operation(
      operationId = "checkEmailInUse",
      summary = "Check if a mail is already in use",
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
      summary = "Login User with email (plain-text) and Password (encoded in base 64)",
      description = "Login User with email(plain-text) and Password (encoded in base 64)",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Returns the Jwt Token Response ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = JwtResponse.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response loginUserWithPassword(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid LoginRequest loginRequest)
      throws IOException, TemplateException {
    byte[] decodedBytes;
    try {
      decodedBytes = Base64.getDecoder().decode(loginRequest.getPassword());
    } catch (Exception ex) {
      throw new IllegalArgumentException("Password need to be encoded in Base-64.");
    }
    loginRequest.withPassword(new String(decodedBytes));
    return Response.status(Response.Status.OK).entity(authHandler.loginUser(loginRequest)).build();
  }

  @POST
  @Path("/refresh")
  @Operation(
      operationId = "refreshToken",
      summary = "Provide access token to User with refresh token",
      description = "Provide access token to User with refresh token",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The user ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = JwtResponse.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response refreshToken(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid TokenRefreshRequest refreshRequest)
      throws IOException {
    return Response.status(Response.Status.OK).entity(authHandler.getNewAccessToken(refreshRequest)).build();
  }

  @GET
  @Path("/security/token")
  @Operation(
      operationId = "getPersonalAccessToken",
      summary = "Get personal access token to User",
      description = "Get a personal access token",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List Of Personal Access Tokens ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PersonalAccessTokenList.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response getPersonalAccessToken(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "User Name of the User for which to get. (Default = `false`)") @QueryParam("username")
          String userName)
      throws IOException {
    if (userName != null) {
      authorizer.authorizeAdmin(securityContext);
    } else {
      userName = securityContext.getUserPrincipal().getName();
    }
    User user = dao.getByName(null, userName, getFields("id"), Include.NON_DELETED);
    List<TokenInterface> tokens =
        tokenRepository.findByUserIdAndType(user.getId().toString(), TokenType.PERSONAL_ACCESS_TOKEN.value());
    return Response.status(Response.Status.OK).entity(new ResultList<>(tokens)).build();
  }

  @PUT
  @Path("/security/token/revoke")
  @Operation(
      operationId = "revokePersonalAccessToken",
      summary = "Revoke personal access token to User",
      description = "Revoke personal access token",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Personal access token ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PersonalAccessTokenList.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response revokePersonalAccessToken(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Username in case admin is revoking. (Default = `false`)") @QueryParam("username")
          String userName,
      @Parameter(description = "Remove All tokens of the user. (Default = `false`)")
          @QueryParam("removeAll")
          @DefaultValue("false")
          boolean removeAll,
      @Valid RevokePersonalTokenRequest request)
      throws IOException {
    if (!CommonUtil.nullOrEmpty(userName)) {
      authorizer.authorizeAdmin(securityContext);
    } else {
      userName = securityContext.getUserPrincipal().getName();
    }
    User user = dao.getByName(null, userName, getFields("id"), Include.NON_DELETED);
    if (removeAll) {
      tokenRepository.deleteTokenByUserAndType(user.getId().toString(), TokenType.PERSONAL_ACCESS_TOKEN.value());
    } else {
      List<String> ids = request.getTokenIds().stream().map(UUID::toString).collect(Collectors.toList());
      tokenRepository.deleteAllToken(ids);
    }
    UserTokenCache.getInstance().invalidateToken(user.getName());
    List<TokenInterface> tokens =
        tokenRepository.findByUserIdAndType(user.getId().toString(), TokenType.PERSONAL_ACCESS_TOKEN.value());
    return Response.status(Response.Status.OK).entity(new ResultList<>(tokens)).build();
  }

  @PUT
  @Path("/security/token")
  @Operation(
      operationId = "createPersonalAccessToken",
      summary = "Provide access token to User",
      description = "Provide access token to User",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The user ",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = PersonalAccessToken.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createAccessToken(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreatePersonalToken tokenRequest)
      throws IOException {
    String userName = securityContext.getUserPrincipal().getName();
    User user = dao.getByName(null, userName, getFields("email,isBot"), Include.NON_DELETED);
    if (!user.getIsBot()) {
      // Create Personal Access Token
      JWTAuthMechanism authMechanism =
          JWTTokenGenerator.getInstance()
              .getJwtAuthMechanism(
                  userName,
                  user.getEmail(),
                  false,
                  ServiceTokenType.PERSONAL_ACCESS,
                  getExpiryDate(tokenRequest.getJWTTokenExpiry()),
                  null);
      PersonalAccessToken personalAccessToken = TokenUtil.getPersonalAccessToken(tokenRequest, user, authMechanism);
      tokenRepository.insertToken(personalAccessToken);
      return Response.status(Response.Status.OK).entity(personalAccessToken).build();
    }
    throw new CustomExceptionMessage(BAD_REQUEST, "Bots cannot have a Personal Access Token.");
  }

  @GET
  @Path("/documentation/csv")
  @Valid
  @Operation(operationId = "getCsvDocumentation", summary = "Get CSV documentation for user import/export")
  public String getUserCsvDocumentation(@Context SecurityContext securityContext, @PathParam("name") String name)
      throws IOException {
    return JsonUtils.pojoToJson(UserCsv.DOCUMENTATION);
  }

  @GET
  @Path("/export")
  @Produces(MediaType.TEXT_PLAIN)
  @Valid
  @Operation(
      operationId = "exportUsers",
      summary = "Export users in a team in CSV format",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Exported csv with user information",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = String.class)))
      })
  public String exportUsersCsv(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Name of the team to under which the users are imported to",
              required = true,
              schema = @Schema(type = "string"))
          @QueryParam("team")
          String team)
      throws IOException {
    return exportCsvInternal(securityContext, team);
  }

  @PUT
  @Path("/import")
  @Consumes(MediaType.TEXT_PLAIN)
  @Valid
  @Operation(
      operationId = "importTeams",
      summary = "Import from CSV to create, and update teams.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Import result",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = CsvImportResult.class)))
      })
  public CsvImportResult importCsv(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Name of the team to under which the users are imported to",
              required = true,
              schema = @Schema(type = "string"))
          @QueryParam("team")
          String team,
      @Parameter(
              description =
                  "Dry-run when true is used for validating the CSV without really importing it. (default=true)",
              schema = @Schema(type = "boolean"))
          @DefaultValue("true")
          @QueryParam("dryRun")
          boolean dryRun,
      String csv)
      throws IOException {
    return importCsvInternal(securityContext, team, csv, dryRun);
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
    if (original != null && (original.getIsBot() == null || Boolean.FALSE.equals(original.getIsBot()))) {
      throw new IllegalArgumentException(String.format("User [%s] already exists.", original.getName()));
    } else if (!botHasRelationshipWithUser(bot, original)
        && original != null
        && userHasRelationshipWithAnyBot(original, bot)) {
      // throw an exception if user already has a relationship with a bot
      List<CollectionDAO.EntityRelationshipRecord> userBotRelationship = retrieveBotRelationshipsFor(original);
      bot =
          Entity.getEntityRepository(Entity.BOT)
              .get(null, userBotRelationship.stream().findFirst().orElseThrow().getId(), Fields.EMPTY_FIELDS);
      throw new IllegalArgumentException(CatalogExceptionMessage.userAlreadyBot(user.getName(), bot.getName()));
    }
    // TODO: review this flow on https://github.com/open-metadata/OpenMetadata/issues/8321
    if (original != null) {
      EntityMaskerFactory.getEntityMasker()
          .unmaskAuthenticationMechanism(
              user.getName(), create.getAuthenticationMechanism(), original.getAuthenticationMechanism());
      user.setRoles(original.getRoles());
    } else if (bot != null && ProviderType.SYSTEM.equals(bot.getProvider())) {
      user.setRoles(UserUtil.getRoleForBot(botName));
    }
    // TODO remove this
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

  // TODO remove this
  private void addAuthMechanismToBot(User user, @Valid CreateUser create, UriInfo uriInfo) {
    if (!Boolean.TRUE.equals(user.getIsBot())) {
      throw new IllegalArgumentException("Authentication mechanism change is only supported for bot users");
    }
    if (isValidAuthenticationMechanism(create)) {
      AuthenticationMechanism authMechanism = create.getAuthenticationMechanism();
      AuthenticationMechanism.AuthType authType = authMechanism.getAuthType();
      switch (authType) {
        case JWT:
          User original = retrieveBotUser(user, uriInfo);
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
      original = dao.getByName(uriInfo, user.getFullyQualifiedName(), dao.getFieldsWithUserAuth("*"));
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

  private void decryptOrNullify(SecurityContext securityContext, User user) {
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    if (Boolean.TRUE.equals(user.getIsBot()) && user.getAuthenticationMechanism() != null) {
      try {
        authorizer.authorize(
            securityContext,
            new OperationContext(entityType, MetadataOperation.VIEW_ALL),
            getResourceContextById(user.getId()));
      } catch (AuthorizationException | IOException e) {
        user.getAuthenticationMechanism().setConfig(null);
      }
      secretsManager.encryptOrDecryptAuthenticationMechanism(user.getName(), user.getAuthenticationMechanism(), false);
      if (authorizer.shouldMaskPasswords(securityContext)) {
        EntityMaskerFactory.getEntityMasker()
            .maskAuthenticationMechanism(user.getName(), user.getAuthenticationMechanism());
      }
    }
  }

  @Override
  public User getByNameInternal(
      UriInfo uriInfo, SecurityContext securityContext, String name, String fieldsParam, Include include)
      throws IOException {
    return super.getByNameInternal(uriInfo, securityContext, EntityInterfaceUtil.quoteName(name), fieldsParam, include);
  }
}
