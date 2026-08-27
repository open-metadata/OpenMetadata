package org.openmetadata.service.search.vector.utils;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Entity types whose documents carry vector embeddings. This is the write-path source of truth:
 * the bulk sink, {@code VectorEmbeddingHandler}, and the staged chunk recreate all gate on it. It
 * must stay in lockstep with the {@code dataAssetEmbeddings} members in {@code indexMapping.json}
 * (the read-path alias) and with the {@code fingerprint}/chunk fields in each type's index mapping
 * file — a type listed here but missing from either is embedded and then unsearchable. {@code
 * AvailableEntityTypesConsistencyTest} pins all three together.
 */
public final class AvailableEntityTypes {
  private AvailableEntityTypes() {}

  public static final List<String> LIST =
      List.of(
          "table",
          "glossary",
          "glossaryTerm",
          "chart",
          "dashboard",
          "dashboardDataModel",
          "database",
          "databaseSchema",
          "dataProduct",
          "pipeline",
          "mlmodel",
          "metric",
          "apiEndpoint",
          "apiCollection",
          "page",
          "storedProcedure",
          "searchIndex",
          "topic",
          "contextMemory",
          "container",
          "testSuite",
          "testCase",
          // AI Governance Studio assets. The execution types (agentExecution, mcpExecution) and the
          // framework/report leaves are deliberately excluded: they are drill-downs reached from a
          // parent, not things a user searches for by name.
          "llmModel",
          "aiApplication",
          "promptTemplate",
          "mcpServer",
          "aiGovernancePolicy",
          "aiGovernanceFramework");

  public static final Set<String> SET =
      LIST.stream().map(s -> s.toLowerCase(Locale.ROOT)).collect(Collectors.toUnmodifiableSet());

  public static boolean isVectorIndexable(String entityType) {
    return entityType != null && SET.contains(entityType.toLowerCase(Locale.ROOT));
  }
}
