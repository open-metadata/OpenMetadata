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

import static org.openmetadata.schema.auth.TokenType.EMAIL_VERIFICATION;
import static org.openmetadata.schema.auth.TokenType.PASSWORD_RESET;
import static org.openmetadata.schema.auth.TokenType.REFRESH_TOKEN;

import at.favre.lib.crypto.bcrypt.BCrypt;
import com.fasterxml.jackson.core.JsonProcessingException;
import freemarker.template.TemplateException;
import io.dropwizard.jersey.PATCH;
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
import java.time.temporal.ChronoUnit;
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
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.ChangePasswordRequest;
import org.openmetadata.schema.auth.EmailRequest;
import org.openmetadata.schema.auth.EmailVerificationToken;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.auth.PasswordResetRequest;
import org.openmetadata.schema.auth.PasswordResetToken;
import org.openmetadata.schema.auth.RefreshToken;
import org.openmetadata.schema.auth.RegistrationRequest;
import org.openmetadata.schema.auth.TokenRefreshRequest;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.teams.authn.BasicAuthMechanism;
import org.openmetadata.schema.teams.authn.GenerateTokenRequest;
import org.openmetadata.schema.teams.authn.JWTAuthMechanism;
import org.openmetadata.schema.teams.authn.JWTTokenExpiry;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.ConfigurationHolder;
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
    return super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
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
      @Parameter(description = "user Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException {
    return dao.listVersions(id);
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
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
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
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
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
    return dao.getVersion(id, version);
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
    // TODO do we need to authenticate user is creating himself?
    addHref(uriInfo, dao.create(uriInfo, user));
    return Response.created(user.getHref()).entity(user).build();
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
    } else {
      OperationContext createOperationContext = new OperationContext(entityType, MetadataOperation.CREATE);
      authorizer.authorize(securityContext, createOperationContext, getResourceContextByName(user.getName()), true);
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
  public JWTAuthMechanism generateToken(
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
    return jwtAuthMechanism;
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
        new AuthenticationMechanism().withConfig(jwtAuthMechanism).withAuthType(AuthenticationMechanism.AuthType.JWT);
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
    authorizer.authorizeAdmin(securityContext, false);
    AuthenticationMechanism authenticationMechanism = user.getAuthenticationMechanism();
    if (authenticationMechanism != null
        && authenticationMechanism.getConfig() != null
        && authenticationMechanism.getAuthType() == AuthenticationMechanism.AuthType.JWT) {
      return JsonUtils.convertValue(authenticationMechanism.getConfig(), JWTAuthMechanism.class);
    }
    return new JWTAuthMechanism();
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
    return delete(uriInfo, securityContext, id, false, hardDelete, true);
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
    User registeredUser = registerUser(uriInfo, create);
    try {
      sendEmailVerification(uriInfo, registeredUser);
    } catch (Exception e) {
      LOG.error("Error in sending mail to the User : {}", e.getMessage());
      return Response.status(424)
          .entity(
              "User Registration Successful. Email for Verification couldn't be sent. Please contact your administrator")
          .build();
    }
    return Response.status(Response.Status.OK).entity("User Registration Successful.").build();
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
          @QueryParam("token")
          String token)
      throws IOException {
    User registeredUser = extendRegistrationToken(uriInfo, token);
    try {
      sendEmailVerification(uriInfo, registeredUser);
    } catch (Exception e) {
      LOG.error("Error in sending Email Verification mail to the User : {}", e.getMessage());
      return Response.status(424)
          .entity("There is some issue in sending the Mail. Please contact your administrator.")
          .build();
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
  public Response generateResetPasswordLink(@Context UriInfo uriInfo, @Valid EmailRequest request) throws IOException {
    String userName = request.getEmail().split("@")[0];
    User registeredUser =
        dao.getByName(uriInfo, userName, new Fields(List.of(USER_PROTECTED_FIELDS), USER_PROTECTED_FIELDS));
    // send a mail to the User with the Update
    try {
      sendPasswordResetLink(uriInfo, registeredUser);
    } catch (Exception ex) {
      LOG.error("Error in sending mail for reset password" + ex.getMessage());
      return Response.status(424)
          .entity("There is some issue in sending the Mail. Please contact your administrator.")
          .build();
    }

    return Response.status(Response.Status.OK).build();
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
      throw new EntityNotFoundException("Token not found for Password Reset. Please issue new Password Reset Request.");
    }
    User storedUser =
        dao.getByName(
            uriInfo, request.getUsername(), new Fields(List.of(USER_PROTECTED_FIELDS), USER_PROTECTED_FIELDS));
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

    storedUser.getAuthenticationMechanism().setConfig(newAuthForUser);

    // Don't want to return the entity just a 201 or 200 should do
    RestUtil.PutResponse<User> response = dao.createOrUpdate(uriInfo, storedUser);

    // delete the user's all password reset token as well , since already updated
    tokenRepository.deleteTokenByUserAndType(storedUser.getId().toString(), PASSWORD_RESET.toString());
    // Update user about Password Change
    try {
      Map<String, String> templatePopulator = new HashMap<>();
      templatePopulator.put(EmailUtil.ENTITY, EmailUtil.getInstance().getEmailingEntity());
      templatePopulator.put(EmailUtil.SUPPORTURL, EmailUtil.getInstance().getSupportUrl());
      templatePopulator.put(EmailUtil.USERNAME, storedUser.getName());
      templatePopulator.put(EmailUtil.ACTIONKEY, "Update Password");
      templatePopulator.put(EmailUtil.ACTIONSTATUSKEY, "Change Successful");

      EmailUtil.getInstance()
          .sendMail(
              EmailUtil.getInstance().getAccountStatusChangeSubject(),
              templatePopulator,
              storedUser.getEmail(),
              EmailUtil.EMAILTEMPLATEBASEPATH,
              EmailUtil.ACCOUNTSTATUSTEMPLATEFILE);
    } catch (Exception ex) {
      LOG.error("Error in sending Password Change Mail to User. Reason : " + ex.getMessage());
      return Response.status(424)
          .entity(
              "Password updated successfully. There is some problem in sending mail. Please contact your administrator.")
          .build();
    }
    return Response.status(response.getStatus()).entity("Password Changed Successfully").build();
  }

  @POST
  @Path("/changePassword/{id}")
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
      return Response.status(200).entity("Password Updated Successfully").build();
    } else {
      return Response.status(403).entity("Old Password is not correct").build();
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
      throws IOException {
    String userName = loginRequest.getEmail().split("@")[0];
    User storedUser =
        dao.getByName(uriInfo, userName, new Fields(List.of(USER_PROTECTED_FIELDS), USER_PROTECTED_FIELDS));
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
      return Response.status(403).entity("Please enter correct Password").build();
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
    Set<String> allowedDomains =
        ConfigurationHolder.getInstance()
            .getConfig(ConfigurationHolder.ConfigurationType.AUTHORIZERCONFIG, AuthorizerConfiguration.class)
            .getAllowedEmailRegistrationDomains();
    if (!allowedDomains.contains("all") && !allowedDomains.contains(emailDomain)) {
      LOG.error("Email with this Domain not allowed: " + newRegistrationRequestEmail);
      throw new BadRequestException("Email with the given domain is not allowed. Contact Administrator");
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
    return dao.create(uriInfo, newUser);
  }

  public void confirmEmailRegistration(UriInfo uriInfo, String emailToken) throws IOException {
    EmailVerificationToken emailVerificationToken = (EmailVerificationToken) tokenRepository.findByToken(emailToken);
    if (emailVerificationToken == null) {
      throw new EntityNotFoundException("Invalid Token. Please issue a new Request");
    }
    User registeredUser = dao.get(uriInfo, emailVerificationToken.getUserId(), getFields("*"));
    if (registeredUser.getIsEmailVerified()) {
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

  public User extendRegistrationToken(UriInfo uriInfo, String existingToken) throws IOException {
    EmailVerificationToken emailVerificationToken = (EmailVerificationToken) tokenRepository.findByToken(existingToken);
    User registeredUser = dao.get(uriInfo, emailVerificationToken.getUserId(), getFields("isEmailVerified"));
    if (registeredUser.getIsEmailVerified()) {
      // no need to do anything
      return registeredUser;
    }
    // Update token with new Expiry and Status
    emailVerificationToken.setTokenStatus(EmailVerificationToken.TokenStatus.STATUS_PENDING);
    emailVerificationToken.setExpiryDate(Instant.now().plus(24, ChronoUnit.HOURS).toEpochMilli());

    // Update the token details in Database
    tokenRepository.updateToken(emailVerificationToken);
    return registeredUser;
  }

  private void sendEmailVerification(UriInfo uriInfo, User user) throws IOException, TemplateException {
    UUID mailVerificationToken = UUID.randomUUID();
    EmailVerificationToken emailVerificationToken =
        TokenUtil.getEmailVerificationToken(user.getId(), mailVerificationToken);

    LOG.info("Generated Email verification token [" + mailVerificationToken + "]");

    String emailVerificationLink =
        String.format(
            "%s://%s/users/registrationConfirmation?token=%s",
            uriInfo.getRequestUri().getScheme(), uriInfo.getRequestUri().getHost(), mailVerificationToken);
    Map<String, String> templatePopulator = new HashMap<>();

    templatePopulator.put(EmailUtil.ENTITY, EmailUtil.getInstance().getEmailingEntity());
    templatePopulator.put(EmailUtil.SUPPORTURL, EmailUtil.getInstance().getSupportUrl());
    templatePopulator.put(EmailUtil.USERNAME, user.getName());
    templatePopulator.put(EmailUtil.EMAILVERIFICATIONLINKKEY, emailVerificationLink);
    templatePopulator.put(EmailUtil.EXPIRATIONTIMEKEY, "24");
    EmailUtil.getInstance()
        .sendMail(
            EmailUtil.getInstance().getEmailVerificationSubject(),
            templatePopulator,
            user.getEmail(),
            EmailUtil.EMAILTEMPLATEBASEPATH,
            EmailUtil.EMAILVERIFICATIONTEMPLATEPATH);

    // insert the token
    tokenRepository.insertToken(emailVerificationToken);
  }

  private void sendPasswordResetLink(UriInfo uriInfo, User user) throws IOException, TemplateException {
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
    templatePopulator.put(EmailUtil.SUPPORTURL, EmailUtil.getInstance().getSupportUrl());
    templatePopulator.put(EmailUtil.USERNAME, user.getName());
    templatePopulator.put(EmailUtil.PASSWORDRESETLINKKEY, passwordResetLink);
    templatePopulator.put(EmailUtil.EXPIRATIONTIMEKEY, EmailUtil.DEFAULTEXPIRATIONTIME);

    EmailUtil.getInstance()
        .sendMail(
            EmailUtil.getInstance().getPasswordResetSubject(),
            templatePopulator,
            user.getEmail(),
            EmailUtil.EMAILTEMPLATEBASEPATH,
            EmailUtil.PASSWORDRESETTEMPLATEFILE);

    tokenRepository.insertToken(resetToken);
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

  public void verifyPasswordResetTokenExpiry(PasswordResetToken token) throws IOException {
    if (token.getExpiryDate().compareTo(Instant.now().toEpochMilli()) < 0) {
      throw new RuntimeException(
          "Password Reset Token" + token.getToken() + "Expired token. Please issue a new request");
    }
    if (!token.getIsActive()) {
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
}
