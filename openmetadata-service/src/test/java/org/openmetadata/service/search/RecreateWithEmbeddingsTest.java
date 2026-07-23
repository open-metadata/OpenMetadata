package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.vector.utils.AvailableEntityTypes;

class RecreateWithEmbeddingsTest {

  @Test
  void coversAllVectorTypes_matchesCanonicalCamelCaseNames() {
    // Regression: the reindex job carries canonical camelCase entity names ("glossaryTerm"),
    // while AvailableEntityTypes.SET is lowercased — a case-sensitive containsAll never matched,
    // so the chunk-index recreate silently never fired on a full run.
    Set<String> canonicalNames = new HashSet<>(AvailableEntityTypes.LIST);
    assertTrue(RecreateWithEmbeddings.coversAllVectorTypes(canonicalNames));
  }

  @Test
  void coversAllVectorTypes_matchesLowercasedNames() {
    Set<String> lowercased =
        AvailableEntityTypes.LIST.stream()
            .map(s -> s.toLowerCase(Locale.ROOT))
            .collect(Collectors.toSet());
    assertTrue(RecreateWithEmbeddings.coversAllVectorTypes(lowercased));
  }

  @Test
  void coversAllVectorTypes_falseWhenAnyTypeMissing() {
    Set<String> missingOne = new HashSet<>(AvailableEntityTypes.LIST);
    missingOne.remove("glossaryTerm");
    assertFalse(
        RecreateWithEmbeddings.coversAllVectorTypes(missingOne),
        "a partial recreate must never drop the chunk index");
  }

  @Test
  void coversAllVectorTypes_trueForSupersets() {
    Set<String> superset = new HashSet<>(AvailableEntityTypes.LIST);
    superset.add("user");
    superset.add("team");
    assertTrue(RecreateWithEmbeddings.coversAllVectorTypes(superset));
  }
}
