package org.openmetadata.service.entity.history;

import org.openmetadata.schema.EntityInterface;

public record EntityHistoryType<T extends EntityInterface>(
    String name, Class<T> entityClass, String tableName) {}
