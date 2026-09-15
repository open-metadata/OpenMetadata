package org.openmetadata.service.entity.write;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.change.ChangeSource;

/** Prepared caller identities and mode, retained across retries of one update. */
public record EntityUpdateRequest<T extends EntityInterface>(
    T original,
    T updated,
    EntityOperation operation,
    ChangeSource changeSource,
    boolean optimistic) {}
