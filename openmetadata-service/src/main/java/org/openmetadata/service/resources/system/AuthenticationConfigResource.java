package org.openmetadata.service.resources.system;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.service.jdbi3.AuthenticationConfigDAO;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.AuthenticationConfigurationManager;
import org.openmetadata.service.util.ResultList;

@Path("/v1/system/auth/config")
@Tag(name = "System", description = "APIs for managing authentication configuration.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AuthenticationConfigResource {
    private final AuthenticationConfigurationManager authConfigManager;
    private final Authorizer authorizer;

    public AuthenticationConfigResource(AuthenticationConfigurationManager authConfigManager, Authorizer authorizer) {
        this.authConfigManager = authConfigManager;
        this.authorizer = authorizer;
    }

    @GET
    @Operation(
        operationId = "getAuthConfig",
        summary = "Get current authentication configuration",
        responses = {
            @ApiResponse(
                responseCode = "200",
                description = "Authentication configuration",
                content = @Content(mediaType = "application/json", schema = @Schema(implementation = AuthenticationConfiguration.class))
            )
        }
    )
    public AuthenticationConfiguration getAuthConfig() {
        authorizer.authorizeAdmin();
        return authConfigManager.getCurrentConfig();
    }

    @PUT
    @Operation(
        operationId = "updateAuthConfig",
        summary = "Update authentication configuration",
        responses = {
            @ApiResponse(
                responseCode = "200",
                description = "Successfully updated authentication configuration",
                content = @Content(mediaType = "application/json", schema = @Schema(implementation = AuthenticationConfiguration.class))
            )
        }
    )
    public Response updateAuthConfig(
        @Valid @Parameter(description = "Authentication configuration", required = true) AuthenticationConfiguration config) {
        authorizer.authorizeAdmin();
        authConfigManager.reloadAuthenticationSystem(config);
        return Response.ok(config).build();
    }
} 