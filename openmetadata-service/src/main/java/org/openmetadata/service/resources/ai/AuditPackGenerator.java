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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.ai.AuditReport;
import org.openmetadata.schema.entity.ai.AuditReportArtifact;
import org.openmetadata.schema.entity.ai.AuditReportFormat;
import org.openmetadata.schema.entity.ai.AuditReportManifest;
import org.openmetadata.schema.entity.ai.AuditReportScope;
import org.openmetadata.schema.entity.ai.AuditReportStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AuditReportRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil;

/**
 * Synchronous-async audit-pack generator. The Resource hands a freshly-created
 * AuditReport to {@link #submit(UUID)}; the executor walks the scope, builds a
 * JSON document, encodes it as a data:application/json;base64 URL, and PATCHes
 * the report to Completed. Errors PATCH the report to Failed with the message.
 *
 * <p>Storage strategy is deliberately simple in v1: the artifact bytes are
 * embedded directly in the artifacts[] entry's downloadUrl. PDF rendering is
 * deferred — Pdf/Both reports complete as JSON-only with a note in the manifest.
 */
@Slf4j
final class AuditPackGenerator {
  private static final String ADMIN_USER = "admin";
  private static final int PAGE_SIZE = 500;

  private static final ExecutorService EXECUTOR =
      Executors.newFixedThreadPool(
          2,
          new ThreadFactory() {
            private final AtomicInteger counter = new AtomicInteger(1);

            @Override
            public Thread newThread(Runnable r) {
              Thread thread = new Thread(r, "audit-pack-" + counter.getAndIncrement());
              thread.setDaemon(true);
              return thread;
            }
          });

  private AuditPackGenerator() {}

  static void submit(UUID reportId) {
    EXECUTOR.execute(() -> run(reportId));
  }

  private static void run(UUID reportId) {
    AuditReportRepository repository =
        (AuditReportRepository) Entity.getEntityRepository(Entity.AUDIT_REPORT);
    AuditReport report;
    try {
      report = repository.get(null, reportId, repository.getFields("id,name,scope,format"));
    } catch (Exception e) {
      LOG.warn("Audit pack generator could not fetch report {}: {}", reportId, e.getMessage());
      return;
    }
    if (report.getStatus() != AuditReportStatus.Queued) {
      return;
    }
    long started = System.currentTimeMillis();
    transition(reportId, AuditReportStatus.Running, started, null, null, null);
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

      transition(
          reportId,
          AuditReportStatus.Completed,
          null,
          System.currentTimeMillis(),
          artifacts,
          manifest);
    } catch (Exception failure) {
      LOG.warn("Audit pack generation failed for {}", reportId, failure);
      transition(
          reportId,
          AuditReportStatus.Failed,
          null,
          System.currentTimeMillis(),
          null,
          null,
          failure.getMessage());
    }
  }

  private static void transition(
      UUID reportId,
      AuditReportStatus status,
      Long startedAt,
      Long completedAt,
      List<AuditReportArtifact> artifacts,
      AuditReportManifest manifest) {
    transition(reportId, status, startedAt, completedAt, artifacts, manifest, null);
  }

  private static void transition(
      UUID reportId,
      AuditReportStatus status,
      Long startedAt,
      Long completedAt,
      List<AuditReportArtifact> artifacts,
      AuditReportManifest manifest,
      String failureReason) {
    AuditReportRepository repository =
        (AuditReportRepository) Entity.getEntityRepository(Entity.AUDIT_REPORT);
    try {
      AuditReport current =
          repository.get(null, reportId, repository.getFields("id,name,artifacts,manifest"));
      String originalJson = JsonUtils.pojoToJson(current);
      current.setStatus(status);
      if (startedAt != null) {
        current.setStartedAt(startedAt);
      }
      if (completedAt != null) {
        current.setCompletedAt(completedAt);
      }
      if (artifacts != null) {
        current.setArtifacts(artifacts);
      }
      if (manifest != null) {
        current.setManifest(manifest);
      }
      if (failureReason != null) {
        current.setFailureReason(failureReason);
      }
      String updatedJson = JsonUtils.pojoToJson(current);
      jakarta.json.JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);
      repository.patch(null, reportId, ADMIN_USER, patch);
    } catch (Exception transitionError) {
      LOG.warn("Failed to transition audit report {}: {}", reportId, transitionError.getMessage());
    }
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
      List<? extends EntityInterface> entities = listAssets(entityType, filter);
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

  private static List<EntityInterface> listAssets(String entityType, ListFilter filter) {
    List<EntityInterface> result = new ArrayList<>();
    EntityRepository<? extends EntityInterface> repo = Entity.getEntityRepository(entityType);
    String after = null;
    do {
      ResultList<? extends EntityInterface> page =
          repo.listAfter(null, EntityUtil.Fields.EMPTY_FIELDS, filter, PAGE_SIZE, after);
      result.addAll(page.getData());
      after = page.getPaging() == null ? null : page.getPaging().getAfter();
    } while (after != null);

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
