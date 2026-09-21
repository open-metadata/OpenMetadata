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

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.AuditReport;
import org.openmetadata.schema.entity.ai.AuditReportArtifact;
import org.openmetadata.schema.entity.ai.AuditReportFormat;
import org.openmetadata.schema.entity.ai.AuditReportManifest;
import org.openmetadata.schema.entity.ai.AuditReportScope;
import org.openmetadata.schema.entity.ai.AuditReportStatus;
import org.openmetadata.schema.entity.ai.McpServer;
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
import org.openmetadata.service.util.AsyncService.DatabaseOperation;
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
 * embedded directly in the artifacts[] entry's downloadUrl. The requested
 * {@link AuditReportFormat} selects which artifacts are produced — {@code Json} the
 * lossless machine-readable bundle, {@code Pdf} the auditor-facing document, {@code Both}
 * one of each. The PDF itself is rendered by whichever {@link AuditPackPdfRenderer} the
 * distribution registered via {@link #setPdfRenderer(AuditPackPdfRenderer)}; with none
 * registered the pack still completes, carrying JSON alone.
 */
@Slf4j
public final class AuditPackGenerator {
  private static final String ADMIN_USER = "admin";
  private static final int PAGE_SIZE = 500;
  private static final String JSON_DATA_URL_PREFIX = "data:application/json;base64,";
  private static final String PDF_DATA_URL_PREFIX = "data:application/pdf;base64,";
  private static final String CHECKSUM_PREFIX = "sha256:";

  /**
   * Set once at startup, read by audit jobs on virtual threads — volatile so a generator thread
   * cannot observe a half-published renderer.
   */
  private static volatile AuditPackPdfRenderer pdfRenderer;

  /**
   * A {@code Running} report whose {@code startedAt} is older than this is treated as orphaned by
   * a crashed pod and re-queued on recovery. Audit assembly is in-memory JSON that completes in
   * seconds, so a generous window avoids reclaiming a genuinely in-flight job.
   */
  private static final long STALE_RUNNING_MILLIS = 15 * 60 * 1000L;

  private static final int RECOVERY_SCAN_CAP = 10000;

  private AuditPackGenerator() {}

  /**
   * Installs the renderer that turns audit packs into PDFs. Call once during server startup and
   * before {@link #recoverInterruptedReports()}, otherwise packs recovered from a restart complete
   * as JSON-only. Passing {@code null} restores the JSON-only default.
   */
  public static void setPdfRenderer(AuditPackPdfRenderer renderer) {
    pdfRenderer = renderer;
  }

  static void submit(UUID reportId) {
    AsyncService.getInstance()
        .executeDatabaseTask(
            DatabaseOperation.AUDIT_PACK, reportId.toString(), () -> run(reportId));
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
      AuditReportManifest manifest = manifestOf(payload);
      completeRunning(reportId, buildArtifacts(report, payload.body, manifest), manifest);
    } catch (Exception failure) {
      LOG.warn("Audit pack generation failed for {}", reportId, failure);
      failRunning(reportId, failureMessage(failure));
    }
  }

  private static AuditReportManifest manifestOf(AuditPackPayload payload) {
    AuditReportManifest manifest = new AuditReportManifest();
    manifest.setAssetCount(payload.assetCount);
    manifest.setFrameworkCount(payload.frameworkCount);
    manifest.setControlCount(payload.controlCount);
    manifest.setComplianceRecordCount(payload.complianceRecordCount);
    return manifest;
  }

  /**
   * Produces one artifact per format the request asked for. An unset format keeps the historical
   * JSON-only behaviour so packs requested before PDF rendering existed still regenerate identically
   * on recovery. JSON is also emitted as the fallback when a {@code Pdf} pack cannot be rendered, so
   * a Completed report always has something to download rather than an empty artifact list.
   */
  static List<AuditReportArtifact> buildArtifacts(
      AuditReport report, AuditPackDocument body, AuditReportManifest manifest) {
    AuditReportFormat format =
        report.getFormat() == null ? AuditReportFormat.Json : report.getFormat();
    Optional<byte[]> pdf =
        format == AuditReportFormat.Json ? Optional.empty() : renderPdf(body, manifest);
    List<AuditReportArtifact> artifacts = new ArrayList<>();
    if (format != AuditReportFormat.Pdf || pdf.isEmpty()) {
      artifacts.add(jsonArtifact(body));
    }
    pdf.ifPresent(
        bytes -> artifacts.add(artifact(AuditReportFormat.Pdf, PDF_DATA_URL_PREFIX, bytes)));
    return artifacts;
  }

  private static Optional<byte[]> renderPdf(AuditPackDocument body, AuditReportManifest manifest) {
    AuditPackPdfRenderer renderer = pdfRenderer;
    Optional<byte[]> result = Optional.empty();
    if (renderer == null) {
      LOG.warn("Audit pack PDF requested but no renderer is registered; completing with JSON only");
    } else {
      result = renderSafely(renderer, body, manifest);
    }
    return result;
  }

  /**
   * The renderer is supplied by the distribution, so from here it is untrusted code: the
   * JSON-fallback guarantee has to hold even when an implementation ignores the contract and
   * throws, or hands back a null Optional. Without this the exception would reach
   * {@link #run(UUID)} and mark the whole report Failed — exactly what pluggability was meant to
   * avoid. Broad by design: any failure inside a third-party renderer must degrade rather than
   * lose the pack.
   */
  private static Optional<byte[]> renderSafely(
      AuditPackPdfRenderer renderer, AuditPackDocument body, AuditReportManifest manifest) {
    Optional<byte[]> result = Optional.empty();
    try {
      Optional<byte[]> rendered = renderer.render(body, manifest);
      result = rendered == null ? Optional.empty() : rendered;
    } catch (Exception rendererFailure) {
      LOG.warn("Audit pack PDF renderer failed; completing with JSON only", rendererFailure);
    }
    return result;
  }

  private static AuditReportArtifact jsonArtifact(AuditPackDocument body) {
    byte[] bytes = JsonUtils.pojoToJson(body).getBytes(StandardCharsets.UTF_8);
    return artifact(AuditReportFormat.Json, JSON_DATA_URL_PREFIX, bytes);
  }

  private static AuditReportArtifact artifact(
      AuditReportFormat format, String dataUrlPrefix, byte[] bytes) {
    AuditReportArtifact artifact = new AuditReportArtifact();
    artifact.setFormat(format);
    artifact.setSizeBytes(bytes.length);
    artifact.setChecksum(CHECKSUM_PREFIX + sha256(bytes));
    artifact.setDownloadUrl(dataUrlPrefix + Base64.getEncoder().encodeToString(bytes));
    return artifact;
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
      int requeued =
          Entity.getCollectionDAO()
              .auditReportDAO()
              .requeueStaleRunning(
                  report.getId().toString(), now - STALE_RUNNING_MILLIS, now, ADMIN_USER);
      if (requeued == 0) {
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

  private static void completeRunning(
      UUID reportId, List<AuditReportArtifact> artifacts, AuditReportManifest manifest) {
    Entity.getCollectionDAO()
        .auditReportDAO()
        .completeRunning(
            reportId.toString(),
            currentServerId(),
            System.currentTimeMillis(),
            JsonUtils.pojoToJson(artifacts),
            JsonUtils.pojoToJson(manifest),
            ADMIN_USER);
  }

  private static void failRunning(UUID reportId, String failureReason) {
    Entity.getCollectionDAO()
        .auditReportDAO()
        .failRunning(
            reportId.toString(),
            currentServerId(),
            System.currentTimeMillis(),
            failureReason,
            ADMIN_USER);
  }

  private static String failureMessage(Exception failure) {
    String message = failure.getMessage();
    return message == null ? failure.getClass().getSimpleName() : message;
  }

  private static AuditPackPayload assemble(AuditReport report) {
    AuditPackPayload payload = new AuditPackPayload();
    List<AuditPackAsset> assets = new ArrayList<>();
    AuditReportScope scope =
        report.getScope() == null ? AuditReportScope.Estate : report.getScope();
    collectAssets(Entity.AI_APPLICATION, scope, report, assets);
    collectAssets(Entity.LLM_MODEL, scope, report, assets);
    collectAssets(Entity.MCP_SERVER, scope, report, assets);

    payload.body =
        new AuditPackDocument(
            report.getId() == null ? null : report.getId().toString(),
            report.getName(),
            report.getScope() == null ? null : report.getScope().value(),
            report.getFramework(),
            report.getScopeTarget(),
            report.getAsOfDate(),
            System.currentTimeMillis(),
            assets);
    payload.assetCount = assets.size();
    payload.complianceRecordCount = countComplianceRecords(assets);
    payload.frameworkCount = report.getFramework() == null ? 0 : 1;
    return payload;
  }

  private static int countComplianceRecords(List<AuditPackAsset> assets) {
    int total = 0;
    for (AuditPackAsset asset : assets) {
      total += asset.complianceRecords().size();
    }
    return total;
  }

  private static void collectAssets(
      String entityType, AuditReportScope scope, AuditReport report, List<AuditPackAsset> out) {
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
          if (!matchesDomain(entity.getDomains(), report.getScopeTarget().getId())) {
            continue;
          }
        }
        out.add(
            new AuditPackAsset(
                entityType,
                entity.getId() == null ? null : entity.getId().toString(),
                entity.getName(),
                entity.getDisplayName(),
                entity.getFullyQualifiedName(),
                governanceMetadata(entity),
                entity.getUpdatedAt()));
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
   * only the always-present governance fields and need no relationship fields.
   */
  private static EntityUtil.Fields fieldsForScope(String entityType, AuditReportScope scope) {
    EntityUtil.Fields result = EntityUtil.Fields.EMPTY_FIELDS;
    if (scope == AuditReportScope.Domain) {
      result = Entity.getEntityRepository(entityType).getFields("domains");
    }
    return result;
  }

  private static Object governanceMetadata(EntityInterface entity) {
    Object result = null;
    if (entity instanceof AIApplication app) {
      result = app.getGovernanceMetadata();
    } else if (entity instanceof McpServer server) {
      result = server.getGovernanceMetadata();
    }
    return result;
  }

  private static boolean matchesDomain(List<EntityReference> domains, UUID targetDomainId) {
    if (domains == null) {
      return false;
    }
    for (EntityReference domain : domains) {
      if (domain != null && domain.getId() != null && domain.getId().equals(targetDomainId)) {
        return true;
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
    AuditPackDocument body;
    int assetCount;
    int frameworkCount;
    int controlCount;
    int complianceRecordCount;
  }
}
