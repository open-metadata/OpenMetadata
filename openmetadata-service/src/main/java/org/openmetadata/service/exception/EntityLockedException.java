package org.openmetadata.service.exception;

import jakarta.ws.rs.core.Response;
import org.openmetadata.sdk.exception.WebServiceException;

/**
 * Exception thrown when an entity operation is blocked due to an active deletion lock
 * on the entity or its parent.
 */
public class EntityLockedException extends WebServiceException {
  
  private static final String ERROR_TYPE = "ENTITY_LOCKED";
  
  public EntityLockedException(String message) {
    super(Response.Status.CONFLICT, ERROR_TYPE, message);
  }
  
  public EntityLockedException(String message, Throwable cause) {
    super(Response.Status.CONFLICT, ERROR_TYPE, message, cause);
  }
  
  public static EntityLockedException byMessage(String entityType, String entityName, String reason) {
    return new EntityLockedException(
        String.format("Cannot modify %s '%s': %s", entityType, entityName, reason)
    );
  }
  
  public static EntityLockedException parentBeingDeleted(String entityFqn, String parentFqn) {
    return new EntityLockedException(
        String.format("Cannot create or modify entity '%s' because parent '%s' is being deleted", 
                      entityFqn, parentFqn)
    );
  }
}