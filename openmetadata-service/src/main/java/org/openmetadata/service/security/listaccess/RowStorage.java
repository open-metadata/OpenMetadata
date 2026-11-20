package org.openmetadata.service.security.listaccess;

/** Where one entity type's rows are stored, and how SQL finds each of their effective values. */
public record RowStorage(
    String entityType,
    String table,
    String hashColumn,
    ValueSource owners,
    ValueSource domains,
    ValueSource reviewers,
    boolean supportsTags) {}
