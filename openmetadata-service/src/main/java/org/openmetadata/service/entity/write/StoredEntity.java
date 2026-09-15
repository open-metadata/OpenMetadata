package org.openmetadata.service.entity.write;

import java.util.UUID;

/** Canonical row bytes and identity produced by a successful SQL write. */
public record StoredEntity(UUID id, String fullyQualifiedName, String json) {}
