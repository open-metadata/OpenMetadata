package org.openmetadata.service.search.vector.utils;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.service.search.OntologyTermSearch;

/**
 * The entity types whose documents get vector embeddings. This is the write path: the bulk sinks,
 * {@code VectorEmbeddingHandler} and the staged chunk recreate only embed these types.
 *
 * <ul>
 *   <li>{@link #ALL}: every embedded type.
 *   <li>{@link #DATA_ASSETS}: the embedded types that are data assets. Their indexes are exactly
 *       the members of the {@code dataAssetEmbeddings} alias in {@code indexMapping.json}, which
 *       vector and hybrid search read, and their chunks go to the data-asset chunk index.
 * </ul>
 *
 * <p>Ontology terms are embedded too, but they are searched through their own {@code
 * ontologyTerms} alias, so they are in {@link #ALL} and not in {@link #DATA_ASSETS}.
 *
 * <p>Every type in {@link #ALL} also needs the {@code fingerprint} and chunk fields in its index
 * mapping file: a type embedded without them can never be found. {@code
 * EmbeddedEntityTypesConsistencyTest} pins both rules. Names keep the casing of the {@code Entity}
 * constants and the {@code indexMapping.json} keys ({@code glossaryTerm}); {@link
 * #isEmbedded(String)} and {@link #isDataAsset(String)} ignore case.
 */
public final class EmbeddedEntityTypes {

  public static final List<String> ALL =
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
          "domain",
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
          "query",
          "ontologyConcept",
          "ontologyProperty",
          // AI Governance Studio assets. The execution types (agentExecution, mcpExecution) and the
          // framework/report leaves are deliberately excluded: they are drill-downs reached from a
          // parent, not things a user searches for by name.
          "llmModel",
          "aiApplication",
          "promptTemplate",
          "mcpServer",
          "aiGovernancePolicy",
          "aiGovernanceFramework");

  public static final List<String> DATA_ASSETS =
      ALL.stream().filter(type -> !OntologyTermSearch.isTerm(type)).toList();

  private static final Set<String> ALL_LOWERCASE = lowercase(ALL);
  private static final Set<String> DATA_ASSETS_LOWERCASE = lowercase(DATA_ASSETS);

  private EmbeddedEntityTypes() {}

  public static boolean isEmbedded(String entityType) {
    return containsIgnoringCase(ALL_LOWERCASE, entityType);
  }

  public static boolean isDataAsset(String entityType) {
    return containsIgnoringCase(DATA_ASSETS_LOWERCASE, entityType);
  }

  private static boolean containsIgnoringCase(Set<String> lowercaseTypes, String entityType) {
    return entityType != null && lowercaseTypes.contains(entityType.toLowerCase(Locale.ROOT));
  }

  private static Set<String> lowercase(List<String> types) {
    return types.stream()
        .map(type -> type.toLowerCase(Locale.ROOT))
        .collect(Collectors.toUnmodifiableSet());
  }
}
