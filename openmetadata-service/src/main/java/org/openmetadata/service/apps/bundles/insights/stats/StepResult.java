package org.openmetadata.service.apps.bundles.insights.stats;

import java.util.List;

public record StepResult(String stepName, int successCount, int failedCount, List<String> errors) {}
