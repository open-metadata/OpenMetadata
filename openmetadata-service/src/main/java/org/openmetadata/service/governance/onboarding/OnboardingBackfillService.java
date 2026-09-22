package org.openmetadata.service.governance.onboarding;

import jakarta.ws.rs.WebApplicationException;
import java.util.ArrayList;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.governance.OnboardingPlaybook;
import org.openmetadata.schema.governance.onboarding.Failure;
import org.openmetadata.schema.governance.onboarding.OnboardingBackfill;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;

public final class OnboardingBackfillService {
  private static final int PAGE_SIZE = 50;
  private static final int FAILURE_LIMIT = 100;

  private OnboardingBackfillService() {}

  public static OnboardingBackfill get(String type) {
    OnboardingService.requireType(type);
    OnboardingPlaybook playbook = OnboardingService.configured(type);
    if (!OnboardingEvaluator.isEnabled(playbook)) return null;
    String json = OnboardingStore.dao().getBackfill(playbook.getId().toString());
    return json == null ? null : JsonUtils.readValue(json, OnboardingBackfill.class);
  }

  public static OnboardingBackfill retry(String type) {
    OnboardingPlaybook playbook = OnboardingService.configured(type);
    if (!OnboardingEvaluator.isEnabled(playbook))
      throw new IllegalArgumentException("Enable onboarding before starting backfill");
    initialize(playbook);
    String lease = claim(playbook);
    if (lease == null)
      throw new WebApplicationException("Backfill is processing a page; retry shortly", 409);
    try {
      var progress = get(type);
      progress.withCursor(null).withComplete(false).withFailures(new ArrayList<>());
      save(progress);
      return progress;
    } finally {
      OnboardingStore.dao().releaseBackfill(playbook.getId().toString(), lease);
    }
  }

  public static void runPage(String type) {
    OnboardingPlaybook playbook = OnboardingService.configured(type);
    if (!OnboardingEvaluator.isEnabled(playbook)) return;
    initialize(playbook);
    String lease = claim(playbook);
    if (lease == null) return;
    try {
      var progress = get(type);
      if (!Objects.equals(progress.getConfigurationVersion(), playbook.getVersion())) {
        progress =
            new OnboardingBackfill()
                .withConfigurationId(playbook.getId())
                .withConfigurationVersion(playbook.getVersion());
      }
      if (Boolean.TRUE.equals(progress.getComplete())) return;
      var repository = Entity.getEntityRepository(type);
      var filter =
          new ListFilter(
              repository.supportsSoftDelete
                  ? org.openmetadata.schema.type.Include.NON_DELETED
                  : org.openmetadata.schema.type.Include.ALL);
      var page =
          repository.listAfter(
              null, repository.getFields("*"), filter, PAGE_SIZE, progress.getCursor());
      for (EntityInterface asset : page.getData()) enroll(asset, type, progress);
      progress
          .withCursor(page.getPaging().getAfter())
          .withComplete(page.getPaging().getAfter() == null);
      save(progress);
    } finally {
      OnboardingStore.dao().releaseBackfill(playbook.getId().toString(), lease);
    }
  }

  private static String claim(OnboardingPlaybook playbook) {
    String owner = UUID.randomUUID().toString();
    long now = System.currentTimeMillis();
    return OnboardingStore.dao()
                .claimBackfill(playbook.getId().toString(), owner, now, now + 600_000)
            == 1
        ? owner
        : null;
  }

  private static OnboardingBackfill initialize(OnboardingPlaybook playbook) {
    String json = OnboardingStore.dao().getBackfill(playbook.getId().toString());
    OnboardingBackfill progress =
        json == null ? null : JsonUtils.readValue(json, OnboardingBackfill.class);
    if (progress != null) return progress;
    progress =
        new OnboardingBackfill()
            .withConfigurationId(playbook.getId())
            .withConfigurationVersion(playbook.getVersion());
    if (json == null) {
      try {
        OnboardingStore.dao()
            .insertBackfill(playbook.getId().toString(), JsonUtils.pojoToJson(progress));
      } catch (RuntimeException exception) {
        if (OnboardingStore.dao().getBackfill(playbook.getId().toString()) == null) throw exception;
      }
    }
    return progress;
  }

  private static void enroll(EntityInterface asset, String type, OnboardingBackfill progress) {
    progress.setScanned(progress.getScanned() + 1);
    if (!OnboardingService.eligible(asset)) return;
    boolean enrolled = OnboardingStore.find(asset.getId()) != null;
    try {
      OnboardingService.synchronize(asset, type, false);
      if (asset.getEntityStatus() == EntityStatus.UNPROCESSED) {
        OnboardingService.patchStatus(
            type, asset.getId(), asset.getVersion(), EntityStatus.DRAFT, "governance-bot");
      }
      if (!enrolled) progress.setEnrolled(progress.getEnrolled() + 1);
    } catch (RuntimeException exception) {
      if (progress.getFailures().size() < FAILURE_LIMIT) {
        progress
            .getFailures()
            .add(
                new Failure()
                    .withEntity(asset.getEntityReference())
                    .withMessage(exception.getMessage()));
      }
    }
  }

  private static void save(OnboardingBackfill progress) {
    OnboardingStore.dao()
        .updateBackfill(progress.getConfigurationId().toString(), JsonUtils.pojoToJson(progress));
  }
}
