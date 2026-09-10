package org.openmetadata.service.governance.onboarding;

import io.dropwizard.lifecycle.Managed;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventHandler;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@Slf4j
public final class OnboardingWorker implements Managed, EntityLifecycleEventHandler {
  private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();
  private String cursor = "";

  @Override
  public void start() {
    EntityLifecycleEventDispatcher.getInstance().registerHandler(this);
    executor.scheduleWithFixedDelay(this::recover, 10, 10, TimeUnit.SECONDS);
  }

  @Override
  public void stop() throws InterruptedException {
    EntityLifecycleEventDispatcher.getInstance().unregisterHandler(getHandlerName());
    executor.shutdownNow();
    executor.awaitTermination(5, TimeUnit.SECONDS);
  }

  @Override
  public String getHandlerName() {
    return "onboarding";
  }

  @Override
  public Set<String> getSupportedEntityTypes() {
    return Set.of(
        Entity.DATA_PRODUCT, Entity.DOMAIN, Entity.GLOSSARY_TERM, Entity.METRIC, Entity.TASK);
  }

  @Override
  public void onEntityCreated(EntityInterface entity, SubjectContext subject) {
    synchronize(entity);
  }

  @Override
  public void onEntityUpdated(
      EntityInterface entity, ChangeDescription changes, SubjectContext subject) {
    synchronize(entity);
  }

  @Override
  public void onEntityDeleted(EntityInterface entity, SubjectContext subject) {
    var instance = OnboardingStore.find(entity.getId());
    if (instance == null) return;
    OnboardingTasks.closeAll(instance);
    Entity.getCollectionDAO()
        .useTransaction(
            dao -> {
              dao.onboardingDAO().deleteTasks(instance.getId().toString());
              dao.onboardingDAO().delete(entity.getId().toString());
            });
  }

  @Override
  public void onEntitySoftDeletedOrRestored(
      EntityInterface entity, boolean deleted, SubjectContext subject) {
    if (!deleted) {
      synchronize(entity);
      return;
    }
    var instance = OnboardingStore.find(entity.getId());
    if (instance != null) OnboardingTasks.closeAll(instance);
  }

  private void synchronize(EntityInterface entity) {
    var reference = entity.getEntityReference();
    if (Entity.TASK.equals(reference.getType())) {
      var instance = OnboardingStore.forTask(entity.getId());
      if (instance == null) return;
      reference = instance.getEntity();
    }
    var asset = OnboardingService.entity(reference.getType(), reference.getId());
    OnboardingService.synchronize(asset, reference.getType(), false);
  }

  private void recover() {
    for (String type : OnboardingEvaluator.ENTITY_TYPES) {
      try {
        OnboardingBackfillService.runPage(type);
      } catch (RuntimeException exception) {
        LOG.error("Could not backfill onboarding for {}", type, exception);
      }
    }
    recoverInstances();
  }

  private void recoverInstances() {
    try {
      var page = OnboardingStore.dao().list(null, null, cursor, 50);
      for (String json : page) {
        var instance = OnboardingStore.read(json);
        cursor = instance.getId().toString();
        try {
          synchronize(
              OnboardingService.entity(
                  instance.getEntity().getType(), instance.getEntity().getId()));
        } catch (org.openmetadata.service.exception.EntityNotFoundException deletedAsset) {
          OnboardingTasks.closeAll(instance);
        } catch (RuntimeException exception) {
          LOG.warn("Could not reconcile onboarding instance {}", instance.getId(), exception);
        }
      }
      if (page.size() < 50) cursor = "";
    } catch (RuntimeException exception) {
      LOG.error("Could not recover onboarding instances", exception);
    }
  }
}
