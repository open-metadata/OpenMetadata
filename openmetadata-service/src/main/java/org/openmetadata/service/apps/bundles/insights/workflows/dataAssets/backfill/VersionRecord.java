package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.backfill;

import java.util.UUID;

public record VersionRecord(UUID entityId, String extensionKey, Long updatedAt) {}
