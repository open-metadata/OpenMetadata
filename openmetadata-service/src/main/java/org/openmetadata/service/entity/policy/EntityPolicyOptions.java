package org.openmetadata.service.entity.policy;

import lombok.Getter;
import lombok.Setter;

/**
 * Entity policies may configure these options during startup, before serving requests.
 */
@Getter
@Setter
public final class EntityPolicyOptions {

  private boolean descendantsCoveredByAncestorCascade;

  private boolean quoteFqn;

  private boolean renameAllowed;

  private boolean supportsSearch;
}
