package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.IndexMappingVersionDAO;

@ExtendWith(MockitoExtension.class)
class IndexMappingVersionTrackerTest {

  @BeforeAll
  static void initLoader() throws IOException {
    try {
      IndexMappingLoader.getInstance();
    } catch (IllegalStateException e) {
      IndexMappingLoader.init();
    }
  }

  @AfterAll
  static void resetLoader() throws Exception {
    Field instanceField = IndexMappingLoader.class.getDeclaredField("instance");
    instanceField.setAccessible(true);
    instanceField.set(null, null);
  }

  @Mock private CollectionDAO collectionDAO;
  @Mock private IndexMappingVersionDAO indexMappingVersionDAO;
  @Mock private IndexMappingLoader indexMappingLoader;

  @Captor private ArgumentCaptor<String> entityTypeCaptor;
  @Captor private ArgumentCaptor<String> hashCaptor;
  @Captor private ArgumentCaptor<String> jsonCaptor;

  private static List<String> camelCaseEntities;

  private static List<String> getCamelCaseEntities() {
    if (camelCaseEntities == null) {
      camelCaseEntities =
          IndexMappingLoader.getInstance().getIndexMapping().keySet().stream()
              .filter(key -> key.chars().anyMatch(Character::isUpperCase))
              .toList();
    }
    return camelCaseEntities;
  }

  @BeforeEach
  void setUp() {
    org.mockito.Mockito.lenient()
        .when(collectionDAO.indexMappingVersionDAO())
        .thenReturn(indexMappingVersionDAO);
  }

  private IndexMapping buildMapping(String indexMappingFile) {
    return IndexMapping.builder().indexMappingFile(indexMappingFile).build();
  }

  private Map<String, IndexMapping> buildMappingsFromPairs(String... pairs) {
    Map<String, IndexMapping> mappings = new LinkedHashMap<>();
    for (int i = 0; i < pairs.length; i += 2) {
      mappings.put(pairs[i], buildMapping(pairs[i + 1]));
    }
    return mappings;
  }

  // --- Basic functionality tests ---

  @Test
  void updateMappingVersionsStoresOnlyMappedEntities() throws IOException {
    Map<String, IndexMapping> mappings =
        buildMappingsFromPairs("table", "/elasticsearch/%s/table_index_mapping.json");
    try (var loaderMock = mockStatic(IndexMappingLoader.class)) {
      loaderMock.when(IndexMappingLoader::getInstance).thenReturn(indexMappingLoader);
      when(indexMappingLoader.getIndexMapping()).thenReturn(mappings);

      new IndexMappingVersionTracker(collectionDAO, "1.2.3", "tester").updateMappingVersions();

      verify(indexMappingVersionDAO)
          .upsertIndexMappingVersion(
              eq("table"),
              hashCaptor.capture(),
              jsonCaptor.capture(),
              eq("1.2.3"),
              anyLong(),
              eq("tester"));
      assertFalse(hashCaptor.getValue().isBlank());
      assertTrue(jsonCaptor.getValue().contains("\"en\""));
    }
  }

  @Test
  void getChangedMappingsReturnsEntitiesWithStaleHashes() throws IOException {
    Map<String, IndexMapping> mappings =
        buildMappingsFromPairs("table", "/elasticsearch/%s/table_index_mapping.json");
    try (var loaderMock = mockStatic(IndexMappingLoader.class)) {
      loaderMock.when(IndexMappingLoader::getInstance).thenReturn(indexMappingLoader);
      when(indexMappingLoader.getIndexMapping()).thenReturn(mappings);
      when(indexMappingVersionDAO.getAllMappingVersions())
          .thenReturn(
              List.of(new IndexMappingVersionDAO.IndexMappingVersion("table", "stale-hash")));

      List<String> changedMappings =
          new IndexMappingVersionTracker(collectionDAO, "1.2.3", "tester").getChangedMappings();

      assertEquals(List.of("table"), changedMappings);
    }
  }

  @Test
  void getChangedMappingsReturnsEmptyWhenHashesMatch() throws IOException {
    Map<String, IndexMapping> mappings =
        buildMappingsFromPairs("table", "/elasticsearch/%s/table_index_mapping.json");
    try (var loaderMock = mockStatic(IndexMappingLoader.class)) {
      loaderMock.when(IndexMappingLoader::getInstance).thenReturn(indexMappingLoader);
      when(indexMappingLoader.getIndexMapping()).thenReturn(mappings);

      IndexMappingVersionTracker tracker =
          new IndexMappingVersionTracker(collectionDAO, "1.2.3", "tester");

      tracker.updateMappingVersions();
      verify(indexMappingVersionDAO)
          .upsertIndexMappingVersion(
              eq("table"), hashCaptor.capture(), anyString(), eq("1.2.3"), anyLong(), eq("tester"));

      when(indexMappingVersionDAO.getAllMappingVersions())
          .thenReturn(
              List.of(
                  new IndexMappingVersionDAO.IndexMappingVersion("table", hashCaptor.getValue())));

      assertTrue(tracker.getChangedMappings().isEmpty());
    }
  }

  @Test
  void getChangedMappingsDetectsNewEntitiesNotInStoredHashes() throws IOException {
    Map<String, IndexMapping> mappings =
        buildMappingsFromPairs(
            "table", "/elasticsearch/%s/table_index_mapping.json",
            "glossaryTerm", "/elasticsearch/%s/glossary_term_index_mapping.json");
    try (var loaderMock = mockStatic(IndexMappingLoader.class)) {
      loaderMock.when(IndexMappingLoader::getInstance).thenReturn(indexMappingLoader);
      when(indexMappingLoader.getIndexMapping()).thenReturn(mappings);

      // Store hash only for table — glossaryTerm is "new"
      IndexMappingVersionTracker tracker =
          new IndexMappingVersionTracker(collectionDAO, "1.2.3", "tester");
      tracker.updateMappingVersions();
      verify(indexMappingVersionDAO)
          .upsertIndexMappingVersion(
              eq("table"), hashCaptor.capture(), anyString(), anyString(), anyLong(), anyString());

      when(indexMappingVersionDAO.getAllMappingVersions())
          .thenReturn(
              List.of(
                  new IndexMappingVersionDAO.IndexMappingVersion("table", hashCaptor.getValue())));

      List<String> changed = tracker.getChangedMappings();
      assertEquals(List.of("glossaryTerm"), changed);
    }
  }

  // --- CamelCase entity type tests (the core regression) ---

  @Test
  void getChangedMappingsIncludesCamelCaseEntityTypes() throws IOException {
    Map<String, IndexMapping> mappings =
        buildMappingsFromPairs(
            "glossaryTerm", "/elasticsearch/%s/glossary_term_index_mapping.json");
    try (var loaderMock = mockStatic(IndexMappingLoader.class)) {
      loaderMock.when(IndexMappingLoader::getInstance).thenReturn(indexMappingLoader);
      when(indexMappingLoader.getIndexMapping()).thenReturn(mappings);
      when(indexMappingVersionDAO.getAllMappingVersions()).thenReturn(List.of());

      List<String> changedMappings =
          new IndexMappingVersionTracker(collectionDAO, "1.2.3", "tester").getChangedMappings();

      assertEquals(List.of("glossaryTerm"), changedMappings);
    }
  }

  @Test
  void updateMappingVersionsStoresCamelCaseEntities() throws IOException {
    Map<String, IndexMapping> mappings =
        buildMappingsFromPairs(
            "glossaryTerm", "/elasticsearch/%s/glossary_term_index_mapping.json",
            "databaseSchema", "/elasticsearch/%s/database_schema_index_mapping.json",
            "storedProcedure", "/elasticsearch/%s/stored_procedure_index_mapping.json");
    try (var loaderMock = mockStatic(IndexMappingLoader.class)) {
      loaderMock.when(IndexMappingLoader::getInstance).thenReturn(indexMappingLoader);
      when(indexMappingLoader.getIndexMapping()).thenReturn(mappings);

      new IndexMappingVersionTracker(collectionDAO, "1.2.3", "tester").updateMappingVersions();

      verify(indexMappingVersionDAO, times(3))
          .upsertIndexMappingVersion(
              entityTypeCaptor.capture(),
              anyString(),
              anyString(),
              eq("1.2.3"),
              anyLong(),
              eq("tester"));

      Set<String> storedTypes = new TreeSet<>(entityTypeCaptor.getAllValues());
      assertEquals(Set.of("databaseSchema", "glossaryTerm", "storedProcedure"), storedTypes);
    }
  }

  @Test
  void mixedSingleWordAndCamelCaseEntitiesAllDetected() throws IOException {
    Map<String, IndexMapping> mappings =
        buildMappingsFromPairs(
            "table", "/elasticsearch/%s/table_index_mapping.json",
            "glossaryTerm", "/elasticsearch/%s/glossary_term_index_mapping.json",
            "databaseSchema", "/elasticsearch/%s/database_schema_index_mapping.json",
            "domain", "/elasticsearch/%s/domain_index_mapping.json",
            "testCase", "/elasticsearch/%s/test_case_index_mapping.json");
    try (var loaderMock = mockStatic(IndexMappingLoader.class)) {
      loaderMock.when(IndexMappingLoader::getInstance).thenReturn(indexMappingLoader);
      when(indexMappingLoader.getIndexMapping()).thenReturn(mappings);
      when(indexMappingVersionDAO.getAllMappingVersions()).thenReturn(List.of());

      List<String> changed =
          new IndexMappingVersionTracker(collectionDAO, "1.2.3", "tester").getChangedMappings();

      Set<String> changedSet = new TreeSet<>(changed);
      assertEquals(
          Set.of("databaseSchema", "domain", "glossaryTerm", "table", "testCase"), changedSet);
    }
  }

  // --- Integration test using real indexMapping.json files from classpath ---

  @Test
  void allEntityTypesInIndexMappingJsonHaveResolvableMappingFiles() throws IOException {
    // Load the real IndexMappingLoader to get all entity types and their file paths
    // This ensures that if someone adds a new entity to indexMapping.json,
    // the tracker will be able to find its mapping files
    IndexMappingLoader realLoader = IndexMappingLoader.getInstance();
    Map<String, IndexMapping> realMappings = realLoader.getIndexMapping();

    assertFalse(realMappings.isEmpty(), "indexMapping.json should not be empty");

    List<String> missingMappings = new ArrayList<>();
    String[] languages = {"en", "jp", "ru", "zh"};

    for (Map.Entry<String, IndexMapping> entry : realMappings.entrySet()) {
      String entityType = entry.getKey();
      IndexMapping mapping = entry.getValue();
      boolean foundAnyLanguage = false;

      for (String lang : languages) {
        String path = "/" + mapping.getIndexMappingFile(lang);
        try (InputStream stream = getClass().getResourceAsStream(path)) {
          if (stream != null) {
            foundAnyLanguage = true;
            break;
          }
        }
      }

      if (!foundAnyLanguage) {
        missingMappings.add(entityType);
      }
    }

    assertTrue(
        missingMappings.isEmpty(),
        "These entity types in indexMapping.json have no resolvable mapping files: "
            + missingMappings
            + ". Ensure the indexMappingFile path in indexMapping.json matches the actual file name.");
  }

  @Test
  void smartReindexDetectsAllEntityTypesFromIndexMappingJson() throws IOException {
    // Use the real IndexMappingLoader — this is the critical integration test that
    // would have caught the original toLowerCase() bug
    IndexMappingLoader realLoader = IndexMappingLoader.getInstance();
    Map<String, IndexMapping> realMappings = realLoader.getIndexMapping();

    try (var loaderMock = mockStatic(IndexMappingLoader.class)) {
      loaderMock.when(IndexMappingLoader::getInstance).thenReturn(realLoader);
      when(indexMappingVersionDAO.getAllMappingVersions()).thenReturn(List.of());

      List<String> changed =
          new IndexMappingVersionTracker(collectionDAO, "1.2.3", "tester").getChangedMappings();

      // Every entity in indexMapping.json that exposes a resolvable "en" mapping file should be
      // detected
      Map<String, IndexMapping> entitiesWithLangMappings = new HashMap<>();
      for (Map.Entry<String, IndexMapping> entry : realMappings.entrySet()) {
        String path = "/" + entry.getValue().getIndexMappingFile("en");
        try (InputStream stream = getClass().getResourceAsStream(path)) {
          if (stream != null) {
            entitiesWithLangMappings.put(entry.getKey(), entry.getValue());
          }
        }
      }

      Set<String> changedSet = new TreeSet<>(changed);
      Set<String> expectedSet = new TreeSet<>(entitiesWithLangMappings.keySet());

      assertEquals(
          expectedSet,
          changedSet,
          "Smart reindex must detect ALL entity types from indexMapping.json. Missing: "
              + diff(expectedSet, changedSet));
    }
  }

  @Test
  void smartReindexDetectsAllKnownCamelCaseEntities() throws IOException {
    // Explicit regression test: every known camelCase entity must be detected.
    // This test would have directly caught the original toLowerCase() bug.
    IndexMappingLoader realLoader = IndexMappingLoader.getInstance();
    Map<String, IndexMapping> realMappings = realLoader.getIndexMapping();

    try (var loaderMock = mockStatic(IndexMappingLoader.class)) {
      loaderMock.when(IndexMappingLoader::getInstance).thenReturn(realLoader);
      when(indexMappingVersionDAO.getAllMappingVersions()).thenReturn(List.of());

      List<String> changed =
          new IndexMappingVersionTracker(collectionDAO, "1.2.3", "tester").getChangedMappings();
      Set<String> changedSet = new TreeSet<>(changed);

      List<String> missedCamelCase = new ArrayList<>();
      for (String entity : getCamelCaseEntities()) {
        if (realMappings.containsKey(entity) && !changedSet.contains(entity)) {
          missedCamelCase.add(entity);
        }
      }

      assertTrue(
          missedCamelCase.isEmpty(),
          "Smart reindex MISSED these camelCase entity types (the original bug): "
              + missedCamelCase);
    }
  }

  @Test
  void hashesAreStableAcrossMultipleComputations() throws IOException {
    // Verify that running getChangedMappings + updateMappingVersions + getChangedMappings
    // results in no changes the second time — proves hash stability
    Map<String, IndexMapping> mappings =
        buildMappingsFromPairs(
            "table", "/elasticsearch/%s/table_index_mapping.json",
            "glossaryTerm", "/elasticsearch/%s/glossary_term_index_mapping.json");

    try (var loaderMock = mockStatic(IndexMappingLoader.class)) {
      loaderMock.when(IndexMappingLoader::getInstance).thenReturn(indexMappingLoader);
      when(indexMappingLoader.getIndexMapping()).thenReturn(mappings);

      IndexMappingVersionTracker tracker =
          new IndexMappingVersionTracker(collectionDAO, "1.2.3", "tester");

      // First run: everything is new
      when(indexMappingVersionDAO.getAllMappingVersions()).thenReturn(List.of());
      List<String> firstRun = tracker.getChangedMappings();
      assertEquals(2, firstRun.size());

      // Simulate storing hashes
      tracker.updateMappingVersions();
      verify(indexMappingVersionDAO, times(2))
          .upsertIndexMappingVersion(
              entityTypeCaptor.capture(),
              hashCaptor.capture(),
              anyString(),
              anyString(),
              anyLong(),
              anyString());

      // Build stored versions from captured values
      List<IndexMappingVersionDAO.IndexMappingVersion> storedVersions = new ArrayList<>();
      List<String> capturedTypes = entityTypeCaptor.getAllValues();
      List<String> capturedHashes = hashCaptor.getAllValues();
      for (int i = 0; i < capturedTypes.size(); i++) {
        storedVersions.add(
            new IndexMappingVersionDAO.IndexMappingVersion(
                capturedTypes.get(i), capturedHashes.get(i)));
      }

      // Second run: nothing should have changed
      when(indexMappingVersionDAO.getAllMappingVersions()).thenReturn(storedVersions);
      List<String> secondRun = tracker.getChangedMappings();
      assertTrue(
          secondRun.isEmpty(), "Hashes should be stable — no changes expected on second run");
    }
  }

  private static Set<String> diff(Set<String> expected, Set<String> actual) {
    Set<String> missing = new TreeSet<>(expected);
    missing.removeAll(actual);
    return missing;
  }
}
