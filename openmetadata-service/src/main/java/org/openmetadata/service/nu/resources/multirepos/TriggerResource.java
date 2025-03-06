package org.openmetadata.service.nu.resources.multirepos;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.openmetadata.schema.nu.multirepos.api.CreateTrigger;
import org.openmetadata.schema.nu.multirepos.entity.Trigger;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.nu.jdbi3.multirepos.TriggerRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;

import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.ResultList;

import javax.json.JsonPatch;
import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.*;
import javax.ws.rs.core.*;
import java.util.UUID;

@Path("/v1/triggers")
@Tag(name = "Triggers",
     description = "A trigger")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "triggers")
public class TriggerResource extends EntityResource<Trigger, TriggerRepository> {

    public static final String COLLECTION_PATH = "/v1/triggers/";
    private final TriggerMapper mapper = new TriggerMapper();
    private static final String FIELDS = "tags, extension, scheduleInterval, domain";

    public TriggerResource(Authorizer authorizer, Limits limits) {
        super(Entity.TRIGGER, authorizer, limits);
    }

    @Override
    public Trigger addHref(UriInfo uriInfo, Trigger trigger) {
        super.addHref(uriInfo, trigger);
        Entity.withHref(uriInfo, trigger.getEntityReference());
        return trigger;
    }

    public static class TriggerList extends ResultList<Trigger> {
        @SuppressWarnings("unused")
        public TriggerList() {
            /* Required for serde */
        }
    }

    @GET
    @Operation(
            operationId = "listTriggers",
            summary = "List triggers",
            description = "Get a list of Trigger.",
            responses = {
                    @ApiResponse(
                            responseCode = "200",
                            description = "List of Trigger",
                            content =
                            @Content(
                                    mediaType = "application/json",
                                    schema = @Schema(implementation = TriggerResource.TriggerList.class)))
            })
    public ResultList<Trigger> list(
            @Context UriInfo uriInfo,
            @Context SecurityContext securityContext,
            @DefaultValue("10") @Min(0) @Max(1000000) @QueryParam("limit") int limitParam,
            @Parameter(
                    description = "Returns list of Trigger before this cursor",
                    schema = @Schema(type = "string"))
            @QueryParam("before")
            String before,
            @Parameter(
                    description = "Returns list of Trigger after this cursor",
                    schema = @Schema(type = "string"))
            @QueryParam("after")
            String after,
            @Parameter(
                    description = "Include all, deleted, or non-deleted entities.",
                    schema = @Schema(implementation = Include.class))
            @QueryParam("include")
            @DefaultValue("non-deleted")
            Include include) {
        return listInternal(
                uriInfo, securityContext, "", new ListFilter(include), limitParam, before, after);
    }



    @GET
    @Path("/{id}")
    @Operation(
            operationId = "getTriggerByID",
            summary = "Get a trigger by Id",
            description = "Get a trigger by `Id`.",
            responses = {
                    @ApiResponse(
                            responseCode = "200",
                            description = "The trigger",
                            content =
                            @Content(
                                    mediaType = "application/json",
                                    schema = @Schema(implementation = Trigger.class))),
                    @ApiResponse(responseCode = "404", description = "Trigger for instance {id} is not found")
            })
    public Trigger get(
            @Context UriInfo uriInfo,
            @Context SecurityContext securityContext,
            @QueryParam("include") @DefaultValue("non-deleted") Include include,
            @Parameter(description = "Id of the trigger", schema = @Schema(type = "UUID")) @PathParam("id")
            UUID id) {
        return getInternal(uriInfo, securityContext, id, "", include);
    }

    @GET
    @Path("/nurn/{nurn}")
    @Operation(
            operationId = "getTriggerByFQN",
            summary = "Get a trigger by nurn",
            description = "Get a trigger by `nurn`.",
            responses = {
                    @ApiResponse(
                            responseCode = "200",
                            description = "trigger",
                            content =
                            @Content(
                                    mediaType = "application/json",
                                    schema = @Schema(implementation = Trigger.class))),
                    @ApiResponse(responseCode = "404", description = "Trigger for instance {nurn} is not found")
            })
    public Trigger getByNuRN(
            @Context UriInfo uriInfo,
            @Context SecurityContext securityContext,
            @Parameter(description = "NuRN of the trigger", schema = @Schema(type = "string"))
            @PathParam("nurn")
            String nurn,
            @Parameter(
                    description = "Include all, deleted, or non-deleted entities.",
                    schema = @Schema(implementation = Include.class))
            @QueryParam("include")
            @DefaultValue("non-deleted")
            Include include) {
        return getByNameInternal(
                uriInfo, securityContext, EntityInterfaceUtil.quoteName(nurn), "", include);
    }

    @POST
    @Operation(
            operationId = "createTrigger",
            summary = "Create a trigger",
            description = "Create a new trigger.",
            responses = {
                    @ApiResponse(
                            responseCode = "200",
                            description = "The trigger ",
                            content =
                            @Content(
                                    mediaType = "application/json",
                                    schema = @Schema(implementation = Trigger.class))),
                    @ApiResponse(responseCode = "400", description = "Bad request")
            })
    public Response create(
            @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTrigger create) {
        Trigger trigger = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
        return create(uriInfo, securityContext, trigger);
    }

    @PUT
    @Operation(
            operationId = "createOrUpdateTrigger",
            summary = "Create or update a trigger",
            description = "Create a trigger, if it does not exist. If a trigger already exists, update the trigger.",
            responses = {
                    @ApiResponse(
                            responseCode = "200",
                            description = "The trigger",
                            content =
                            @Content(
                                    mediaType = "application/json",
                                    schema = @Schema(implementation = Trigger.class))),
                    @ApiResponse(responseCode = "400", description = "Bad request")
            })
    public Response createOrUpdate(
            @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTrigger create) {
        Trigger trigger = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
        return createOrUpdate(uriInfo, securityContext, trigger);
    }

    @PATCH
    @Path("/{id}")
    @Operation(
            operationId = "patchTrigger",
            summary = "Update a trigger",
            description = "Update an existing trigger using JsonPatch.",
            externalDocs =
            @ExternalDocumentation(
                    description = "JsonPatch RFC",
                    url = "https://tools.ietf.org/html/rfc6902"))
    @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
    public Response patch(
            @Context UriInfo uriInfo,
            @Context SecurityContext securityContext,
            @Parameter(description = "Id of the trigger", schema = @Schema(type = "UUID")) @PathParam("id")
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
        return patchInternal(uriInfo, securityContext, id, patch);
    }

    @PATCH
    @Path("/nurn/{nurn}")
    @Operation(
            operationId = "patchTrigger",
            summary = "Update a trigger by NuRN.",
            description = "Update an existing trigger using JsonPatch.",
            externalDocs =
            @ExternalDocumentation(
                    description = "JsonPatch RFC",
                    url = "https://tools.ietf.org/html/rfc6902"))
    @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
    public Response patch(
            @Context UriInfo uriInfo,
            @Context SecurityContext securityContext,
            @Parameter(description = "NuRN of the trigger", schema = @Schema(type = "string"))
            @PathParam("nurn")
            String nurn,
            @RequestBody(
                    description = "JsonPatch with array of operations",
                    content =
                    @Content(
                            mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                            examples = {
                                    @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                            }))
            JsonPatch patch) {
        return patchInternal(uriInfo, securityContext, nurn, patch);
    }

    @DELETE
    @Path("/{id}")
    @Operation(
            operationId = "deleteTrigger",
            summary = "Delete a trigger by Id",
            description = "Delete a trigger by `Id`.",
            responses = {
                    @ApiResponse(responseCode = "200", description = "OK"),
                    @ApiResponse(responseCode = "404", description = "Trigger for instance {id} is not found")
            })
    public Response delete(
            @Context UriInfo uriInfo,
            @Context SecurityContext securityContext,
            @Parameter(description = "Hard delete the entity. (Default = `false`)")
            @QueryParam("hardDelete")
            @DefaultValue("false")
            boolean hardDelete,
            @Parameter(description = "Id of the trigger", schema = @Schema(type = "UUID")) @PathParam("id")
            UUID id) {
        return delete(uriInfo, securityContext, id, true, hardDelete);
    }

    @DELETE
    @Path("/nurn/{nurn}")
    @Operation(
            operationId = "deleteTriggerByNuRN",
            summary = "Delete a trigger by NuRN",
            description = "Delete a trigger by `NuRN`.",
            responses = {
                    @ApiResponse(responseCode = "200", description = "OK"),
                    @ApiResponse(responseCode = "404", description = "Trigger for instance {nurn} is not found")
            })
    public Response delete(
            @Context UriInfo uriInfo,
            @Context SecurityContext securityContext,
            @Parameter(description = "Hard delete the entity. (Default = `false`)")
            @QueryParam("hardDelete")
            @DefaultValue("false")
            boolean hardDelete,
            @Parameter(description = "NuRN of the trigger", schema = @Schema(type = "string"))
            @PathParam("nurn")
            String nurn) {
        return deleteByName(
                uriInfo, securityContext, EntityInterfaceUtil.quoteName(nurn), true, hardDelete);
    }
}
