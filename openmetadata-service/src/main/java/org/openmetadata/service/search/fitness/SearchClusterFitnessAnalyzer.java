/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under the License.
 */
package org.openmetadata.service.search.fitness;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

/**
 * Inspects a live Elasticsearch / OpenSearch cluster and produces a {@link
 * SearchClusterFitnessReport} describing whether it is appropriately sized for the data
 * OpenMetadata is storing.
 *
 * <p>All probing is done via raw REST GETs so the analyzer works against either engine, and so
 * fields that are restricted on managed clusters (AWS OpenSearch in particular) can be skipped
 * cleanly — missing fields are recorded in {@code inaccessibleMetrics} and the corresponding
 * signal is omitted from the report rather than failing the whole run.
 */
@Slf4j
public class SearchClusterFitnessAnalyzer {

  private final SearchRepository searchRepository;
  private final SearchRestProbe probe;

  public SearchClusterFitnessAnalyzer(SearchRepository searchRepository) {
    this.searchRepository = searchRepository;
    SearchClient client = searchRepository.getSearchClient();
    this.probe = new SearchRestProbe(client);
  }

  public SearchClusterFitnessReport analyze() {
    ClusterSnapshot snapshot = collectClusterSnapshot();
    SearchClusterFitnessReport report = initReport(snapshot);
    runChecks(report, snapshot);
    finalizeReport(report, snapshot);
    return report;
  }

  /**
   * Issues the always-needed REST GETs in a single eager batch. Endpoints whose payloads can be
   * large or that return 4xx on healthy clusters (e.g. {@code /_cluster/allocation/explain}) are
   * fetched lazily inside the individual check methods.
   */
  private ClusterSnapshot collectClusterSnapshot() {
    ClusterSnapshot s = new ClusterSnapshot();
    s.rootInfo = probe.get("/");
    s.clusterHealth = probe.get("/_cluster/health");
    s.clusterStats = probe.get("/_cluster/stats");
    // Limit to only the metric groups collectNodeFootprints reads — the unfiltered /_nodes/stats
    // can be large and this diagnostic is often run during an incident when the cluster is already
    // under load. Node identity fields (name/host/roles) are always included regardless of filter.
    s.nodesStats = probe.get("/_nodes/stats/os,jvm,fs,thread_pool,breakers");
    s.catIndices = probe.get("/_cat/indices?format=json&bytes=b");
    s.catAliases = probe.get("/_cat/aliases?format=json");
    s.clusterSettings = probe.get("/_cluster/settings?include_defaults=true&flat_settings=false");
    return s;
  }

  private SearchClusterFitnessReport initReport(ClusterSnapshot s) {
    List<FitnessSignal> signals = new ArrayList<>();
    List<String> inaccessible = new ArrayList<>();
    SearchClusterFitnessReport report =
        SearchClusterFitnessReport.builder()
            .generatedAtMillis(System.currentTimeMillis())
            .signals(signals)
            .inaccessibleMetrics(inaccessible)
            .build();
    populateClusterIdentity(report, s.rootInfo, s.clusterHealth, s.clusterStats);
    s.indexFootprints =
        collectIndexFootprints(s.catIndices, s.catAliases, clusterAlias(), inaccessible);
    report.setIndices(s.indexFootprints);
    report.setTotalPrimarySizeBytes(sumPrimaryBytes(s.indexFootprints));
    report.setTotalDocsCount(sumDocs(s.indexFootprints));
    report.setTotalIndices(s.indexFootprints.size());
    s.omIndicesMissing = s.indexFootprints.isEmpty();
    if (s.omIndicesMissing) {
      List<IndexFootprint> observed = collectAllIndexFootprints(s.catIndices);
      report.setOtherIndicesOnCluster(observed);
      emitNoOpenMetadataIndicesSignal(signals, observed, report.getClusterIndicesCount());
    }
    s.nodeFootprints = collectNodeFootprints(s.nodesStats, inaccessible);
    report.setNodes(s.nodeFootprints);
    return report;
  }

  private void runChecks(SearchClusterFitnessReport report, ClusterSnapshot s) {
    List<FitnessSignal> signals = report.getSignals();
    List<String> inaccessible = report.getInaccessibleMetrics();
    int dataNodes = countDataNodes(s.nodeFootprints, report);
    checkClusterStatus(signals, s.clusterHealth, inaccessible);
    checkPendingTasks(signals, s.clusterHealth, inaccessible);
    checkUnassignedShards(signals, s.clusterHealth, dataNodes, inaccessible);
    checkShardBudget(signals, s.clusterStats, s.clusterSettings, dataNodes, inaccessible);
    checkShardsPerHeapGb(signals, report.getTotalShards(), s.nodeFootprints);
    checkDedicatedMaster(signals, s.clusterHealth, s.nodeFootprints);
    checkDocSizeAndShards(signals, s.indexFootprints);
    checkDiskWatermarks(signals, s.nodeFootprints, s.clusterSettings, inaccessible);
    checkHeapAndCpu(signals, s.nodeFootprints, inaccessible);
    checkThreadPoolPressure(signals, s.nodeFootprints, inaccessible);
    checkCircuitBreakers(signals, s.nodeFootprints, inaccessible);
  }

  private void finalizeReport(SearchClusterFitnessReport report, ClusterSnapshot s) {
    long totalPrimaryBytes =
        report.getTotalPrimarySizeBytes() == null ? 0L : report.getTotalPrimarySizeBytes();
    long totalDocs = report.getTotalDocsCount() == null ? 0L : report.getTotalDocsCount();
    SizingGuidance sizing =
        buildSizingGuidance(
            report, s.nodeFootprints, totalPrimaryBytes, totalDocs, s.omIndicesMissing);
    report.setSizingGuidance(sizing);
    FitnessVerdict verdict = rollup(report.getSignals(), s.omIndicesMissing);
    report.setOverallVerdict(verdict);
    report.setSummary(buildSummary(report, verdict, sizing, s.omIndicesMissing));
  }

  /** Mutable container for endpoints + derived state passed between analyze() phases. */
  private static final class ClusterSnapshot {
    JsonNode rootInfo;
    JsonNode clusterHealth;
    JsonNode clusterStats;
    JsonNode nodesStats;
    JsonNode catIndices;
    JsonNode catAliases;
    JsonNode clusterSettings;
    List<IndexFootprint> indexFootprints;
    List<NodeFootprint> nodeFootprints;
    boolean omIndicesMissing;
  }

  private int countDataNodes(List<NodeFootprint> nodes, SearchClusterFitnessReport report) {
    long withDataRole =
        nodes.stream()
            .filter(n -> n.getRoles() != null)
            .filter(
                n -> n.getRoles().stream().anyMatch(r -> r.equals("data") || r.startsWith("data_")))
            .count();
    int result;
    if (withDataRole > 0) {
      result = (int) withDataRole;
    } else if (report.getDataNodes() != null && report.getDataNodes() > 0) {
      result = report.getDataNodes();
    } else {
      result = Math.max(1, nodes.size());
    }
    return result;
  }

  private String clusterAlias() {
    String alias = "";
    try {
      String configured = searchRepository.getClusterAlias();
      if (configured != null) {
        alias = configured;
      }
    } catch (Exception e) {
      LOG.debug("Could not determine cluster alias: {}", e.getMessage());
    }
    return alias;
  }

  private void populateClusterIdentity(
      SearchClusterFitnessReport report, JsonNode rootInfo, JsonNode health, JsonNode stats) {
    if (rootInfo != null && rootInfo.has("version")) {
      JsonNode version = rootInfo.get("version");
      report.setSearchVersion(text(version, "number"));
      String distribution = text(version, "distribution");
      if (nullOrEmpty(distribution)) {
        distribution =
            searchRepository.getSearchType() == ElasticSearchConfiguration.SearchType.OPENSEARCH
                ? "opensearch"
                : "elasticsearch";
      }
      report.setSearchDistribution(distribution);
    }
    if (health != null) {
      report.setClusterStatus(text(health, "status"));
      report.setClusterName(text(health, "cluster_name"));
      report.setTotalNodes(intVal(health, "number_of_nodes"));
      report.setDataNodes(intVal(health, "number_of_data_nodes"));
    }
    if (stats != null && stats.has("indices")) {
      JsonNode indices = stats.get("indices");
      if (indices.has("shards")) {
        report.setTotalShards(intVal(indices.get("shards"), "total"));
      }
      if (indices.has("count")) {
        report.setClusterIndicesCount(intVal(indices, "count"));
      }
    }
  }

  private List<IndexFootprint> collectAllIndexFootprints(JsonNode catIndices) {
    List<IndexFootprint> result = new ArrayList<>();
    if (catIndices == null || !catIndices.isArray()) {
      return result;
    }
    for (JsonNode node : catIndices) {
      String name = text(node, "index");
      if (name == null || name.startsWith(".")) {
        continue;
      }
      Long docs = parseLong(text(node, "docs.count"));
      Long primaryBytes = parseLong(text(node, "pri.store.size"));
      Long totalBytes = parseLong(text(node, "store.size"));
      Integer primaryShards = parseInt(text(node, "pri"));
      Integer replicaShards = parseInt(text(node, "rep"));
      Long avgDocBytes = null;
      if (docs != null && docs > 0 && primaryBytes != null) {
        avgDocBytes = primaryBytes / docs;
      }
      result.add(
          IndexFootprint.builder()
              .indexName(name)
              .docsCount(docs)
              .primarySizeBytes(primaryBytes)
              .totalSizeBytes(totalBytes)
              .primaryShards(primaryShards)
              .replicaShards(replicaShards)
              .avgDocBytes(avgDocBytes)
              .health(text(node, "health"))
              .build());
    }
    result.sort(
        Comparator.comparing(
                (IndexFootprint i) ->
                    i.getPrimarySizeBytes() == null ? 0L : i.getPrimarySizeBytes())
            .reversed());
    int limit = Math.min(20, result.size());
    return new ArrayList<>(result.subList(0, limit));
  }

  private void emitNoOpenMetadataIndicesSignal(
      List<FitnessSignal> signals, List<IndexFootprint> observed, Integer clusterIndicesCount) {
    String observedNames =
        observed.isEmpty()
            ? "(none)"
            : observed.stream()
                .limit(5)
                .map(IndexFootprint::getIndexName)
                .reduce((a, b) -> a + ", " + b)
                .orElse("(none)");
    String observation =
        "cluster reports "
            + (clusterIndicesCount == null ? "?" : clusterIndicesCount.toString())
            + " indices total; 0 matched as OpenMetadata-managed. Top observed: "
            + observedNames;
    signals.add(
        FitnessSignal.builder()
            .name("openmetadata.indices_missing")
            .severity(FitnessSeverity.WARN)
            .observed(observation)
            .threshold("≥1 OpenMetadata-managed index")
            .thresholdRationale(
                "If reindex has run, OpenMetadata's table_search_index / database_search_index / "
                    + "user_search_index and friends should be present. If they aren't, sizing "
                    + "guidance and data-footprint signals cannot be computed.")
            .recommendation(
                "Has `openmetadata-ops reindex` run for this deployment? If yes, check the "
                    + "clusterAlias in openmetadata.yaml matches the prefix used on the cluster. "
                    + "Otherwise, see otherIndicesOnCluster for what is actually present.")
            .build());
  }

  private List<IndexFootprint> collectIndexFootprints(
      JsonNode catIndices, JsonNode catAliases, String clusterAlias, List<String> inaccessible) {
    List<IndexFootprint> result = new ArrayList<>();
    if (catIndices == null || !catIndices.isArray()) {
      inaccessible.add("/_cat/indices");
      return result;
    }
    if (catAliases == null || !catAliases.isArray()) {
      // Alias-based matching is a fallback for indices whose physical name doesn't match the
      // canonical/prefix rules; note when it's unavailable so a false "indices_missing" diagnosis
      // is attributable rather than silent.
      inaccessible.add("/_cat/aliases");
    }
    Set<String> canonicalNames = openMetadataCanonicalNames(clusterAlias);
    Set<String> openMetadataAliases = openMetadataAliases(clusterAlias);
    Set<String> indicesWithOmAlias = indicesCarryingOmAlias(catAliases, openMetadataAliases);
    for (JsonNode node : catIndices) {
      String name = text(node, "index");
      if (name == null || !isOpenMetadataIndex(name, canonicalNames, indicesWithOmAlias)) {
        continue;
      }
      Long docs = parseLong(text(node, "docs.count"));
      Long primaryBytes = parseLong(text(node, "pri.store.size"));
      Long totalBytes = parseLong(text(node, "store.size"));
      Integer primaryShards = parseInt(text(node, "pri"));
      Integer replicaShards = parseInt(text(node, "rep"));
      Long avgDocBytes = null;
      if (docs != null && docs > 0 && primaryBytes != null) {
        avgDocBytes = primaryBytes / docs;
      }
      result.add(
          IndexFootprint.builder()
              .indexName(name)
              .docsCount(docs)
              .primarySizeBytes(primaryBytes)
              .totalSizeBytes(totalBytes)
              .primaryShards(primaryShards)
              .replicaShards(replicaShards)
              .avgDocBytes(avgDocBytes)
              .health(text(node, "health"))
              .build());
    }
    result.sort(Comparator.comparing(IndexFootprint::getIndexName));
    return result;
  }

  private boolean isOpenMetadataIndex(
      String name, Set<String> canonical, Set<String> indicesWithOmAlias) {
    boolean match = canonical.contains(name) || indicesWithOmAlias.contains(name);
    if (!match) {
      for (String canon : canonical) {
        if (name.startsWith(canon + "_") || name.startsWith(canon + "-")) {
          match = true;
          break;
        }
      }
    }
    return match;
  }

  private Set<String> openMetadataCanonicalNames(String clusterAlias) {
    Set<String> names = new HashSet<>();
    try {
      Map<String, IndexMapping> mapping = IndexMappingLoader.getInstance().getIndexMapping();
      for (IndexMapping im : mapping.values()) {
        names.add(im.getIndexName(clusterAlias));
      }
    } catch (Exception e) {
      LOG.debug(
          "Could not load IndexMappingLoader, falling back to empty filter: {}", e.getMessage());
    }
    return names;
  }

  private Set<String> openMetadataAliases(String clusterAlias) {
    Set<String> aliases = new HashSet<>();
    try {
      Map<String, IndexMapping> mapping = IndexMappingLoader.getInstance().getIndexMapping();
      for (IndexMapping im : mapping.values()) {
        if (im.getAlias() != null) {
          aliases.add(im.getAlias(clusterAlias));
        }
      }
    } catch (Exception e) {
      LOG.debug("Could not load IndexMappingLoader for aliases: {}", e.getMessage());
    }
    return aliases;
  }

  private Set<String> indicesCarryingOmAlias(JsonNode catAliases, Set<String> openMetadataAliases) {
    Set<String> indices = new HashSet<>();
    if (catAliases == null || !catAliases.isArray() || openMetadataAliases.isEmpty()) {
      return indices;
    }
    for (JsonNode row : catAliases) {
      String alias = text(row, "alias");
      String index = text(row, "index");
      if (alias != null && index != null && openMetadataAliases.contains(alias)) {
        indices.add(index);
      }
    }
    return indices;
  }

  private List<NodeFootprint> collectNodeFootprints(
      JsonNode nodesStats, List<String> inaccessible) {
    List<NodeFootprint> result = new ArrayList<>();
    if (nodesStats == null || !nodesStats.has("nodes")) {
      inaccessible.add("/_nodes/stats");
      return result;
    }
    JsonNode nodes = nodesStats.get("nodes");
    Iterator<Map.Entry<String, JsonNode>> it = nodes.fields();
    while (it.hasNext()) {
      Map.Entry<String, JsonNode> entry = it.next();
      JsonNode node = entry.getValue();
      NodeFootprint nf = new NodeFootprint();
      nf.setName(text(node, "name"));
      nf.setHost(text(node, "host"));
      JsonNode roles = node.get("roles");
      if (roles != null && roles.isArray()) {
        List<String> roleList = new ArrayList<>();
        for (JsonNode r : roles) {
          roleList.add(r.asText());
        }
        nf.setRoles(roleList);
      }
      JsonNode jvm = node.get("jvm");
      if (jvm != null && jvm.has("mem")) {
        JsonNode mem = jvm.get("mem");
        nf.setHeapUsedPercent(doubleVal(mem, "heap_used_percent"));
        nf.setHeapMaxBytes(longVal(mem, "heap_max_in_bytes"));
      }
      JsonNode os = node.get("os");
      if (os != null && os.has("cpu")) {
        nf.setCpuPercent(doubleVal(os.get("cpu"), "percent"));
      }
      JsonNode fs = node.get("fs");
      if (fs != null && fs.has("total")) {
        JsonNode total = fs.get("total");
        nf.setDiskTotalBytes(longVal(total, "total_in_bytes"));
        nf.setDiskAvailableBytes(longVal(total, "available_in_bytes"));
        if (nf.getDiskTotalBytes() != null
            && nf.getDiskTotalBytes() > 0
            && nf.getDiskAvailableBytes() != null) {
          double used = nf.getDiskTotalBytes() - nf.getDiskAvailableBytes();
          nf.setDiskUsedPercent(used * 100.0 / nf.getDiskTotalBytes());
        }
      }
      JsonNode threadPool = node.get("thread_pool");
      if (threadPool != null) {
        JsonNode write = threadPool.has("write") ? threadPool.get("write") : threadPool.get("bulk");
        if (write != null) {
          nf.setWriteQueueDepth(longVal(write, "queue"));
          nf.setWriteRejectedTotal(longVal(write, "rejected"));
        }
        JsonNode search = threadPool.get("search");
        if (search != null) {
          nf.setSearchQueueDepth(longVal(search, "queue"));
          nf.setSearchRejectedTotal(longVal(search, "rejected"));
        }
      }
      JsonNode breakers = node.get("breakers");
      if (breakers != null) {
        long trips = 0;
        Iterator<Map.Entry<String, JsonNode>> bit = breakers.fields();
        while (bit.hasNext()) {
          Long t = longVal(bit.next().getValue(), "tripped");
          if (t != null) {
            trips += t;
          }
        }
        nf.setCircuitBreakerTrips(trips);
      }
      result.add(nf);
    }
    return result;
  }

  private void checkClusterStatus(
      List<FitnessSignal> signals, JsonNode health, List<String> inaccessible) {
    if (!isUsable(health)) {
      if (!inaccessible.contains("/_cluster/health")) {
        inaccessible.add("/_cluster/health");
      }
      return;
    }
    String status = text(health, "status");
    FitnessSeverity severity = FitnessSeverity.PASS;
    String recommendation = null;
    if ("red".equalsIgnoreCase(status)) {
      severity = FitnessSeverity.FAIL;
      recommendation =
          "One or more primary shards are unassigned. Run /_cluster/allocation/explain "
              + "to identify the cause (disk watermark, node leave, max-shards exceeded).";
    } else if ("yellow".equalsIgnoreCase(status)) {
      severity = FitnessSeverity.WARN;
      recommendation =
          "Replica shards are unassigned. With a single-node cluster this is expected; "
              + "for multi-node clusters check node availability and shard allocation settings.";
    }
    signals.add(
        FitnessSignal.builder()
            .name("cluster.status")
            .severity(severity)
            .observed(status)
            .threshold("green")
            .thresholdRationale(
                "Production clusters should report green; yellow/red indicates degraded availability.")
            .recommendation(recommendation)
            .build());
  }

  private void checkPendingTasks(
      List<FitnessSignal> signals, JsonNode health, List<String> inaccessible) {
    if (health == null || !health.has("number_of_pending_tasks")) {
      return;
    }
    int pending = intValOrZero(health, "number_of_pending_tasks");
    FitnessSeverity severity = FitnessSeverity.PASS;
    String recommendation = null;
    if (pending >= SearchClusterFitnessRules.PENDING_TASKS_FAIL) {
      severity = FitnessSeverity.FAIL;
      recommendation =
          "The master is backed up. Stop bulk reindex/index template updates and let the queue drain.";
    } else if (pending >= SearchClusterFitnessRules.PENDING_TASKS_WARN) {
      severity = FitnessSeverity.WARN;
      recommendation =
          "Master is slow to apply tasks. Avoid concurrent mapping changes during reindex.";
    }
    signals.add(
        FitnessSignal.builder()
            .name("cluster.pending_tasks")
            .severity(severity)
            .observed(String.valueOf(pending))
            .threshold(
                "warn="
                    + SearchClusterFitnessRules.PENDING_TASKS_WARN
                    + ", fail="
                    + SearchClusterFitnessRules.PENDING_TASKS_FAIL)
            .thresholdRationale(
                "Pending cluster-state tasks indicate the master is struggling to apply changes.")
            .recommendation(recommendation)
            .build());
  }

  private void checkUnassignedShards(
      List<FitnessSignal> signals, JsonNode health, int dataNodes, List<String> inaccessible) {
    if (!isUsable(health) || !health.has("unassigned_shards")) {
      return;
    }
    int unassigned = intValOrZero(health, "unassigned_shards");
    if (unassigned == 0) {
      signals.add(
          FitnessSignal.builder()
              .name("cluster.unassigned_shards")
              .severity(FitnessSeverity.PASS)
              .observed("0")
              .threshold("0")
              .thresholdRationale(
                  "Any unassigned shard means data is missing or unprotected by replicas.")
              .build());
      return;
    }
    // Lazy-fetch only when we actually have unassigned shards. _cat/shards can be megabytes
    // on large clusters; /_cluster/allocation/explain returns 400 when the queue is empty.
    JsonNode catShards = probe.get("/_cat/shards?format=json&h=index,shard,prirep,state");
    JsonNode allocationExplain = probe.get("/_cluster/allocation/explain");
    int unassignedPrimaries = 0;
    int unassignedReplicas = 0;
    if (catShards != null && catShards.isArray()) {
      for (JsonNode row : catShards) {
        if (!"UNASSIGNED".equalsIgnoreCase(text(row, "state"))) {
          continue;
        }
        if ("p".equalsIgnoreCase(text(row, "prirep"))) {
          unassignedPrimaries++;
        } else {
          unassignedReplicas++;
        }
      }
    }
    String explainReason = extractAllocationExplainReason(allocationExplain);
    boolean singleNodeReplicasOnly =
        dataNodes <= 1 && unassignedPrimaries == 0 && unassignedReplicas > 0;
    FitnessSeverity severity;
    String recommendation;
    if (unassignedPrimaries > 0) {
      severity = FitnessSeverity.FAIL;
      recommendation =
          "Unassigned primary shards mean data is unavailable. "
              + (explainReason == null ? "" : "Allocation explain: " + explainReason + " ")
              + "Run GET /_cluster/allocation/explain for full diagnosis.";
    } else if (singleNodeReplicasOnly) {
      severity = FitnessSeverity.INFO;
      recommendation =
          "All unassigned shards are replicas on a single-node cluster — this is expected. "
              + "To clear the yellow status, set `number_of_replicas: 0` on these indices, "
              + "or add a second data node before promoting this cluster.";
    } else {
      severity = FitnessSeverity.WARN;
      recommendation =
          "Replica shards are unassigned. "
              + (explainReason == null ? "" : "Allocation explain: " + explainReason + " ")
              + "Check for disk watermark crossings, replica count > available nodes, "
              + "or max-shards-per-node exceeded.";
    }
    signals.add(
        FitnessSignal.builder()
            .name("cluster.unassigned_shards")
            .severity(severity)
            .observed(
                "total="
                    + unassigned
                    + " (primaries="
                    + unassignedPrimaries
                    + ", replicas="
                    + unassignedReplicas
                    + ")")
            .threshold("primaries=0; replicas=0 with ≥2 data nodes")
            .thresholdRationale(
                "Primary unassigned = data loss risk. Replica unassigned on a single-node "
                    + "cluster is normal (no other node to host the copy).")
            .recommendation(recommendation)
            .build());
  }

  private String extractAllocationExplainReason(JsonNode explain) {
    String result = null;
    if (explain != null && !explain.isMissingNode() && !explain.isNull()) {
      // unassigned_info is an object node — walk into it rather than calling asText().
      JsonNode info = explain.get("unassigned_info");
      if (info != null && info.isObject()) {
        String r = text(info, "reason");
        String details = text(info, "details");
        if (r != null) {
          result = details == null ? r : r + " (" + details + ")";
        }
      }
      if (result == null) {
        String decision = text(explain, "can_allocate");
        String allocateExplanation = text(explain, "allocate_explanation");
        if (decision != null && allocateExplanation != null) {
          result = decision + ": " + allocateExplanation;
        }
      }
    }
    return result;
  }

  private void checkShardBudget(
      List<FitnessSignal> signals,
      JsonNode clusterStats,
      JsonNode clusterSettings,
      int knownNodes,
      List<String> inaccessible) {
    if (clusterStats == null || !clusterStats.has("indices")) {
      return;
    }
    Integer totalShards = intVal(clusterStats.get("indices").get("shards"), "total");
    if (totalShards == null || knownNodes <= 0) {
      return;
    }
    int maxShardsPerNode = readMaxShardsPerNode(clusterSettings);
    long budget = (long) maxShardsPerNode * knownNodes;
    double usedFraction = budget == 0 ? 0 : (double) totalShards / budget;
    FitnessSeverity severity = FitnessSeverity.PASS;
    String recommendation = null;
    if (usedFraction >= SearchClusterFitnessRules.SHARD_BUDGET_FAIL_FRACTION) {
      severity = FitnessSeverity.FAIL;
      recommendation =
          "Near the per-node shard limit. Either add nodes or reduce shard count "
              + "(consolidate small indices, drop unused replicas).";
    } else if (usedFraction >= SearchClusterFitnessRules.SHARD_BUDGET_WARN_FRACTION) {
      severity = FitnessSeverity.WARN;
      recommendation =
          "Shard count is approaching cluster.max_shards_per_node × nodes. Plan to "
              + "shrink low-traffic indices or add data nodes before the next reindex.";
    }
    signals.add(
        FitnessSignal.builder()
            .name("cluster.shard_budget")
            .severity(severity)
            .observed(
                String.format(
                    Locale.ROOT,
                    "%d shards / %d budget (%.0f%%)",
                    totalShards,
                    budget,
                    usedFraction * 100))
            .threshold(
                "warn≥"
                    + (int) (SearchClusterFitnessRules.SHARD_BUDGET_WARN_FRACTION * 100)
                    + "%, fail≥"
                    + (int) (SearchClusterFitnessRules.SHARD_BUDGET_FAIL_FRACTION * 100)
                    + "%")
            .thresholdRationale(
                "Once shards/(nodes×max_shards_per_node) approaches 1, new indices cannot be created.")
            .recommendation(recommendation)
            .build());
  }

  private void checkShardsPerHeapGb(
      List<FitnessSignal> signals, Integer totalShards, List<NodeFootprint> nodes) {
    if (totalShards == null || totalShards <= 0 || nodes.isEmpty()) {
      return;
    }
    // Shards are only allocated on data nodes — including master/coord heap in the denominator
    // would understate true shard density. Fall back to all nodes only if no node has roles
    // (older ES/OS responses) so we still produce a signal in that case.
    List<NodeFootprint> dataNodes = filterDataNodes(nodes);
    List<NodeFootprint> heapNodes = dataNodes.isEmpty() ? nodes : dataNodes;
    long totalHeapBytes =
        heapNodes.stream()
            .map(NodeFootprint::getHeapMaxBytes)
            .filter(java.util.Objects::nonNull)
            .mapToLong(Long::longValue)
            .sum();
    if (totalHeapBytes <= 0) {
      return;
    }
    double totalHeapGb = totalHeapBytes / (1024.0 * 1024 * 1024);
    double shardsPerGb = totalShards / totalHeapGb;
    FitnessSeverity severity = FitnessSeverity.PASS;
    String recommendation = null;
    if (shardsPerGb >= SearchClusterFitnessRules.MAX_SHARDS_PER_GB_HEAP) {
      severity = FitnessSeverity.FAIL;
      recommendation =
          "AWS recommends ≤25 shards per GB of JVM heap across the cluster. Either consolidate "
              + "small indices, drop unused replicas, or scale heap by adding/upgrading data nodes.";
    } else if (shardsPerGb >= SearchClusterFitnessRules.MAX_SHARDS_PER_GB_HEAP * 0.8) {
      severity = FitnessSeverity.WARN;
      recommendation =
          "Approaching the AWS-recommended shard-density limit. Plan to consolidate small indices "
              + "or scale heap before adding more.";
    }
    if (severity != FitnessSeverity.PASS) {
      signals.add(
          FitnessSignal.builder()
              .name("cluster.shards_per_heap_gb")
              .severity(severity)
              .observed(
                  String.format(
                      Locale.ROOT,
                      "%.1f shards/GB heap (%d shards across %.1f GB total heap)",
                      shardsPerGb,
                      totalShards,
                      totalHeapGb))
              .threshold("≤" + SearchClusterFitnessRules.MAX_SHARDS_PER_GB_HEAP + " shards/GB heap")
              .thresholdRationale(
                  "AWS sharding best practice — beyond this density, cluster-state size and per-shard "
                      + "overhead degrade search and indexing latency.")
              .recommendation(recommendation)
              .build());
    }
  }

  private void checkDedicatedMaster(
      List<FitnessSignal> signals, JsonNode health, List<NodeFootprint> nodes) {
    if (!isUsable(health)) {
      return;
    }
    int dataNodes = intValOrZero(health, "number_of_data_nodes");
    if (dataNodes < SearchClusterFitnessRules.DEDICATED_MASTER_DATA_NODE_THRESHOLD) {
      return;
    }
    long dedicatedMasters =
        nodes.stream()
            .filter(n -> n.getRoles() != null)
            .filter(n -> n.getRoles().contains("master") && !n.getRoles().contains("data"))
            .count();
    if (dedicatedMasters >= 3) {
      return;
    }
    signals.add(
        FitnessSignal.builder()
            .name("cluster.dedicated_master")
            .severity(FitnessSeverity.WARN)
            .observed("data_nodes=" + dataNodes + ", dedicated masters=" + dedicatedMasters)
            .threshold(
                "≥3 dedicated master nodes when data_nodes ≥ "
                    + SearchClusterFitnessRules.DEDICATED_MASTER_DATA_NODE_THRESHOLD)
            .thresholdRationale(
                "AWS recommends three dedicated master nodes for clusters at this scale so cluster-"
                    + "state operations (mapping updates, shard allocation) don't compete with data-node load.")
            .recommendation(
                "Provision three dedicated master-eligible nodes (no data role) on smaller instance "
                    + "classes than data nodes.")
            .build());
  }

  private int readMaxShardsPerNode(JsonNode settings) {
    int result = SearchClusterFitnessRules.DEFAULT_MAX_SHARDS_PER_NODE;
    if (settings != null) {
      Integer parsed = readSettingInt(settings, "cluster.max_shards_per_node");
      if (parsed != null && parsed > 0) {
        result = parsed;
      }
    }
    return result;
  }

  private Integer readSettingInt(JsonNode settings, String dottedKey) {
    Integer result = null;
    for (String tier : List.of("transient", "persistent", "defaults")) {
      JsonNode tierNode = settings.get(tier);
      if (tierNode == null) {
        continue;
      }
      JsonNode found = walk(tierNode, dottedKey);
      if (found != null && !found.isMissingNode()) {
        try {
          result = Integer.parseInt(found.asText());
          break;
        } catch (NumberFormatException ignored) {
          // try next tier
        }
      }
    }
    return result;
  }

  private String readSettingString(JsonNode settings, String dottedKey) {
    String result = null;
    for (String tier : List.of("transient", "persistent", "defaults")) {
      JsonNode tierNode = settings.get(tier);
      if (tierNode == null) {
        continue;
      }
      JsonNode found = walk(tierNode, dottedKey);
      if (found != null && !found.isMissingNode() && !found.isNull()) {
        result = found.asText();
        break;
      }
    }
    return result;
  }

  private JsonNode walk(JsonNode root, String dottedKey) {
    JsonNode current = root;
    for (String part : dottedKey.split("\\.")) {
      if (current == null || current.isMissingNode() || current.isNull()) {
        return null;
      }
      if (current.has(part)) {
        current = current.get(part);
      } else {
        // flat-settings form: a single key like "cluster.max_shards_per_node"
        if (root.has(dottedKey)) {
          return root.get(dottedKey);
        }
        return null;
      }
    }
    return current;
  }

  private void checkDocSizeAndShards(List<FitnessSignal> signals, List<IndexFootprint> indices) {
    for (IndexFootprint idx : indices) {
      checkAvgDocSize(signals, idx);
      checkShardSize(signals, idx);
      checkOverSharding(signals, idx);
    }
  }

  private void checkAvgDocSize(List<FitnessSignal> signals, IndexFootprint idx) {
    if (idx.getAvgDocBytes() == null || idx.getAvgDocBytes() <= 0) {
      return;
    }
    long avg = idx.getAvgDocBytes();
    FitnessSeverity severity = FitnessSeverity.PASS;
    String recommendation = null;
    if (avg >= SearchClusterFitnessRules.AVG_DOC_BYTES_FAIL) {
      severity = FitnessSeverity.FAIL;
      recommendation =
          "Documents are extremely large. Inspect sampleData, description, and any "
              + "nested arrays; consider trimming source or storing blobs outside the search index.";
    } else if (avg >= SearchClusterFitnessRules.AVG_DOC_BYTES_WARN) {
      severity = FitnessSeverity.WARN;
      recommendation =
          "Above target document size — heap pressure and search latency will scale "
              + "with this. Watch for runaway nested fields on this entity type.";
    }
    if (severity != FitnessSeverity.PASS) {
      signals.add(
          FitnessSignal.builder()
              .name("index.avg_doc_size:" + idx.getIndexName())
              .severity(severity)
              .observed(
                  humanBytes(avg)
                      + "/doc ("
                      + idx.getDocsCount()
                      + " docs, "
                      + humanBytes(
                          idx.getPrimarySizeBytes() == null ? 0 : idx.getPrimarySizeBytes())
                      + " primary)")
              .threshold(
                  "warn≥"
                      + humanBytes(SearchClusterFitnessRules.AVG_DOC_BYTES_WARN)
                      + ", fail≥"
                      + humanBytes(SearchClusterFitnessRules.AVG_DOC_BYTES_FAIL))
              .thresholdRationale(
                  "Document count alone hides true cost — a single 2MB entity stresses heap as much as 40 typical docs.")
              .recommendation(recommendation)
              .build());
    }
  }

  private void checkShardSize(List<FitnessSignal> signals, IndexFootprint idx) {
    if (idx.getPrimarySizeBytes() == null
        || idx.getPrimaryShards() == null
        || idx.getPrimaryShards() <= 0) {
      return;
    }
    long perShard = idx.getPrimarySizeBytes() / idx.getPrimaryShards();
    FitnessSeverity severity = FitnessSeverity.PASS;
    String recommendation = null;
    if (perShard >= SearchClusterFitnessRules.SHARD_SIZE_FAIL_BYTES) {
      severity = FitnessSeverity.FAIL;
      recommendation =
          "Primary shard is oversized. Reindex with more shards "
              + "(or use Split API) so each shard stays under 50GB.";
    } else if (perShard >= SearchClusterFitnessRules.SHARD_SIZE_WARN_BYTES) {
      severity = FitnessSeverity.WARN;
      recommendation =
          "Shards are getting large. Plan to reindex with a higher number_of_shards "
              + "before they cross 50GB and search latency degrades.";
    }
    if (severity != FitnessSeverity.PASS) {
      signals.add(
          FitnessSignal.builder()
              .name("index.shard_size:" + idx.getIndexName())
              .severity(severity)
              .observed(humanBytes(perShard) + "/shard × " + idx.getPrimaryShards() + " primary")
              .threshold(
                  "warn≥"
                      + humanBytes(SearchClusterFitnessRules.SHARD_SIZE_WARN_BYTES)
                      + ", fail≥"
                      + humanBytes(SearchClusterFitnessRules.SHARD_SIZE_FAIL_BYTES))
              .thresholdRationale(
                  "Elastic recommends keeping shard size between a few GB and ~50GB.")
              .recommendation(recommendation)
              .build());
    }
  }

  private void checkOverSharding(List<FitnessSignal> signals, IndexFootprint idx) {
    if (idx.getPrimarySizeBytes() == null
        || idx.getPrimaryShards() == null
        || idx.getPrimaryShards() <= 1) {
      return;
    }
    if (idx.getPrimarySizeBytes() < SearchClusterFitnessRules.INDEX_OVERSHARDED_SIZE_BYTES) {
      signals.add(
          FitnessSignal.builder()
              .name("index.over_sharded:" + idx.getIndexName())
              .severity(FitnessSeverity.INFO)
              .observed(
                  humanBytes(idx.getPrimarySizeBytes())
                      + " across "
                      + idx.getPrimaryShards()
                      + " primary shards")
              .threshold(
                  "<"
                      + humanBytes(SearchClusterFitnessRules.INDEX_OVERSHARDED_SIZE_BYTES)
                      + " should typically use 1 primary shard")
              .thresholdRationale(
                  "Small indices over-sharded waste file handles and slow search fan-out without scaling benefit.")
              .recommendation("Recreate this index with number_of_shards=1 next reindex.")
              .build());
    }
  }

  private void checkDiskWatermarks(
      List<FitnessSignal> signals,
      List<NodeFootprint> nodes,
      JsonNode clusterSettings,
      List<String> inaccessible) {
    if (!isUsable(clusterSettings) && !inaccessible.contains("/_cluster/settings")) {
      // Managed clusters (AWS OpenSearch) commonly block this; surface it so operators know the
      // watermark/shard-budget checks are running against defaults rather than real settings.
      inaccessible.add("/_cluster/settings");
    }
    double lowWatermark =
        readWatermarkPercent(
            clusterSettings, "cluster.routing.allocation.disk.watermark.low", 85.0, inaccessible);
    double highWatermark =
        readWatermarkPercent(
            clusterSettings, "cluster.routing.allocation.disk.watermark.high", 90.0, inaccessible);
    double floodWatermark =
        readWatermarkPercent(
            clusterSettings,
            "cluster.routing.allocation.disk.watermark.flood_stage",
            95.0,
            inaccessible);

    for (NodeFootprint node : nodes) {
      if (node.getDiskUsedPercent() == null) {
        continue;
      }
      double used = node.getDiskUsedPercent();
      FitnessSeverity severity = FitnessSeverity.PASS;
      String recommendation = null;
      double proximityFloor =
          lowWatermark * (1 - SearchClusterFitnessRules.WATERMARK_PROXIMITY_FRACTION);
      // All FAIL conditions are evaluated before any WARN condition so a soft/proximity WARN can
      // never downgrade a genuine overload — e.g. an admin who raises the low watermark above the
      // absolute fail threshold must not hide a node that is already past DISK_USAGE_FAIL_PERCENT.
      if (used >= floodWatermark) {
        severity = FitnessSeverity.FAIL;
        recommendation =
            "Past flood-stage watermark — indices on this node are read-only. "
                + "Free disk immediately and clear the index.blocks.read_only_allow_delete flag.";
      } else if (used >= highWatermark) {
        severity = FitnessSeverity.FAIL;
        recommendation =
            "Past high watermark — cluster will move shards off this node. Add disk or delete old data.";
      } else if (used >= SearchClusterFitnessRules.DISK_USAGE_FAIL_PERCENT) {
        severity = FitnessSeverity.FAIL;
        recommendation =
            "Disk usage is critically high. Free disk or add storage capacity to stay below the "
                + "ES/OS allocation watermarks and avoid indices going read-only.";
      } else if (used >= lowWatermark) {
        severity = FitnessSeverity.WARN;
        recommendation =
            "Past low watermark — no new shards will be allocated here. Plan to add disk before reindex.";
      } else if (used >= SearchClusterFitnessRules.DISK_USAGE_WARN_PERCENT) {
        severity = FitnessSeverity.WARN;
        recommendation =
            "Disk usage is elevated. Plan to free disk or add storage before it reaches the "
                + "ES/OS allocation watermarks.";
      } else if (used >= proximityFloor) {
        severity = FitnessSeverity.WARN;
        recommendation =
            "Approaching low watermark. Provision more disk during the next maintenance window.";
      }
      if (severity != FitnessSeverity.PASS) {
        signals.add(
            FitnessSignal.builder()
                .name("node.disk_usage:" + node.getName())
                .severity(severity)
                .observed(
                    String.format(
                        Locale.ROOT,
                        "%.1f%% used (avail %s of %s)",
                        used,
                        humanBytes(
                            node.getDiskAvailableBytes() == null
                                ? 0
                                : node.getDiskAvailableBytes()),
                        humanBytes(
                            node.getDiskTotalBytes() == null ? 0 : node.getDiskTotalBytes())))
                .threshold(
                    String.format(
                        Locale.ROOT,
                        "watermarks low=%.0f%%, high=%.0f%%, flood=%.0f%%; absolute warn=%.0f%%, fail=%.0f%%",
                        lowWatermark,
                        highWatermark,
                        floodWatermark,
                        SearchClusterFitnessRules.DISK_USAGE_WARN_PERCENT,
                        SearchClusterFitnessRules.DISK_USAGE_FAIL_PERCENT))
                .thresholdRationale(
                    "ES/OS allocation watermarks block new shards (low), relocate shards off (high), "
                        + "and flip indices read-only (flood). Independently, OpenMetadata warns at "
                        + "75% and fails at 85% absolute usage so a raised low watermark can't mask a "
                        + "genuinely full disk. Crossing low is already a search-reindex blocker.")
                .recommendation(recommendation)
                .build());
      }
    }
  }

  private double readWatermarkPercent(
      JsonNode settings, String key, double fallback, List<String> inaccessible) {
    double result = fallback;
    if (settings != null) {
      String raw = readSettingString(settings, key);
      Double parsed = parseWatermark(raw);
      if (parsed != null) {
        result = parsed;
      } else if (raw != null && !raw.isBlank()) {
        // Byte-form watermarks (e.g. "50gb") can't be turned into a percent without per-node disk
        // size context, so we fall back to the default percentage. Record it so the report is
        // self-describing rather than silently masking a low byte-based threshold.
        String note = key + "=" + raw + " (byte-form watermark; using " + fallback + "% fallback)";
        if (!inaccessible.contains(note)) {
          inaccessible.add(note);
        }
      }
    }
    return result;
  }

  private Double parseWatermark(String raw) {
    if (raw == null || raw.isEmpty()) {
      return null;
    }
    String trimmed = raw.trim();
    Double result = null;
    try {
      if (trimmed.endsWith("%")) {
        result = Double.parseDouble(trimmed.substring(0, trimmed.length() - 1));
      } else if (trimmed.matches("^-?\\d+(\\.\\d+)?$")) {
        double d = Double.parseDouble(trimmed);
        // Fractional values like "0.85" represent 85%
        result = d <= 1.0 ? d * 100 : d;
      }
    } catch (NumberFormatException ignored) {
      // Absolute byte values ("100gb") cannot be expressed as a percent without disk size context.
    }
    return result;
  }

  private void checkHeapAndCpu(
      List<FitnessSignal> signals, List<NodeFootprint> nodes, List<String> inaccessible) {
    for (NodeFootprint node : nodes) {
      if (node.getHeapUsedPercent() != null) {
        double heap = node.getHeapUsedPercent();
        FitnessSeverity severity = FitnessSeverity.PASS;
        String recommendation = null;
        if (heap >= SearchClusterFitnessRules.HEAP_USAGE_FAIL_PERCENT) {
          severity = FitnessSeverity.FAIL;
          recommendation =
              "Heap is saturated. Old-gen GC will dominate. Increase heap (cap at 31GB) "
                  + "or add data nodes. Restart-friendly reindex should be paused.";
        } else if (heap >= SearchClusterFitnessRules.HEAP_USAGE_WARN_PERCENT) {
          severity = FitnessSeverity.WARN;
          recommendation = "Heap pressure is elevated. Avoid concurrent bulk reindex jobs.";
        }
        if (severity != FitnessSeverity.PASS) {
          signals.add(
              FitnessSignal.builder()
                  .name("node.heap:" + node.getName())
                  .severity(severity)
                  .observed(
                      String.format(
                          Locale.ROOT,
                          "%.1f%% (max %s)",
                          heap,
                          humanBytes(node.getHeapMaxBytes() == null ? 0 : node.getHeapMaxBytes())))
                  .threshold(
                      String.format(
                          Locale.ROOT,
                          "warn≥%.0f%%, fail≥%.0f%%",
                          SearchClusterFitnessRules.HEAP_USAGE_WARN_PERCENT,
                          SearchClusterFitnessRules.HEAP_USAGE_FAIL_PERCENT))
                  .thresholdRationale(
                      "Above 85% heap, the JVM spends most of its time in Old-Gen GC and effectively single-threads.")
                  .recommendation(recommendation)
                  .build());
        }
      }
      if (node.getCpuPercent() != null) {
        double cpu = node.getCpuPercent();
        FitnessSeverity severity = FitnessSeverity.PASS;
        String recommendation = null;
        if (cpu >= SearchClusterFitnessRules.CPU_USAGE_FAIL_PERCENT) {
          severity = FitnessSeverity.FAIL;
          recommendation =
              "CPU is saturated. Small node being bombarded by search/index traffic — "
                  + "scale up instance class or distribute load across more nodes.";
        } else if (cpu >= SearchClusterFitnessRules.CPU_USAGE_WARN_PERCENT) {
          severity = FitnessSeverity.WARN;
          recommendation =
              "Sustained high CPU. Limit reindex producer/consumer threads and concurrent bulk requests.";
        }
        if (severity != FitnessSeverity.PASS) {
          signals.add(
              FitnessSignal.builder()
                  .name("node.cpu:" + node.getName())
                  .severity(severity)
                  .observed(String.format(Locale.ROOT, "%.1f%%", cpu))
                  .threshold(
                      String.format(
                          Locale.ROOT,
                          "warn≥%.0f%%, fail≥%.0f%%",
                          SearchClusterFitnessRules.CPU_USAGE_WARN_PERCENT,
                          SearchClusterFitnessRules.CPU_USAGE_FAIL_PERCENT))
                  .thresholdRationale(
                      "Sustained CPU pressure signals the instance class is too small for current load.")
                  .recommendation(recommendation)
                  .build());
        }
      }
    }
  }

  private void checkThreadPoolPressure(
      List<FitnessSignal> signals, List<NodeFootprint> nodes, List<String> inaccessible) {
    for (NodeFootprint node : nodes) {
      checkPool(
          signals,
          node,
          "write",
          node.getWriteQueueDepth(),
          node.getWriteRejectedTotal(),
          "Lower reindex --producer-threads / --consumer-threads, reduce batch size, or extend write queue_size.");
      checkPool(
          signals,
          node,
          "search",
          node.getSearchQueueDepth(),
          node.getSearchRejectedTotal(),
          "Search requests are being rejected — clients will see 429s. Throttle callers or scale out data nodes.");
    }
  }

  private void checkPool(
      List<FitnessSignal> signals,
      NodeFootprint node,
      String pool,
      Long queueDepth,
      Long rejected,
      String recommendation) {
    if (rejected == null && queueDepth == null) {
      return;
    }
    long rej = rejected == null ? 0 : rejected;
    long q = queueDepth == null ? 0 : queueDepth;
    FitnessSeverity severity = FitnessSeverity.PASS;
    if (rej > 0) {
      severity = FitnessSeverity.FAIL;
    } else if (q > 0) {
      severity = FitnessSeverity.INFO;
    }
    if (severity == FitnessSeverity.PASS) {
      return;
    }
    signals.add(
        FitnessSignal.builder()
            .name("node.threadpool." + pool + ":" + node.getName())
            .severity(severity)
            .observed("queue=" + q + ", rejected=" + rej)
            .threshold("rejected==0")
            .thresholdRationale(
                "Any "
                    + pool
                    + " thread-pool rejection means OpenMetadata writes/searches are being dropped at the cluster.")
            .recommendation(severity == FitnessSeverity.FAIL ? recommendation : null)
            .build());
  }

  private void checkCircuitBreakers(
      List<FitnessSignal> signals, List<NodeFootprint> nodes, List<String> inaccessible) {
    for (NodeFootprint node : nodes) {
      if (node.getCircuitBreakerTrips() == null || node.getCircuitBreakerTrips() == 0) {
        continue;
      }
      signals.add(
          FitnessSignal.builder()
              .name("node.circuit_breakers:" + node.getName())
              .severity(FitnessSeverity.FAIL)
              .observed("trips=" + node.getCircuitBreakerTrips())
              .threshold("0")
              .thresholdRationale(
                  "Any circuit breaker trip rejects a request. Usually parent/fielddata/in-flight — symptom of heap pressure.")
              .recommendation(
                  "Increase heap (cap 31GB) or reduce concurrent bulk size; check breakers.* for the specific breaker.")
              .build());
    }
  }

  private SizingGuidance buildSizingGuidance(
      SearchClusterFitnessReport report,
      List<NodeFootprint> nodes,
      long totalPrimaryBytes,
      long totalDocs,
      boolean omIndicesMissing) {
    // Sizing math must use *data* nodes — masters and coord-only nodes don't host shards or store
    // data. Fall back to node count or cluster-health number_of_data_nodes when role info is
    // absent.
    List<NodeFootprint> dataNodeFootprints = filterDataNodes(nodes);
    int dataNodes;
    if (!dataNodeFootprints.isEmpty()) {
      dataNodes = dataNodeFootprints.size();
    } else if (report.getDataNodes() != null && report.getDataNodes() > 0) {
      dataNodes = report.getDataNodes();
    } else {
      dataNodes = Math.max(1, nodes.size());
    }
    List<NodeFootprint> heapNodes = dataNodeFootprints.isEmpty() ? nodes : dataNodeFootprints;
    long observedHeapPerNode =
        heapNodes.stream()
            .map(NodeFootprint::getHeapMaxBytes)
            .filter(java.util.Objects::nonNull)
            .mapToLong(Long::longValue)
            .max()
            .orElse(0);

    SizingGuidance result;
    if (omIndicesMissing || totalPrimaryBytes == 0) {
      result =
          SizingGuidance.builder()
              .totalPrimarySizeBytes(0L)
              .totalDocsCount(0L)
              .observedDataNodes(dataNodes)
              .observedHeapPerNodeBytes(observedHeapPerNode == 0 ? null : observedHeapPerNode)
              .verdict("INSUFFICIENT_DATA")
              .rationale(
                  "No OpenMetadata-managed indices were found, so a sizing recommendation cannot "
                      + "be computed. Sizing requires observed primary data volume; re-run after "
                      + "reindex has populated the OpenMetadata indices, or check "
                      + "otherIndicesOnCluster to see what is actually present.")
              .build();
    } else {
      long recommendedHeap =
          Math.min(
              SearchClusterFitnessRules.MAX_RECOMMENDED_HEAP_BYTES,
              Math.max(
                  observedHeapPerNode,
                  totalPrimaryBytes
                      / SearchClusterFitnessRules.DATA_TO_HEAP_RATIO
                      / Math.max(1, dataNodes)));
      // AWS storage formula: source × (1 + replicas) × 1.45.
      // Assume replicas=1 for production projections (typical OpenMetadata setup).
      long projectedStorageBytes =
          (long)
              (totalPrimaryBytes * 2 * SearchClusterFitnessRules.AWS_STORAGE_OVERHEAD_MULTIPLIER);
      int minNodesForData =
          Math.max(
              1,
              (int)
                  Math.ceil(
                      (double) projectedStorageBytes
                          / SearchClusterFitnessRules.TARGET_NODE_DATA_SIZE_BYTES));
      // AWS production recommendation: at least +1 buffer node beyond the minimum.
      int recommendedDataNodes = minNodesForData + SearchClusterFitnessRules.DATA_NODE_BUFFER;
      if (recommendedDataNodes < dataNodes) {
        recommendedDataNodes = dataNodes;
      }
      long perNodeData = projectedStorageBytes / Math.max(1, recommendedDataNodes);
      long recommendedDisk =
          (long) (perNodeData * SearchClusterFitnessRules.DISK_HEADROOM_MULTIPLIER);
      String verdict =
          dataNodes >= recommendedDataNodes
                  && (observedHeapPerNode == 0 || observedHeapPerNode >= recommendedHeap)
              ? "ADEQUATE"
              : "UNDERSIZED";
      String rationale =
          String.format(
              Locale.ROOT,
              "Observed %s primary data across %d indices and %d docs on %d data node(s). "
                  + "Projected storage (AWS formula: source × (1+replicas) × %.2f) = %s assuming 1 replica. "
                  + "Heap = max(observed, totalData / %d / nodes) capped at 31GB. "
                  + "Data nodes = ceil(projected / %s target) + %d buffer (AWS production guidance). "
                  + "Disk per node = perNodeProjected × %.1f (merges + snapshots + watermark headroom).",
              humanBytes(totalPrimaryBytes),
              report.getTotalIndices() == null ? 0 : report.getTotalIndices(),
              totalDocs,
              dataNodes,
              SearchClusterFitnessRules.AWS_STORAGE_OVERHEAD_MULTIPLIER,
              humanBytes(projectedStorageBytes),
              SearchClusterFitnessRules.DATA_TO_HEAP_RATIO,
              humanBytes(SearchClusterFitnessRules.TARGET_NODE_DATA_SIZE_BYTES),
              SearchClusterFitnessRules.DATA_NODE_BUFFER,
              SearchClusterFitnessRules.DISK_HEADROOM_MULTIPLIER);
      result =
          SizingGuidance.builder()
              .totalPrimarySizeBytes(totalPrimaryBytes)
              .totalDocsCount(totalDocs)
              .observedDataNodes(dataNodes)
              .recommendedDataNodes(recommendedDataNodes)
              .observedHeapPerNodeBytes(observedHeapPerNode == 0 ? null : observedHeapPerNode)
              .recommendedHeapPerNodeBytes(recommendedHeap)
              .recommendedDiskPerNodeBytes(recommendedDisk)
              .verdict(verdict)
              .rationale(rationale)
              .build();
    }
    return result;
  }

  private FitnessVerdict rollup(List<FitnessSignal> signals, boolean omIndicesMissing) {
    boolean anyFail = false;
    boolean anyWarn = false;
    for (FitnessSignal s : signals) {
      if (s.getSeverity() == FitnessSeverity.FAIL) {
        anyFail = true;
      } else if (s.getSeverity() == FitnessSeverity.WARN) {
        anyWarn = true;
      }
    }
    FitnessVerdict verdict;
    if (omIndicesMissing) {
      verdict = anyFail ? FitnessVerdict.OVERLOADED : FitnessVerdict.UNKNOWN;
    } else if (anyFail) {
      verdict = FitnessVerdict.OVERLOADED;
    } else if (anyWarn) {
      verdict = FitnessVerdict.STRAINED;
    } else {
      verdict = FitnessVerdict.READY;
    }
    return verdict;
  }

  private String buildSummary(
      SearchClusterFitnessReport report,
      FitnessVerdict verdict,
      SizingGuidance sizing,
      boolean omIndicesMissing) {
    String headline =
        switch (verdict) {
          case READY -> "Cluster looks adequately sized for current data.";
          case STRAINED -> "Cluster is functional but showing pressure — see warnings.";
          case OVERLOADED -> "Cluster is undersized or failing checks — action required.";
          default -> omIndicesMissing
              ? "Cannot determine fitness — no OpenMetadata-managed indices found. "
                  + "Run reindex first, or check the openmetadata.indices_missing signal."
              : "Unable to determine cluster fitness.";
        };
    String sizingLine = "";
    if (sizing != null
        && sizing.getRecommendedDataNodes() != null
        && sizing.getTotalPrimarySizeBytes() != null
        && sizing.getTotalPrimarySizeBytes() > 0) {
      sizingLine =
          String.format(
              Locale.ROOT,
              " Observed %d data node(s); recommended ≥%d for %s of primary data.",
              sizing.getObservedDataNodes(),
              sizing.getRecommendedDataNodes(),
              humanBytes(sizing.getTotalPrimarySizeBytes()));
    }
    return headline + sizingLine;
  }

  private long sumPrimaryBytes(List<IndexFootprint> indices) {
    long sum = 0;
    for (IndexFootprint i : indices) {
      if (i.getPrimarySizeBytes() != null) {
        sum += i.getPrimarySizeBytes();
      }
    }
    return sum;
  }

  private long sumDocs(List<IndexFootprint> indices) {
    long sum = 0;
    for (IndexFootprint i : indices) {
      if (i.getDocsCount() != null) {
        sum += i.getDocsCount();
      }
    }
    return sum;
  }

  /**
   * Returns {@code true} when the probe response is a real JSON payload — not {@code null}, not a
   * Jackson {@code NullNode} / {@code MissingNode}. {@link SearchRestProbe#get} returns
   * {@code NullNode} on any failure, so this guard prevents downstream checks from emitting
   * misleading signals when an endpoint was actually inaccessible.
   */
  private boolean isUsable(JsonNode node) {
    return node != null && !node.isNull() && !node.isMissingNode();
  }

  private List<NodeFootprint> filterDataNodes(List<NodeFootprint> nodes) {
    return nodes.stream()
        .filter(n -> n.getRoles() != null)
        .filter(n -> n.getRoles().stream().anyMatch(r -> r.equals("data") || r.startsWith("data_")))
        .toList();
  }

  private String text(JsonNode node, String field) {
    String result = null;
    if (node != null && node.has(field) && !node.get(field).isNull()) {
      result = node.get(field).asText();
    }
    return result;
  }

  private Integer intVal(JsonNode node, String field) {
    Integer result = null;
    if (node != null && node.has(field) && node.get(field).isNumber()) {
      result = node.get(field).asInt();
    }
    return result;
  }

  private int intValOrZero(JsonNode node, String field) {
    Integer v = intVal(node, field);
    return v == null ? 0 : v;
  }

  private Long longVal(JsonNode node, String field) {
    Long result = null;
    if (node != null && node.has(field) && node.get(field).isNumber()) {
      result = node.get(field).asLong();
    }
    return result;
  }

  private Double doubleVal(JsonNode node, String field) {
    Double result = null;
    if (node != null && node.has(field) && node.get(field).isNumber()) {
      result = node.get(field).asDouble();
    }
    return result;
  }

  private Long parseLong(String s) {
    Long result = null;
    if (s != null) {
      try {
        result = Long.parseLong(s);
      } catch (NumberFormatException ignored) {
        // _cat sometimes returns "-" or blanks for missing values; leave null.
      }
    }
    return result;
  }

  private Integer parseInt(String s) {
    Integer result = null;
    if (s != null) {
      try {
        result = Integer.parseInt(s);
      } catch (NumberFormatException ignored) {
        // _cat sometimes returns "-" or blanks for missing values; leave null.
      }
    }
    return result;
  }

  private static String humanBytes(long bytes) {
    String result;
    if (bytes < 1024L) {
      result = bytes + "B";
    } else if (bytes < 1024L * 1024) {
      result = String.format(Locale.ROOT, "%.1fKB", bytes / 1024.0);
    } else if (bytes < 1024L * 1024 * 1024) {
      result = String.format(Locale.ROOT, "%.1fMB", bytes / (1024.0 * 1024));
    } else if (bytes < 1024L * 1024 * 1024 * 1024) {
      result = String.format(Locale.ROOT, "%.1fGB", bytes / (1024.0 * 1024 * 1024));
    } else {
      result = String.format(Locale.ROOT, "%.2fTB", bytes / (1024.0 * 1024 * 1024 * 1024));
    }
    return result;
  }
}
