package org.openmetadata.service.entity.write;

public record EntityCommandActor(String user, String impersonatedBy) {}
