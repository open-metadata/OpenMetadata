package org.openmetadata.service.context;

import jakarta.ws.rs.core.SecurityContext;
import java.util.Optional;
import org.openmetadata.schema.type.EntityReference;

/** Resolves an entity reference into prompt-ready structured context. */
@FunctionalInterface
interface ContextEntityPromptLoader {
  Optional<ResolvedContextEntity> load(SecurityContext securityContext, EntityReference reference);
}
