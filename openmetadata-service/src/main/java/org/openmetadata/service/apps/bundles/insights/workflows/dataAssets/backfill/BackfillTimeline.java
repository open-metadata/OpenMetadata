package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.backfill;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

public record BackfillTimeline(
    Map<UUID, List<VersionRecord>> versionTimeline,
    Map<LocalDate, Set<UUID>> creationsPerDay) {}
