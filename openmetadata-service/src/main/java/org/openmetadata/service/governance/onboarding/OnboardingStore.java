package org.openmetadata.service.governance.onboarding;

import java.util.UUID;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.OnboardingDAO;

public final class OnboardingStore {
  private OnboardingStore() {}

  public static OnboardingDAO dao() {
    return Entity.getCollectionDAO().onboardingDAO();
  }

  public static OnboardingInstance find(UUID entityId) {
    return entityId == null ? null : read(dao().find(entityId.toString()));
  }

  public static OnboardingInstance forTask(UUID taskId) {
    // Task schemas also resolve during bootstrap, before the persistence layer is initialized.
    if (taskId == null || Entity.getCollectionDAO() == null) return null;
    return read(dao().findByTask(taskId.toString()));
  }

  public static OnboardingInstance read(String json) {
    return json == null ? null : JsonUtils.readValue(json, OnboardingInstance.class);
  }

  public static void save(OnboardingInstance instance) {
    long revision = instance.getRevision();
    instance.setRevision(revision + 1);
    if (dao()
            .update(
                instance.getEntity().getId().toString(),
                instance.getStage().value(),
                revision,
                JsonUtils.pojoToJson(instance))
        != 1) {
      throw new jakarta.ws.rs.WebApplicationException(
          "Onboarding changed concurrently; refresh and retry", 409);
    }
  }
}
