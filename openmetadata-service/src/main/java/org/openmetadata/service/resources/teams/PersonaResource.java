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

import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import io.dropwizard.jersey.PATCH;
import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.json.JsonPatch;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.teams.CreatePersona;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.PersonaContext;
import org.openmetadata.schema.type.PersonaContextDefinition;
import org.openmetadata.schema.type.personaContext.ContextRule;
import org.openmetadata.schema.type.personaContext.PersonaContextCacheState;
import org.openmetadata.schema.type.personaContext.RuleResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.aicontext.AIContextMarkdown;
import org.openmetadata.service.aicontext.PersonaContextAccess;
import org.openmetadata.service.aicontext.PersonaContextBuilder;
import org.openmetadata.service.aicontext.PersonaContextCache;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.PersonaRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;

@Slf4j
@Path("/v1/personas")
@Tag(
    name = "Personas",
    description =
        "A `Persona` is to represent job function a user does. "
            + " OpenMetadata uses Persona to define customizable experience in the UI.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "personas", order = 2)
public class PersonaResource extends EntityResource<Persona, PersonaRepository> {
  private final PersonaMapper mapper = new PersonaMapper();
  public static final String COLLECTION_PATH = "/v1/personas";
  static final String FIELDS = "users,contextDefinition";

  @Override
  public Persona addHref(UriInfo uriInfo, Persona persona) {
    super.addHref(uriInfo, persona);
    Entity.withHref(uriInfo, persona.getUsers());
    return persona;
  }

  public PersonaResource(Authorizer authorizer, Limits limits) {
    super(Entity.PERSONA, authorizer, limits);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation(FIELDS, MetadataOperation.VIEW_BASIC);
    return listOf(MetadataOperation.EDIT_ALL);
  }

  public static class PersonaList extends ResultList<Persona> {
    /* Required for serde */
  }

  @GET
  @Valid
  @Operation(
      operationId = "listPersonas",
      summary = "List personas",
      description =
          "Get a list of personas. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of personas",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PersonaList.class)))
      })
  public ResultList<Persona> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Limit the number of personas returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of personas before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of personas after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after) {
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, new ListFilter(null), limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllPersonaVersion",
      summary = "List Persona versions",
      description = "Get a list of all the versions of a persona identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of persona versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Persona", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Valid
  @Path("/{id}")
  @Operation(
      operationId = "getPersonaByID",
      summary = "Get a persona by id",
      description = "Get a persona by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Persona",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Persona.class))),
        @ApiResponse(responseCode = "404", description = "Persona for instance {id} is not found")
      })
  public Persona get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Persona", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
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
          Include include,
      @Parameter(
              description =
                  "Per-relation include control. Format: field:value,field2:value2. "
                      + "Example: owners:non-deleted,followers:all. "
                      + "Valid values: all, deleted, non-deleted. "
                      + "If not specified for a field, uses the entity's include value.",
              schema = @Schema(type = "string", example = "owners:non-deleted,followers:all"))
          @QueryParam("includeRelations")
          String includeRelations) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include, includeRelations);
  }

  @GET
  @Valid
  @Path("/name/{name}")
  @Operation(
      operationId = "getPersonaByFQN",
      summary = "Get a Persona by name",
      description = "Get a Persona by `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Persona",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Persona.class))),
        @ApiResponse(responseCode = "404", description = "Persona for instance {name} is not found")
      })
  public Persona getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Persona", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
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
          Include include) {
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
  }

  @GET
  @Path("/{id}/aiContext")
  @Operation(
      operationId = "getPersonaAiContextConfiguration",
      summary = "Get a persona AI context configuration")
  public PersonaContextDefinition getAiContextConfiguration(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id) {
    authorizer.authorizeAdmin(securityContext);
    return configurationWithDerivedState(getPersona(uriInfo, id));
  }

  @PUT
  @Path("/{id}/aiContext")
  @Operation(
      operationId = "updatePersonaAiContextConfiguration",
      summary = "Update persona AI context settings")
  public PersonaContextDefinition updateAiContextConfiguration(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Valid PersonaContextDefinition requested) {
    authorizer.authorizeAdmin(securityContext);
    Persona original = getPersona(uriInfo, id);
    PersonaContextDefinition definition = editableDefinition(original);
    definition.setEnabled(requested.getEnabled());
    definition.setCharacterBudget(requested.getCharacterBudget());
    definition.setCacheTtlMinutes(requested.getCacheTtlMinutes());
    Persona updated = persistDefinition(uriInfo, securityContext, original, definition);
    PersonaContextCache.getInstance().refreshAsync(updated);
    return configurationWithDerivedState(updated);
  }

  @POST
  @Path("/{id}/aiContext/rules")
  @Operation(
      operationId = "createPersonaAiContextRule",
      summary = "Create a persona AI context rule")
  public PersonaContextDefinition createAiContextRule(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Valid ContextRule requestedRule) {
    authorizer.authorizeAdmin(securityContext);
    Persona original = getPersona(uriInfo, id);
    PersonaContextDefinition definition = editableDefinition(original);
    ContextRule rule = sanitizedRule(requestedRule);
    rule.setId(UUID.randomUUID());
    List<ContextRule> rules = new ArrayList<>(listOrEmpty(definition.getRules()));
    rules.add(rule);
    definition.setRules(rules);
    Persona updated = persistDefinition(uriInfo, securityContext, original, definition);
    PersonaContextCache.getInstance().refreshAsync(updated);
    return configurationWithDerivedState(updated);
  }

  @PUT
  @Path("/{id}/aiContext/rules/{ruleId:[0-9a-fA-F\\-]{36}}")
  @Operation(
      operationId = "updatePersonaAiContextRule",
      summary = "Update a persona AI context rule")
  public PersonaContextDefinition updateAiContextRule(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @PathParam("ruleId") UUID ruleId,
      @Valid ContextRule requestedRule) {
    authorizer.authorizeAdmin(securityContext);
    Persona original = getPersona(uriInfo, id);
    PersonaContextDefinition definition = editableDefinition(original);
    List<ContextRule> rules = new ArrayList<>(listOrEmpty(definition.getRules()));
    int ruleIndex = findRule(rules, ruleId);
    ContextRule rule = sanitizedRule(requestedRule);
    rule.setId(ruleId);
    rules.set(ruleIndex, rule);
    definition.setRules(rules);
    Persona updated = persistDefinition(uriInfo, securityContext, original, definition);
    PersonaContextCache.getInstance().refreshAsync(updated);
    return configurationWithDerivedState(updated);
  }

  @DELETE
  @Path("/{id}/aiContext/rules/{ruleId:[0-9a-fA-F\\-]{36}}")
  @Operation(
      operationId = "deletePersonaAiContextRule",
      summary = "Delete a persona AI context rule")
  public PersonaContextDefinition deleteAiContextRule(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @PathParam("ruleId") UUID ruleId) {
    authorizer.authorizeAdmin(securityContext);
    Persona original = getPersona(uriInfo, id);
    PersonaContextDefinition definition = editableDefinition(original);
    List<ContextRule> rules = new ArrayList<>(listOrEmpty(definition.getRules()));
    rules.remove(findRule(rules, ruleId));
    definition.setRules(rules);
    Persona updated = persistDefinition(uriInfo, securityContext, original, definition);
    PersonaContextCache.getInstance().refreshAsync(updated);
    return configurationWithDerivedState(updated);
  }

  @POST
  @Path("/{id}/aiContext/rules/preview")
  @Operation(
      operationId = "previewPersonaAiContextRule",
      summary = "Preview the entities matched by a persona AI context rule")
  public PersonaContextBuilder.RulePreview previewAiContextRule(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Valid ContextRule rule) {
    authorizer.authorizeAdmin(securityContext);
    getPersona(uriInfo, id);
    return PersonaContextBuilder.preview(rule);
  }

  @GET
  @Path("/{id}/aiContext/document")
  @Operation(
      operationId = "getPersonaAiContextDocument",
      summary = "Get the compiled persona AI context document")
  public Response getAiContextDocument(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id) {
    authorizer.authorizeAdmin(securityContext);
    Persona persona = getPersona(uriInfo, id);
    PersonaContextCache.CachedResult cached = PersonaContextCache.getInstance().get(persona, false);
    return documentResponse(cached);
  }

  @POST
  @Path("/{id}/aiContext/document:refresh")
  @Operation(
      operationId = "refreshPersonaAiContextDocument",
      summary = "Force recompilation of a persona AI context document")
  public Response refreshAiContextDocument(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id) {
    authorizer.authorizeAdmin(securityContext);
    Persona persona = getPersona(uriInfo, id);
    return documentResponse(PersonaContextCache.getInstance().refresh(persona));
  }

  @Override
  @GET
  @Path("/{id}/context")
  @Produces({AIContextMarkdown.TEXT_MARKDOWN, MediaType.APPLICATION_JSON})
  @Operation(
      operationId = "getPersonaContextById",
      summary = "Get the materialized AI context for a persona by id",
      description =
          "Materialize every enabled persona context rule into one cached markdown document, or "
              + "return the structured result with `?format=json`.")
  public Response getAiContextById(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Persona id", required = true) @PathParam("id") UUID id,
      @Parameter(description = "Output format: markdown (default) or json")
          @QueryParam("format")
          @DefaultValue("markdown")
          String format,
      @Parameter(description = "Bypass the cached materialization; admin and bot only")
          @QueryParam("refresh")
          @DefaultValue("false")
          String refresh) {
    Persona persona =
        Entity.getEntity(Entity.PERSONA, id, "contextDefinition,users", Include.NON_DELETED);
    return renderPersonaContext(persona, securityContext, format, Boolean.parseBoolean(refresh));
  }

  @Override
  @GET
  @Path("/name/{fqn}/context")
  @Produces({AIContextMarkdown.TEXT_MARKDOWN, MediaType.APPLICATION_JSON})
  @Operation(
      operationId = "getPersonaContextByName",
      summary = "Get the materialized AI context for a persona by name")
  public Response getAiContextByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Persona fully qualified name", required = true) @PathParam("fqn")
          String fqn,
      @Parameter(description = "Output format: markdown (default) or json")
          @QueryParam("format")
          @DefaultValue("markdown")
          String format,
      @Parameter(description = "Bypass the cached materialization; admin and bot only")
          @QueryParam("refresh")
          @DefaultValue("false")
          String refresh) {
    Persona persona =
        Entity.getEntityByName(Entity.PERSONA, fqn, "contextDefinition,users", Include.NON_DELETED);
    return renderPersonaContext(persona, securityContext, format, Boolean.parseBoolean(refresh));
  }

  @GET
  @Path("/me/context")
  @Produces({AIContextMarkdown.TEXT_MARKDOWN, MediaType.APPLICATION_JSON})
  @Operation(
      operationId = "getMyPersonaContext",
      summary = "Get the materialized AI context for the caller's active persona")
  public Response getMyPersonaContext(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Output format: markdown (default) or json")
          @QueryParam("format")
          @DefaultValue("markdown")
          String format,
      @Parameter(description = "Bypass the cached materialization; admin and bot only")
          @QueryParam("refresh")
          @DefaultValue("false")
          String refresh) {
    Persona persona = PersonaContextAccess.activePersona(securityContext);
    return renderPersonaContext(persona, securityContext, format, Boolean.parseBoolean(refresh));
  }

  private Response renderPersonaContext(
      Persona persona, SecurityContext securityContext, String format, boolean refresh) {
    PersonaContextAccess.authorize(securityContext, persona);
    if (refresh) {
      PersonaContextAccess.authorizeRefresh(securityContext);
    }
    PersonaContextCache.CachedResult cached =
        refresh
            ? PersonaContextCache.getInstance().refresh(persona)
            : PersonaContextCache.getInstance().get(persona, false);
    PersonaContextBuilder.MaterializedPersonaContext value = cached.value();
    Response.ResponseBuilder response =
        AIContextMarkdown.FORMAT_JSON.equalsIgnoreCase(format)
            ? Response.ok(value.context(), MediaType.APPLICATION_JSON_TYPE)
            : Response.ok(value.markdown(), AIContextMarkdown.TEXT_MARKDOWN);
    return response.header(PersonaContextCache.CACHE_HEADER, cached.status().name()).build();
  }

  private Persona getPersona(UriInfo uriInfo, UUID id) {
    return repository.get(uriInfo, id, getFields(FIELDS), Include.NON_DELETED, false);
  }

  private PersonaContextDefinition editableDefinition(Persona persona) {
    PersonaContextDefinition definition =
        persona.getContextDefinition() == null
            ? new PersonaContextDefinition()
            : JsonUtils.deepCopy(persona.getContextDefinition(), PersonaContextDefinition.class);
    List<ContextRule> rules = new ArrayList<>(listOrEmpty(definition.getRules()));
    for (int index = 0; index < rules.size(); index++) {
      ContextRule rule = rules.get(index);
      if (rule.getId() == null) {
        String seed = persona.getId() + ":" + index + ":" + rule.getName();
        rule.setId(UUID.nameUUIDFromBytes(seed.getBytes(StandardCharsets.UTF_8)));
      }
      rule.setMatchedCount(null);
    }
    definition.setRules(rules);
    definition.setLastGeneratedAt(null);
    definition.setCacheState(null);
    definition.setLastError(null);
    definition.setMaxTotalChars(null);
    definition.setCacheTtlSeconds(null);
    return definition;
  }

  private PersonaContextDefinition configurationWithDerivedState(Persona persona) {
    PersonaContextDefinition definition = editableDefinition(persona);
    PersonaContextCache.CacheSnapshot snapshot =
        PersonaContextCache.getInstance().snapshot(persona);
    definition.setCacheState(snapshot.state());
    definition.setLastError(snapshot.error());
    if (snapshot.value() != null) {
      PersonaContext context = snapshot.value().context();
      definition.setLastGeneratedAt(context.getGeneratedAt());
      for (ContextRule rule : definition.getRules()) {
        listOrEmpty(context.getRules()).stream()
            .filter(result -> rule.getName().equals(result.getRuleName()))
            .findFirst()
            .map(RuleResult::getMatched)
            .ifPresent(rule::setMatchedCount);
      }
    }
    return definition;
  }

  private Persona persistDefinition(
      UriInfo uriInfo,
      SecurityContext securityContext,
      Persona original,
      PersonaContextDefinition definition) {
    definition.setLastGeneratedAt(null);
    definition.setCacheState(null);
    definition.setLastError(null);
    Persona updated = JsonUtils.deepCopy(original, Persona.class);
    updated.setContextDefinition(definition);
    repository.prepareInternal(updated, true);
    return repository
        .update(uriInfo, original, updated, securityContext.getUserPrincipal().getName())
        .getEntity();
  }

  private static ContextRule sanitizedRule(ContextRule requestedRule) {
    ContextRule rule = JsonUtils.deepCopy(requestedRule, ContextRule.class);
    rule.setMatchedCount(null);
    if (rule.getMaxAssets() == null) {
      rule.setMaxAssets(50);
    }
    return rule;
  }

  private static int findRule(List<ContextRule> rules, UUID ruleId) {
    for (int index = 0; index < rules.size(); index++) {
      if (ruleId.equals(rules.get(index).getId())) {
        return index;
      }
    }
    throw new NotFoundException("Persona AI context rule not found: " + ruleId);
  }

  private static Response documentResponse(PersonaContextCache.CachedResult cached) {
    PersonaContextBuilder.MaterializedPersonaContext materialized = cached.value();
    PersonaContext context = materialized.context();
    String markdown = materialized.markdown();
    int entitiesIncluded =
        listOrEmpty(context.getRules()).stream()
            .mapToInt(
                result -> value(result.getRenderedFull()) + value(result.getRenderedCompact()))
            .sum();
    PersonaContextDocument document =
        new PersonaContextDocument(
            markdown,
            entitiesIncluded,
            listOrEmpty(context.getManifest()).size(),
            Math.max(1, (int) Math.ceil(markdown.length() / 4.0)),
            markdown.getBytes(StandardCharsets.UTF_8).length,
            context.getGeneratedAt(),
            Boolean.TRUE.equals(context.getTruncated()),
            PersonaContextCacheState.FRESH);
    return Response.ok(document)
        .header(PersonaContextCache.CACHE_HEADER, cached.status().name())
        .build();
  }

  private static int value(Integer number) {
    return number == null ? 0 : number;
  }

  public record PersonaContextDocument(
      String markdown,
      int entitiesIncluded,
      int truncatedCount,
      int tokensEst,
      int bytes,
      long generatedAt,
      boolean truncated,
      PersonaContextCacheState cacheState) {}

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificPersonaVersion",
      summary = "Get a version of the Persona",
      description = "Get a version of the Persona by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Persona",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Persona.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Persona for instance {id} and version {version} is not found")
      })
  public Persona getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Persona", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Personas version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createPersona",
      summary = "Create a Persona",
      description = "Create a new Persona.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Persona.",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Persona.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreatePersona cp) {
    authorizer.authorizeAdmin(securityContext);
    Persona persona = mapper.createToEntity(cp, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, persona);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdatePersona",
      summary = "Update Persona",
      description = "Create or Update a Persona.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Persona.",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Persona.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreatePersona cp) {
    authorizer.authorizeAdmin(securityContext);
    Persona persona = mapper.createToEntity(cp, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, persona);
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(
      operationId = "patchPersona",
      summary = "Update a Persona",
      description = "Update an existing persona with JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Persona", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    authorizer.authorizeAdmin(securityContext);
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @PATCH
  @Path("/name/{fqn}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(
      operationId = "patchPersona",
      summary = "Update a Persona using name.",
      description = "Update an existing persona with JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Persona", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    authorizer.authorizeAdmin(securityContext);
    return patchInternal(uriInfo, securityContext, fqn, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deletePersona",
      summary = "Delete a Persona by id",
      description = "Delete a Persona by given `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Persona for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Persona", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    authorizer.authorizeAdmin(securityContext);
    return delete(uriInfo, securityContext, id, false, true);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deletePersonaAsync",
      summary = "Asynchronously delete a Persona by id",
      description = "Asynchronously delete a Persona by given `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Persona for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Persona", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    authorizer.authorizeAdmin(securityContext);
    return deleteByIdAsync(uriInfo, securityContext, id, false, true);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deletePersonaByName",
      summary = "Delete a Persona by name",
      description = "Delete a Persona by given `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Persona for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Persona", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    authorizer.authorizeAdmin(securityContext);
    return deleteByName(uriInfo, securityContext, name, false, true);
  }
}
