package org.openmetadata.service.workflows.interfaces;

import org.openmetadata.schema.type.EntityReference;

public record TaggedOperation<T>(T operation, EntityReference entityRef) {}
