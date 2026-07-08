/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.resources.ai;

import jakarta.json.JsonPatch;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.ai.AuditReport;
import org.openmetadata.schema.entity.ai.AuditReportArtifact;
import org.openmetadata.schema.entity.ai.AuditReportFormat;
import org.openmetadata.schema.entity.ai.AuditReportManifest;
import org.openmetadata.schema.entity.ai.AuditReportScope;
import org.openmetadata.schema.entity.ai.AuditReportStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.ServerIdentityResolver;
import org.openmetadata.service.jdbi3.AuditReportRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.EntityUtil;

/**
 * Async audit-pack generator. The Resource hands a freshly-created AuditReport to
 * {@link #submit(UUID)}; a shared virtual thread walks the scope, builds a JSON
 * document, encodes it as a data:application/json;base64 URL, and PATCHes the report
 * to Completed. Errors PATCH the report to Failed with the message.
 *
 * <p>Runs on the shared {@link AsyncService} rather than a private pool so it is not
 * capped per-pod and participates in server lifecycle. Because the AuditReport row is the
 * durable job record, jobs survive a pod restart: {@link #recoverInterruptedReports()}
 * (wired into server startup) re-drives {@code Queued} reports the crash left un-run and
 * reclaims {@code Running} reports orphaned mid-flight. Each job is claimed with an atomic
 * conditional {@code Queued -> Running} update (stamping the owning {@code runningOn} node), so
 * concurrent recovery across pods generates the pack exactly once. Re-submitting a duplicate
 * request returns the in-flight report via an indexed {@code requestSignature} lookup
 * ({@link #findActiveDuplicate(AuditReport)}) instead of generating the same pack twice.
 *
 * <p>Storage strategy is deliberately simple in v1: the artifact bytes are
 * embedded directly in the artifacts[] entry's downloadUrl. PDF rendering is
 * deferred — Pdf/Both reports complete as JSON-only with a note in the manifest.
 */
@Slf4j
public final class AuditPackGenerator {
  private static final String ADMIN_USER = "admin";
  private static final int PAGE_SIZE = 500;

  /**
   * A {@code Running} report whose {@code startedAt} is older than this is treated as orphaned by
   * a crashed pod and re-queued on recovery. Audit assembly is in-memory JSON that completes in
   * seconds, so a generous window avoids reclaiming a genuinely in-flight job.
   */
  private static final long STALE_RUNNING_MILLIS = 15 * 60 * 1000L;

  private static final int RECOVERY_SCAN_CAP = 10000;

  private AuditPackGenerator() {}

  static void submit(UUID reportId) {
    AsyncService.getInstance().execute(() -> run(reportId));
  }

  private static void run(UUID reportId) {
    long started = System.currentTimeMillis();
    int claimed =
        Entity.getCollectionDAO()
            .auditReportDAO()
            .claimQueued(reportId.toString(), currentServerId(), started);
    if (claimed == 0) {
      // No longer Queued, or another pod atomically won the claim — nothing to do.
      return;
    }
    AuditReportRepository repository = auditReportRepository();
    AuditReport report;
    try {
      report = repository.get(null, reportId, repository.getFields("id,name,scope,format"));
    } catch (Exception e) {
      LOG.warn(
          "Audit pack generator could not fetch claimed report {}: {}", reportId, e.getMessage());
      return;
    }
    try {
      AuditPackPayload payload = assemble(report);
      String json = JsonUtils.pojoToJson(payload.body);
      byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
      AuditReportArtifact artifact = new AuditReportArtifact();
      artifact.setFormat(AuditReportFormat.Json);
      artifact.setSizeBytes(bytes.length);
      artifact.setChecksum("sha256:" + sha256(bytes));
      artifact.setDownloadUrl(
          "data:application/json;base64," + Base64.getEncoder().encodeToString(bytes));
      List<AuditReportArtifact> artifacts = new ArrayList<>();
      artifacts.add(artifact);

      AuditReportManifest manifest = new AuditReportManifest();
      manifest.setAssetCount(payload.assetCount);
      manifest.setFrameworkCount(payload.frameworkCount);
      manifest.setControlCount(payload.controlCount);
      manifest.setComplianceRecordCount(payload.complianceRecordCount);

      updateReport(
          reportId,
          AuditPackGenerator::isRunningOnCurrentServer,
          current -> {
            current.setStatus(AuditReportStatus.Completed);
            current.setCompletedAt(System.currentTimeMillis());
            current.setArtifacts(artifacts);
            current.setManifest(manifest);
          });
    } catch (Exception failure) {
      LOG.warn("Audit pack generation failed for {}", reportId, failure);
      String message = failure.getMessage();
      updateReport(
          reportId,
          AuditPackGenerator::isRunningOnCurrentServer,
          current -> {
            current.setStatus(AuditReportStatus.Failed);
            current.setCompletedAt(System.currentTimeMillis());
            current.setFailureReason(message);
          });
    }
  }

  /**
   * Re-drives audit reports left non-terminal by a pod restart or crash: {@code Queued} reports
   * were never picked up (the previous in-memory queue did not survive), and {@code Running}
   * reports older than {@link #STALE_RUNNING_MILLIS} were orphaned mid-run. Both are safe to
   * regenerate — an audit pack is a deterministic snapshot. Wired into server startup.
   */
  public static void recoverInterruptedReports() {
    try {
      long now = System.currentTimeMillis();
      List<AuditReport> interrupted = collectInterruptedReports(now);
      for (AuditReport report : interrupted) {
        requeueAndSubmit(report, now);
      }
      if (!interrupted.isEmpty()) {
        LOG.info(
            "Audit pack recovery: re-submitted {} interrupted report(s) on startup",
            interrupted.size());
      }
    } catch (Exception recoveryError) {
      LOG.warn("Audit pack recovery sweep failed: {}", recoveryError.getMessage());
    }
  }

  /** Computes and stamps the request signature backing indexed idempotent-submission dedup. */
  static void stampRequestSignature(AuditReport report) {
    report.setRequestSignature(sha256(signatureOf(report).getBytes(StandardCharsets.UTF_8)));
  }

  /**
   * Returns the in-flight ({@code Queued}/{@code Running}) report whose request signature matches
   * {@code candidate} via an indexed O(1) lookup, so a retried submission returns the existing job
   * instead of generating the same pack twice. {@code candidate} must already carry its
   * {@code requestSignature} (see {@link #stampRequestSignature}).
   */
  static AuditReport findActiveDuplicate(AuditReport candidate) {
    AuditReport result = null;
    try {
      String signature = candidate.getRequestSignature();
      if (signature != null) {
        String json =
            Entity.getCollectionDAO().auditReportDAO().findActiveByRequestSignature(signature);
        if (json != null) {
          result = JsonUtils.readValue(json, AuditReport.class);
        }
      }
    } catch (Exception lookupError) {
      LOG.warn("Audit pack duplicate lookup failed: {}", lookupError.getMessage());
    }
    return result;
  }

  private static List<AuditReport> collectInterruptedReports(long now) {
    AuditReportRepository repository = auditReportRepository();
    List<AuditReport> result = new ArrayList<>();
    ListFilter filter = new ListFilter(Include.NON_DELETED);
    String after = null;
    int scanned = 0;
    do {
      ResultList<AuditReport> page =
          repository.listAfter(null, EntityUtil.Fields.EMPTY_FIELDS, filter, PAGE_SIZE, after);
      for (AuditReport report : page.getData()) {
        if (isInterrupted(report, now)) {
          result.add(report);
        }
      }
      scanned += page.getData().size();
      after = page.getPaging() == null ? null : page.getPaging().getAfter();
    } while (after != null && scanned < RECOVERY_SCAN_CAP);
    return result;
  }

  static boolean isInterrupted(AuditReport report, long now) {
    boolean result = false;
    AuditReportStatus status = report.getStatus();
    if (status == AuditReportStatus.Queued) {
      result = true;
    } else if (status == AuditReportStatus.Running) {
      Long startedAt = report.getStartedAt();
      result = startedAt == null || now - startedAt > STALE_RUNNING_MILLIS;
    }
    return result;
  }

  private static void requeueAndSubmit(AuditReport report, long now) {
    if (report.getStatus() == AuditReportStatus.Running) {
      boolean requeued =
          updateReport(
              report.getId(),
              current ->
                  current.getStatus() == AuditReportStatus.Running && isInterrupted(current, now),
              current -> {
                current.setStatus(AuditReportStatus.Queued);
                current.setRunningOn(null);
                current.setStartedAt(null);
              });
      if (!requeued) {
        return;
      }
    }
    submit(report.getId());
  }

  static String signatureOf(AuditReport report) {
    return String.join(
        "|",
        enumValue(report.getScope()),
        refId(report.getScopeTarget()),
        refId(report.getFramework()),
        enumValue(report.getFormat()),
        String.valueOf(report.getAsOfDate()),
        String.valueOf(Boolean.TRUE.equals(report.getIncludeRedacted())),
        report.getUpdatedBy() == null ? "" : report.getUpdatedBy());
  }

  private static String enumValue(Object enumConstant) {
    return enumConstant == null ? "" : enumConstant.toString();
  }

  private static String refId(EntityReference ref) {
    return ref == null || ref.getId() == null ? "" : ref.getId().toString();
  }

  private static String currentServerId() {
    return ServerIdentityResolver.getInstance().getServerId();
  }

  private static AuditReportRepository auditReportRepository() {
    return (AuditReportRepository) Entity.getEntityRepository(Entity.AUDIT_REPORT);
  }

  private static boolean updateReport(UUID reportId, Consumer<AuditReport> mutation) {
    return updateReport(reportId, current -> true, mutation);
  }

  private static boolean updateReport(
      UUID reportId, Predicate<AuditReport> precondition, Consumer<AuditReport> mutation) {
    AuditReportRepository repository = auditReportRepository();
    try {
      AuditReport current =
          repository.get(
              null,
              reportId,
              repository.getFields("id,name,status,runningOn,startedAt,artifacts,manifest"));
      if (isTerminal(current.getStatus()) || !precondition.test(current)) {
        return false;
      }
      String originalJson = JsonUtils.pojoToJson(current);
      mutation.accept(current);
      String updatedJson = JsonUtils.pojoToJson(current);
      JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);
      repository.patch(null, reportId, ADMIN_USER, patch);
      return true;
    } catch (Exception updateError) {
      LOG.warn("Failed to update audit report {}: {}", reportId, updateError.getMessage());
      return false;
    }
  }

  private static boolean isRunningOnCurrentServer(AuditReport report) {
    return report.getStatus() == AuditReportStatus.Running
        && currentServerId().equals(report.getRunningOn());
  }

  private static boolean isTerminal(AuditReportStatus status) {
    return status == AuditReportStatus.Cancelled
        || status == AuditReportStatus.Completed
        || status == AuditReportStatus.Failed;
  }

  private static AuditPackPayload assemble(AuditReport report) {
    AuditPackPayload payload = new AuditPackPayload();
    payload.body.put("reportId", report.getId() == null ? null : report.getId().toString());
    payload.body.put("name", report.getName());
    payload.body.put("scope", report.getScope() == null ? null : report.getScope().value());
    payload.body.put("framework", report.getFramework());
    payload.body.put("scopeTarget", report.getScopeTarget());
    payload.body.put("asOfDate", report.getAsOfDate());
    payload.body.put("generatedAt", System.currentTimeMillis());

    List<Map<String, Object>> assets = new ArrayList<>();
    AuditReportScope scope =
        report.getScope() == null ? AuditReportScope.Estate : report.getScope();
    collectAssets(Entity.AI_APPLICATION, scope, report, assets);
    collectAssets(Entity.LLM_MODEL, scope, report, assets);
    collectAssets(Entity.MCP_SERVER, scope, report, assets);

    payload.body.put("assets", assets);
    payload.assetCount = assets.size();
    payload.complianceRecordCount = countComplianceRecords(assets);
    payload.frameworkCount = report.getFramework() == null ? 0 : 1;
    return payload;
  }

  /**
   * Asset entries are the normalized JSON maps assembled in {@link #collectAssets}, not
   * typed POJOs, so the nested governance structure is walked with {@code instanceof}
   * guards rather than getters.
   */
  @SuppressWarnings("unchecked")
  private static int countComplianceRecords(List<Map<String, Object>> assets) {
    int total = 0;
    for (Map<String, Object> asset : assets) {
      Object governance = asset.get("governanceMetadata");
      if (governance instanceof Map<?, ?> g) {
        Object aiCompliance = ((Map<String, Object>) g).get("aiCompliance");
        if (aiCompliance instanceof Map<?, ?> c) {
          Object records = ((Map<String, Object>) c).get("complianceRecords");
          if (records instanceof List<?> list) {
            total += list.size();
          }
        }
      }
    }
    return total;
  }

  private static void collectAssets(
      String entityType,
      AuditReportScope scope,
      AuditReport report,
      List<Map<String, Object>> out) {
    try {
      ListFilter filter = new ListFilter(Include.NON_DELETED);
      List<? extends EntityInterface> entities =
          listAssets(entityType, filter, fieldsForScope(entityType, scope));
      for (EntityInterface entity : entities) {
        if (scope == AuditReportScope.Asset && report.getScopeTarget() != null) {
          if (!report.getScopeTarget().getId().equals(entity.getId())) {
            continue;
          }
        }
        if (scope == AuditReportScope.Domain && report.getScopeTarget() != null) {
          Object domains = entity.getDomains();
          if (!matchesDomain(domains, report.getScopeTarget().getId())) {
            continue;
          }
        }
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("entityType", entityType);
        entry.put("id", entity.getId() == null ? null : entity.getId().toString());
        entry.put("name", entity.getName());
        entry.put("displayName", entity.getDisplayName());
        entry.put("fullyQualifiedName", entity.getFullyQualifiedName());
        Map<String, Object> entityMap =
            JsonUtils.readValue(JsonUtils.pojoToJson(entity), Map.class);
        entry.put("governanceMetadata", entityMap.get("governanceMetadata"));
        entry.put("updatedAt", entity.getUpdatedAt());
        out.add(entry);
      }
    } catch (Exception e) {
      LOG.debug("Audit pack scope walk for {} returned empty: {}", entityType, e.getMessage());
    }
  }

  private static List<EntityInterface> listAssets(
      String entityType, ListFilter filter, EntityUtil.Fields fields) {
    List<EntityInterface> result = new ArrayList<>();
    EntityRepository<? extends EntityInterface> repo = Entity.getEntityRepository(entityType);
    String after = null;
    do {
      ResultList<? extends EntityInterface> page =
          repo.listAfter(null, fields, filter, PAGE_SIZE, after);
      result.addAll(page.getData());
      after = page.getPaging() == null ? null : page.getPaging().getAfter();
    } while (after != null);

    return result;
  }

  /**
   * Domain-scoped packs filter on {@link EntityInterface#getDomains()}; {@code domains}
   * is a relationship field that stays null unless explicitly requested, so a Domain
   * pack loaded with {@code EMPTY_FIELDS} would match nothing. Estate/Asset scopes read
   * only the always-present governance JSON and need no relationship fields.
   */
  private static EntityUtil.Fields fieldsForScope(String entityType, AuditReportScope scope) {
    EntityUtil.Fields result = EntityUtil.Fields.EMPTY_FIELDS;
    if (scope == AuditReportScope.Domain) {
      result = Entity.getEntityRepository(entityType).getFields("domains");
    }
    return result;
  }

  @SuppressWarnings("unchecked")
  private static boolean matchesDomain(Object domains, UUID targetDomainId) {
    if (!(domains instanceof List<?> list)) {
      return false;
    }
    for (Object item : list) {
      if (item instanceof Map<?, ?> ref) {
        Object id = ((Map<String, Object>) ref).get("id");
        if (id != null && id.toString().equals(targetDomainId.toString())) {
          return true;
        }
      }
    }
    return false;
  }

  private static String sha256(byte[] data) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-256");
      return HexFormat.of().formatHex(md.digest(data));
    } catch (Exception e) {
      return "";
    }
  }

  private static final class AuditPackPayload {
    Map<String, Object> body = new LinkedHashMap<>();
    int assetCount;
    int frameworkCount;
    int controlCount;
    int complianceRecordCount;
  }
}
