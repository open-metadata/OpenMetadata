/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 *  CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language
 *  governing permissions and limitations under the License.
 */
package org.openmetadata.service.search.fitness;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.search.SearchRepository;

/**
 * Reproduces and guards the reindex double-count defect in {@link SearchClusterFitnessAnalyzer}.
 *
 * <p>During a reindex the canonical entity exists as two physical indices simultaneously — the
 * live/serving index (still aliased) and a staged {@code <canon>_rebuild_<digits>} sibling. Before
 * the fix, {@code collectIndexFootprints} admitted both and {@code sumPrimaryBytes}/{@code
 * sumDocs} added both, inflating {@code totalPrimarySizeBytes} for the reindex window — up to
 * &times;2 at build parity — and flipping {@link SizingGuidance#getVerdict()} from {@code ADEQUATE}
 * to {@code UNDERSIZED} for clusters sized exactly to the recommendation.
 *
 * <p>These tests exercise the private collection/summation/sizing methods via reflection (the same
 * pattern as {@code SearchClusterMetricsTest}) because the public {@code analyze()} entry point
 * requires a live cluster through {@link org.openmetadata.service.search.fitness.SearchRestProbe}.
 */
@DisplayName("SearchClusterFitnessAnalyzer reindex de-duplication")
class SearchClusterFitnessReindexReproTest {

  private static final long GIB = 1024L * 1024 * 1024;
  private static final long HUNDRED_GIB = 100L * GIB;
  private static final long SIXTEEN_GIB = 16L * GIB;
  private static final long TEN_GIB = 10L * GIB;
  private static final long FIVE_GIB = 5L * GIB;

  @BeforeAll
  static void initLoader() throws IOException {
    // The analyzer derives canonical OM index names from IndexMappingLoader; load the real
    // classpath mapping (elasticsearch/indexMapping.json) so canonical/alias sets are populated.
    try {
      IndexMappingLoader.getInstance();
    } catch (IllegalStateException e) {
      IndexMappingLoader.init();
    }
  }

  private SearchClusterFitnessAnalyzer newAnalyzer() {
    SearchRepository repo = mock(SearchRepository.class);
    // The constructor only fetches the search client to build a (here unused) probe. An unstubbed
    // Mockito mock returns null for object-returning methods, and these tests never call
    // analyze() / probe.get(), so no stubbing is required.
    return new SearchClusterFitnessAnalyzer(repo);
  }

  // ----------------------------------------------------------------------------------------------
  // Reflection helpers — invoke the analyzer's private collection/summation/sizing methods.
  // ----------------------------------------------------------------------------------------------

  @SuppressWarnings("unchecked")
  private List<IndexFootprint> collectIndexFootprints(JsonNode catIndices, JsonNode catAliases)
      throws Exception {
    Method m =
        SearchClusterFitnessAnalyzer.class.getDeclaredMethod(
            "collectIndexFootprints", JsonNode.class, JsonNode.class, String.class, List.class);
    m.setAccessible(true);
    return (List<IndexFootprint>)
        m.invoke(newAnalyzer(), catIndices, catAliases, "", new ArrayList<String>());
  }

  private long sumPrimaryBytes(List<IndexFootprint> indices) throws Exception {
    Method m = SearchClusterFitnessAnalyzer.class.getDeclaredMethod("sumPrimaryBytes", List.class);
    m.setAccessible(true);
    return (long) m.invoke(newAnalyzer(), indices);
  }

  private long sumDocs(List<IndexFootprint> indices) throws Exception {
    Method m = SearchClusterFitnessAnalyzer.class.getDeclaredMethod("sumDocs", List.class);
    m.setAccessible(true);
    return (long) m.invoke(newAnalyzer(), indices);
  }

  @SuppressWarnings("unchecked")
  private List<IndexFootprint> collapseRebuildSiblings(
      List<IndexFootprint> raw, Set<String> indicesWithOmAlias) throws Exception {
    Method m =
        SearchClusterFitnessAnalyzer.class.getDeclaredMethod(
            "collapseRebuildSiblings", List.class, Set.class);
    m.setAccessible(true);
    return (List<IndexFootprint>) m.invoke(newAnalyzer(), raw, indicesWithOmAlias);
  }

  private String stripRebuildSuffix(String name) throws Exception {
    Method m =
        SearchClusterFitnessAnalyzer.class.getDeclaredMethod("stripRebuildSuffix", String.class);
    m.setAccessible(true);
    return (String) m.invoke(newAnalyzer(), name);
  }

  private SizingGuidance buildSizingGuidance(
      SearchClusterFitnessReport report,
      List<NodeFootprint> nodes,
      long totalPrimaryBytes,
      long totalDocs,
      boolean omIndicesMissing)
      throws Exception {
    Method m =
        SearchClusterFitnessAnalyzer.class.getDeclaredMethod(
            "buildSizingGuidance",
            SearchClusterFitnessReport.class,
            List.class,
            long.class,
            long.class,
            boolean.class);
    m.setAccessible(true);
    return (SizingGuidance)
        m.invoke(newAnalyzer(), report, nodes, totalPrimaryBytes, totalDocs, omIndicesMissing);
  }

  // ----------------------------------------------------------------------------------------------
  // JSON fixture helpers. _cat/indices?format=json&bytes=b returns string-typed numeric columns,
  // which the analyzer parses via parseLong(text(...)). Aliases map an alias name to a backing
  // physical index; indicesCarryingOmAlias keeps any backing index whose alias is an OM alias.
  // ----------------------------------------------------------------------------------------------

  private JsonNode catIndices(String... indexRows) {
    return JsonUtils.readTree("[" + String.join(",", indexRows) + "]");
  }

  private JsonNode catAliases(String... aliasRows) {
    return JsonUtils.readTree("[" + String.join(",", aliasRows) + "]");
  }

  private String indexRow(String name, long docs, long primaryBytes, long totalBytes) {
    return String.format(
        "{\"index\":\"%s\",\"docs.count\":\"%d\",\"pri.store.size\":\"%d\","
            + "\"store.size\":\"%d\",\"pri\":\"1\",\"rep\":\"1\",\"health\":\"green\"}",
        name, docs, primaryBytes, totalBytes);
  }

  private String aliasRow(String alias, String index) {
    return String.format("{\"alias\":\"%s\",\"index\":\"%s\"}", alias, index);
  }

  private IndexFootprint footprint(String name, long docs, long primaryBytes) {
    return IndexFootprint.builder()
        .indexName(name)
        .docsCount(docs)
        .primarySizeBytes(primaryBytes)
        .totalSizeBytes(primaryBytes * 2)
        .primaryShards(1)
        .replicaShards(1)
        .avgDocBytes(docs > 0 ? primaryBytes / docs : null)
        .health("green")
        .build();
  }

  private List<NodeFootprint> dataNodes(int count, long heapBytesEach) {
    List<NodeFootprint> nodes = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      nodes.add(
          NodeFootprint.builder()
              .name("node-" + i)
              .roles(List.of("data"))
              .heapMaxBytes(heapBytesEach)
              .build());
    }
    return nodes;
  }

  // ==============================================================================================
  // stripRebuildSuffix — the canonical-key derivation that drives the de-dup.
  // ==============================================================================================
  @Nested
  @DisplayName("stripRebuildSuffix derives the logical canonical name")
  class StripRebuildSuffix {

    @Test
    @DisplayName("plain canonical name is unchanged")
    void plainCanonicalNameUnchanged() throws Exception {
      assertEquals("table_search_index", stripRebuildSuffix("table_search_index"));
    }

    @Test
    @DisplayName("first-install staged sibling collapses to canonical name")
    void firstInstallStagedCollapses() throws Exception {
      assertEquals(
          "table_search_index", stripRebuildSuffix("table_search_index_rebuild_1735680000000"));
    }

    @Test
    @DisplayName("steady-state live + staged rebuild siblings both collapse to the same canonical")
    void steadyStateRebuildSiblingsCollapseToSameCanonical() throws Exception {
      String live = stripRebuildSuffix("table_search_index_rebuild_1732000000000");
      String staged = stripRebuildSuffix("table_search_index_rebuild_1735680000000");
      assertEquals("table_search_index", live);
      assertEquals("table_search_index", staged);
      assertEquals(live, staged);
    }

    @Test
    @DisplayName("cluster-aliased canonical name collapses correctly")
    void clusterAliasedNameCollapses() throws Exception {
      assertEquals(
          "openmetadata_table_search_index",
          stripRebuildSuffix("openmetadata_table_search_index_rebuild_1732000000000"));
    }

    @Test
    @DisplayName("non-numeric rebuild suffix is not stripped (prevents false collapse)")
    void nonNumericSuffixNotStripped() throws Exception {
      assertEquals(
          "table_search_index_rebuild_notadigit",
          stripRebuildSuffix("table_search_index_rebuild_notadigit"));
    }

    @Test
    @DisplayName("empty rebuild suffix is not stripped")
    void emptySuffixNotStripped() throws Exception {
      assertEquals(
          "table_search_index_rebuild_", stripRebuildSuffix("table_search_index_rebuild_"));
    }

    @Test
    @DisplayName("null name returns null")
    void nullNameReturnsNull() throws Exception {
      assertEquals(null, stripRebuildSuffix(null));
    }

    @Test
    @DisplayName("name without _rebuild_ substring is unchanged (e.g. data-insight '-' indices)")
    void noRebuildSubstringUnchanged() throws Exception {
      assertEquals(
          "openmetadata-di-data-assets-foo", stripRebuildSuffix("openmetadata-di-data-assets-foo"));
    }
  }

  // ==============================================================================================
  // collapseRebuildSiblings — the de-dup logic, exercised in isolation.
  // ==============================================================================================
  @Nested
  @DisplayName("collapseRebuildSiblings de-duplicates rebuild siblings")
  class CollapseRebuildSiblings {

    @Test
    @DisplayName("steady state: keeps the alias-carrying live sibling, drops the staged one")
    void steadyStateKeepsAliasedLive() throws Exception {
      String live = "table_search_index_rebuild_1732000000000";
      String staged = "table_search_index_rebuild_1735680000000";
      Set<String> aliased = new HashSet<>(Set.of(live));

      List<IndexFootprint> result =
          collapseRebuildSiblings(
              List.of(footprint(live, 50000, HUNDRED_GIB), footprint(staged, 0, HUNDRED_GIB)),
              aliased);

      assertEquals(1, result.size());
      assertEquals(live, result.get(0).getIndexName());
      assertEquals(HUNDRED_GIB, result.get(0).getPrimarySizeBytes());
    }

    @Test
    @DisplayName("steady state: alias preference is order-independent (staged listed first)")
    void steadyStateAliasPreferenceOrderIndependent() throws Exception {
      String live = "table_search_index_rebuild_1732000000000";
      String staged = "table_search_index_rebuild_1735680000000";
      Set<String> aliased = new HashSet<>(Set.of(live));

      List<IndexFootprint> result =
          collapseRebuildSiblings(
              List.of(footprint(staged, 0, HUNDRED_GIB), footprint(live, 50000, HUNDRED_GIB)),
              aliased);

      assertEquals(1, result.size());
      assertEquals(live, result.get(0).getIndexName());
    }

    @Test
    @DisplayName("first install: keeps aliased canonical index, drops staged rebuild sibling")
    void firstInstallKeepsAliasedCanonical() throws Exception {
      String live = "table_search_index";
      String staged = "table_search_index_rebuild_1735680000000";
      Set<String> aliased = new HashSet<>(Set.of(live));

      List<IndexFootprint> result =
          collapseRebuildSiblings(
              List.of(footprint(live, 50000, HUNDRED_GIB), footprint(staged, 0, HUNDRED_GIB)),
              aliased);

      assertEquals(1, result.size());
      assertEquals(live, result.get(0).getIndexName());
    }

    @Test
    @DisplayName("no alias info available: keeps larger primary bytes (conservative over-sizing)")
    void noAliasInfoKeepsLarger() throws Exception {
      String live = "table_search_index_rebuild_1732000000000";
      String staged = "table_search_index_rebuild_1735680000000";
      Set<String> aliased = new HashSet<>();

      // Staged sibling at 60% build progress is smaller than the live index.
      List<IndexFootprint> result =
          collapseRebuildSiblings(
              List.of(footprint(staged, 0, 60L * GIB), footprint(live, 50000, HUNDRED_GIB)),
              aliased);

      assertEquals(1, result.size());
      assertEquals(live, result.get(0).getIndexName());
      assertEquals(HUNDRED_GIB, result.get(0).getPrimarySizeBytes());
    }

    @Test
    @DisplayName("no alias info: when staged already exceeds live, keeps staged (deterministic)")
    void noAliasInfoKeepsLargerEvenIfStaged() throws Exception {
      String live = "table_search_index_rebuild_1732000000000";
      String staged = "table_search_index_rebuild_1735680000000";
      Set<String> aliased = new HashSet<>();

      List<IndexFootprint> result =
          collapseRebuildSiblings(
              List.of(footprint(live, 50000, HUNDRED_GIB), footprint(staged, 0, 150L * GIB)),
              aliased);

      assertEquals(1, result.size());
      assertEquals(staged, result.get(0).getIndexName());
      assertEquals(150L * GIB, result.get(0).getPrimarySizeBytes());
    }

    @Test
    @DisplayName("no rebuild siblings present: every canonical index is kept (no false collapse)")
    void noRebuildSiblingsNoCollapse() throws Exception {
      Set<String> aliased = new HashSet<>(Set.of("table_search_index", "user_search_index"));
      List<IndexFootprint> input =
          List.of(
              footprint("table_search_index", 50000, HUNDRED_GIB),
              footprint("user_search_index", 1000, GIB));

      List<IndexFootprint> result = collapseRebuildSiblings(input, aliased);

      assertEquals(2, result.size());
      Set<String> kept = new HashSet<>();
      result.forEach(f -> kept.add(f.getIndexName()));
      assertTrue(kept.contains("table_search_index"));
      assertTrue(kept.contains("user_search_index"));
    }

    @Test
    @DisplayName("single entry passes through unchanged")
    void singleEntryUnchanged() throws Exception {
      List<IndexFootprint> result =
          collapseRebuildSiblings(
              List.of(footprint("table_search_index", 50000, HUNDRED_GIB)), new HashSet<>());
      assertEquals(1, result.size());
      assertEquals("table_search_index", result.get(0).getIndexName());
    }

    @Test
    @DisplayName("empty list passes through unchanged")
    void emptyListUnchanged() throws Exception {
      List<IndexFootprint> result = collapseRebuildSiblings(new ArrayList<>(), new HashSet<>());
      assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("multiple canonical indices with mixed reindex state dedup independently")
    void multipleCanonicalMixedReindexState() throws Exception {
      Set<String> aliased =
          new HashSet<>(
              Set.of(
                  "table_search_index_rebuild_1732000000000", // table live (reindexing)
                  "user_search_index" // user steady (no reindex)
                  ));
      List<IndexFootprint> input =
          List.of(
              footprint("table_search_index_rebuild_1732000000000", 50000, HUNDRED_GIB),
              footprint("table_search_index_rebuild_1735680000000", 0, HUNDRED_GIB),
              footprint("user_search_index", 1000, GIB));

      List<IndexFootprint> result = collapseRebuildSiblings(input, aliased);

      assertEquals(2, result.size());
      Set<String> kept = new HashSet<>();
      result.forEach(f -> kept.add(f.getIndexName()));
      assertTrue(kept.contains("table_search_index_rebuild_1732000000000"));
      assertTrue(kept.contains("user_search_index"));
      // The staged table sibling must NOT be among the kept footprints.
      assertTrue(!kept.contains("table_search_index_rebuild_1735680000000"));
    }
  }

  // ==============================================================================================
  // collectIndexFootprints + sumPrimaryBytes + sumDocs — the end-to-end de-dup path against the
  // _cat/indices / _cat/aliases payloads the analyzer actually consumes.
  // ==============================================================================================
  @Nested
  @DisplayName("collectIndexFootprints de-duplicates against _cat/indices + _cat/aliases")
  class CollectIndexFootprints {

    @Test
    @DisplayName("steady state at build parity: one footprint, primary bytes not doubled")
    void steadyStateAtParityNotDoubled() throws Exception {
      String live = "table_search_index_rebuild_1732000000000";
      String staged = "table_search_index_rebuild_1735680000000";
      JsonNode catIndices =
          catIndices(
              indexRow(live, 50000L, HUNDRED_GIB, HUNDRED_GIB * 2),
              indexRow(staged, 0L, HUNDRED_GIB, HUNDRED_GIB * 2));
      JsonNode catAliases =
          catAliases(aliasRow("table", live), aliasRow("table_search_index", live));

      List<IndexFootprint> footprints = collectIndexFootprints(catIndices, catAliases);

      assertEquals(
          1, footprints.size(), "live + staged rebuild sibling must collapse to one footprint");
      assertEquals(live, footprints.get(0).getIndexName());
      assertEquals(HUNDRED_GIB, footprints.get(0).getPrimarySizeBytes());

      // The core defect: sum must reflect only the live primary data, not live + staged.
      assertEquals(HUNDRED_GIB, sumPrimaryBytes(footprints));
      assertEquals(50000L, sumDocs(footprints));
    }

    @Test
    @DisplayName("steady state mid-build (60% progress): bytes reflect live only")
    void steadyStateMidBuildReflectsLiveOnly() throws Exception {
      String live = "table_search_index_rebuild_1732000000000";
      String staged = "table_search_index_rebuild_1735680000000";
      JsonNode catIndices =
          catIndices(
              indexRow(live, 50000L, HUNDRED_GIB, HUNDRED_GIB * 2),
              indexRow(staged, 30000L, 60L * GIB, 60L * GIB * 2));
      JsonNode catAliases = catAliases(aliasRow("table", live));

      List<IndexFootprint> footprints = collectIndexFootprints(catIndices, catAliases);

      assertEquals(1, footprints.size());
      assertEquals(HUNDRED_GIB, sumPrimaryBytes(footprints));
    }

    @Test
    @DisplayName("first install: live canonical + staged rebuild collapses to live")
    void firstInstallCollapses() throws Exception {
      String live = "table_search_index";
      String staged = "table_search_index_rebuild_1735680000000";
      JsonNode catIndices =
          catIndices(
              indexRow(live, 50000L, TEN_GIB, TEN_GIB * 2),
              indexRow(staged, 0L, FIVE_GIB, FIVE_GIB * 2));
      JsonNode catAliases = catAliases(aliasRow("table", live));

      List<IndexFootprint> footprints = collectIndexFootprints(catIndices, catAliases);

      assertEquals(1, footprints.size());
      assertEquals(live, footprints.get(0).getIndexName());
      assertEquals(TEN_GIB, sumPrimaryBytes(footprints));
    }

    @Test
    @DisplayName(
        "first install: order-independent (staged listed before live still collapses to live)")
    void firstInstallOrderIndependent() throws Exception {
      String live = "table_search_index";
      String staged = "table_search_index_rebuild_1735680000000";
      JsonNode catIndices =
          catIndices(
              indexRow(staged, 0L, FIVE_GIB, FIVE_GIB * 2),
              indexRow(live, 50000L, TEN_GIB, TEN_GIB * 2));
      JsonNode catAliases = catAliases(aliasRow("table", live));

      List<IndexFootprint> footprints = collectIndexFootprints(catIndices, catAliases);

      assertEquals(1, footprints.size());
      assertEquals(live, footprints.get(0).getIndexName());
    }

    @Test
    @DisplayName(
        "no reindex in flight: footprint and totals reflect real primary data (no regression)")
    void noReindexNoRegression() throws Exception {
      JsonNode catIndices =
          catIndices(
              indexRow("table_search_index", 50000L, TEN_GIB, TEN_GIB * 2),
              indexRow("user_search_index", 1000L, GIB, GIB * 2));
      JsonNode catAliases =
          catAliases(
              aliasRow("table", "table_search_index"), aliasRow("user", "user_search_index"));

      List<IndexFootprint> footprints = collectIndexFootprints(catIndices, catAliases);

      assertEquals(2, footprints.size());
      assertEquals(TEN_GIB + GIB, sumPrimaryBytes(footprints));
      assertEquals(50000L + 1000L, sumDocs(footprints));
    }

    @Test
    @DisplayName("cluster-aliased canonical names dedup correctly")
    void clusterAliasedNamesDedup() throws Exception {
      String live = "openmetadata_table_search_index_rebuild_1732000000000";
      String staged = "openmetadata_table_search_index_rebuild_1735680000000";
      JsonNode catIndices =
          catIndices(
              indexRow(live, 50000L, HUNDRED_GIB, HUNDRED_GIB * 2),
              indexRow(staged, 0L, HUNDRED_GIB, HUNDRED_GIB * 2));
      JsonNode catAliases = catAliases(aliasRow("openmetadata_table", live));

      // Use a cluster alias of "openmetadata" so canonical/alias names are prefixed.
      Method m =
          SearchClusterFitnessAnalyzer.class.getDeclaredMethod(
              "collectIndexFootprints", JsonNode.class, JsonNode.class, String.class, List.class);
      m.setAccessible(true);
      @SuppressWarnings("unchecked")
      List<IndexFootprint> footprints =
          (List<IndexFootprint>)
              m.invoke(
                  newAnalyzer(), catIndices, catAliases, "openmetadata", new ArrayList<String>());

      assertEquals(1, footprints.size());
      assertEquals(live, footprints.get(0).getIndexName());
      assertEquals(HUNDRED_GIB, sumPrimaryBytes(footprints));
    }

    @Test
    @DisplayName(
        "aliases endpoint inaccessible (null _cat/aliases): keep-larger fallback still de-dups")
    void aliasesInaccessibleKeepsLargerFallback() throws Exception {
      // Procedure H: when /_cat/aliases is unavailable, indicesWithOmAlias is empty and the
      // de-dup falls back to keeping the larger primarySizeBytes. Here the live index (100 GiB)
      // is larger than the staged sibling (60 GiB mid-build), so the live one is kept and the
      // total reflects live-only — NOT live + staged. With the bug (no collapse), the total would
      // be 160 GiB (the sum).
      String live = "table_search_index_rebuild_1732000000000";
      String staged = "table_search_index_rebuild_1735680000000";
      JsonNode catIndices =
          catIndices(
              indexRow(live, 50000L, HUNDRED_GIB, HUNDRED_GIB * 2),
              indexRow(staged, 30000L, 60L * GIB, 60L * GIB * 2));
      // null catAliases simulates /_cat/aliases being inaccessible — collectIndexFootprints records
      // it in `inaccessible` and proceeds with an empty indicesWithOmAlias set.
      List<IndexFootprint> footprints = collectIndexFootprints(catIndices, null);

      assertEquals(1, footprints.size(), "keep-larger fallback must still collapse the siblings");
      // Live (100 GiB) > staged (60 GiB), so keep-larger retains the live index.
      assertEquals(live, footprints.get(0).getIndexName());
      assertEquals(HUNDRED_GIB, sumPrimaryBytes(footprints));
      assertEquals(50000L, sumDocs(footprints));
    }

    @Test
    @DisplayName(
        "aliases endpoint inaccessible and staged > live: keep-larger retains staged (deterministic)")
    void aliasesInaccessibleKeepsLargerEvenIfStaged() throws Exception {
      // Procedure H robustness: when neither sibling carries an alias, keep-larger is deterministic
      // and independent of row order. Here the staged sibling (150 GiB) exceeds the live (100 GiB)
      // (e.g. staged has grown past live near build completion), so the larger one is kept even
      // though it is the staged index — the total is 150 GiB, NOT 250 GiB (the sum).
      String live = "table_search_index_rebuild_1732000000000";
      String staged = "table_search_index_rebuild_1735680000000";
      JsonNode catIndices =
          catIndices(
              indexRow(live, 50000L, HUNDRED_GIB, HUNDRED_GIB * 2),
              indexRow(staged, 75000L, 150L * GIB, 150L * GIB * 2));

      List<IndexFootprint> footprints = collectIndexFootprints(catIndices, null);

      assertEquals(1, footprints.size());
      assertEquals(staged, footprints.get(0).getIndexName());
      assertEquals(150L * GIB, sumPrimaryBytes(footprints));
      assertEquals(75000L, sumDocs(footprints));
    }
  }

  // ==============================================================================================
  // buildSizingGuidance — the verdict-flip guarantee. The fix must keep ADEQUATE for the worked
  // example (P=100GiB, 3 data nodes, 16GiB heap) at build parity, where the bug produced
  // UNDERSIZED with +1 recommended data node.
  // ==============================================================================================
  @Nested
  @DisplayName("buildSizingGuidance verdict no longer flips during a reindex")
  class SizingGuidanceVerdict {

    @Test
    @DisplayName("fix: de-duped (live-only) input keeps ADEQUATE @ 3 nodes")
    void dedupedInputStaysAdequate() throws Exception {
      SearchClusterFitnessReport report =
          SearchClusterFitnessReport.builder().totalIndices(1).build();
      SizingGuidance sizing =
          buildSizingGuidance(report, dataNodes(3, SIXTEEN_GIB), HUNDRED_GIB, 50000L, false);

      assertEquals("ADEQUATE", sizing.getVerdict());
      assertEquals(3, sizing.getRecommendedDataNodes());
    }

    @Test
    @DisplayName(
        "end-to-end: collect -> sum -> sizing yields ADEQUATE for the reindex-at-parity shape")
    void endToEndReindexAtParityYieldsAdequate() throws Exception {
      String live = "table_search_index_rebuild_1732000000000";
      String staged = "table_search_index_rebuild_1735680000000";
      JsonNode catIndices =
          catIndices(
              indexRow(live, 50000L, HUNDRED_GIB, HUNDRED_GIB * 2),
              indexRow(staged, 0L, HUNDRED_GIB, HUNDRED_GIB * 2));
      JsonNode catAliases = catAliases(aliasRow("table", live));

      List<IndexFootprint> footprints = collectIndexFootprints(catIndices, catAliases);
      long totalPrimary = sumPrimaryBytes(footprints);
      long totalDocs = sumDocs(footprints);

      // The fix: totalPrimary reflects only the live index (100GiB), not live + staged (200GiB).
      assertEquals(HUNDRED_GIB, totalPrimary);

      SearchClusterFitnessReport report =
          SearchClusterFitnessReport.builder().totalIndices(footprints.size()).build();
      SizingGuidance sizing =
          buildSizingGuidance(report, dataNodes(3, SIXTEEN_GIB), totalPrimary, totalDocs, false);

      assertEquals("ADEQUATE", sizing.getVerdict());
      assertEquals(3, sizing.getRecommendedDataNodes());
      assertNotNull(sizing.getRationale());
      assertTrue(
          sizing.getRationale().contains("100.0GB"), "rationale should print the de-duped total");
    }
  }
}
