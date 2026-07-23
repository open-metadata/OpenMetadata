package org.openmetadata.service.context;

import org.openmetadata.schema.type.EntityReference;

/** Canonical prompt-ready representation of a context entity. */
record ResolvedContextEntity(
    EntityReference reference,
    String label,
    String title,
    String location,
    String summary,
    String body) {}
