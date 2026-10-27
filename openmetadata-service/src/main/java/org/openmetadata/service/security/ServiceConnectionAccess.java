package org.openmetadata.service.security;

import jakarta.ws.rs.core.SecurityContext;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission.Access;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

/**
 * Decides whether a non-bot caller may receive a service's connection, for the REST resource and
 * the MCP tools alike, so the two read paths cannot drift apart: a masked connection goes to
 * callers who hold {@code EDIT_ALL} on the service, and nobody else gets one.
 * ADR:2026-10-26-service-connection-visibility-follows-edit-permission
 */
public final class ServiceConnectionAccess {

  private ServiceConnectionAccess() {}

  public static boolean canEditConnection(
      Authorizer authorizer,
      SecurityContext securityContext,
      ResourceContextInterface resourceContext) {
    // getPermission does not throw and resolves admins without loading the entity, so this avoids
    // using exceptions for the common view-only path and stays cheap on list pages.
    return authorizer
        .getPermission(securityContext, null, resourceContext)
        .getPermissions()
        .stream()
        .anyMatch(
            p -> p.getOperation() == MetadataOperation.EDIT_ALL && p.getAccess() == Access.ALLOW);
  }
}
