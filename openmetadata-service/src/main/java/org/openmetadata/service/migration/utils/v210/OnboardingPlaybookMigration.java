package org.openmetadata.service.migration.utils.v210;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.governance.IntakeForm;
import org.openmetadata.schema.entity.governance.IntakeFormField;
import org.openmetadata.schema.entity.governance.OnboardingPlaybook;
import org.openmetadata.schema.entity.governance.PlaybookEntityType;
import org.openmetadata.schema.governance.onboarding.OnboardingCheckType;
import org.openmetadata.schema.governance.onboarding.OnboardingConfiguration;
import org.openmetadata.schema.governance.onboarding.OnboardingGate;
import org.openmetadata.schema.governance.onboarding.OnboardingRequirement;
import org.openmetadata.schema.governance.onboarding.OnboardingStep;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.onboarding.OnboardingLifecycle;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Gives every asset type that has an intake form an onboarding playbook, with the form's fields
 * migrated as-is into the playbook's Creation gate.
 *
 * <p>An intake form was only ever the first gate - the fields you must supply to create the asset.
 * Moving it into the playbook leaves one place to configure required metadata instead of two. The
 * intake form itself is left in place and referenced, so the existing API keeps resolving.
 *
 * <p>Idempotent: an asset type that already has a playbook is skipped.
 */
@Slf4j
public class OnboardingPlaybookMigration {
  private OnboardingPlaybookMigration() {}

  public static void migrateIntakeFormsToPlaybooks(Handle handle, boolean postgres) {
    String select = "SELECT json FROM intake_form_entity";
    List<String> forms = handle.createQuery(select).mapTo(String.class).list();
    for (String json : forms) {
      try {
        migrateOne(handle, postgres, JsonUtils.readValue(json, IntakeForm.class));
      } catch (Exception e) {
        // One malformed form must not stop the upgrade; the asset type simply keeps no playbook.
        LOG.warn("Skipping intake form during playbook migration: {}", e.getMessage());
      }
    }
  }

  private static void migrateOne(Handle handle, boolean postgres, IntakeForm form) {
    if (form.getEntityType() == null || exists(handle, form.getEntityType().value())) {
      return;
    }
    OnboardingPlaybook playbook = toPlaybook(form);
    String insert =
        postgres
            ? "INSERT INTO onboarding_playbook_entity (json, fqnHash) VALUES (CAST(:json AS jsonb), :fqnHash) ON CONFLICT DO NOTHING"
            : "INSERT IGNORE INTO onboarding_playbook_entity (json, fqnHash) VALUES (:json, :fqnHash)";
    handle
        .createUpdate(insert)
        .bind("json", JsonUtils.pojoToJson(playbook))
        .bind("fqnHash", FullyQualifiedName.buildHash(playbook.getFullyQualifiedName()))
        .execute();
    LOG.info(
        "Created onboarding playbook '{}' from the {} intake form",
        playbook.getName(),
        form.getEntityType().value());
  }

  private static boolean exists(Handle handle, String entityType) {
    String sql = "SELECT COUNT(*) FROM onboarding_playbook_entity WHERE entityType = :entityType";
    Integer count =
        handle.createQuery(sql).bind("entityType", entityType).mapTo(Integer.class).one();
    return count != null && count > 0;
  }

  private static OnboardingPlaybook toPlaybook(IntakeForm form) {
    String name = form.getEntityType().value() + "Playbook";
    return new OnboardingPlaybook()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(name)
        .withDisplayName(displayName(form))
        .withDescription(
            "Migrated from the "
                + form.getEntityType().value()
                + " intake form. The Creation gate holds the fields this asset type cannot be created without.")
        .withEntityType(PlaybookEntityType.fromValue(form.getEntityType().value()))
        .withIntakeForm(intakeFormReference(form))
        .withOwners(form.getOwners())
        .withUpdatedAt(System.currentTimeMillis())
        .withUpdatedBy(Entity.ADMIN_USER_NAME)
        .withOnboarding(configuration(form));
  }

  private static String displayName(IntakeForm form) {
    return form.getDisplayName() == null
        ? form.getEntityType().value() + " playbook"
        : form.getDisplayName();
  }

  private static EntityReference intakeFormReference(IntakeForm form) {
    return new EntityReference()
        .withId(form.getId())
        .withType(Entity.INTAKE_FORM)
        .withName(form.getName())
        .withFullyQualifiedName(form.getFullyQualifiedName());
  }

  /**
   * The form's fields become Creation-gate checks. Requiredness carries over verbatim: a field the
   * form marked required becomes blocking, everything else recommended - the design's "migrated
   * as-is", not a re-interpretation of the customer's configuration.
   */
  private static OnboardingConfiguration configuration(IntakeForm form) {
    List<OnboardingStep> steps = new ArrayList<>();
    for (IntakeFormField field : listOrEmpty(form.getFormFields())) {
      if (field.getFieldPath() == null) continue;
      steps.add(
          new OnboardingStep()
              .withId("creation_" + field.getFieldPath().replace('.', '_'))
              .withTitle(
                  field.getFieldLabel() == null ? field.getFieldPath() : field.getFieldLabel())
              .withType(OnboardingCheckType.ATTRIBUTE)
              .withRequirement(
                  Boolean.TRUE.equals(field.getRequired())
                      ? OnboardingRequirement.BLOCKING
                      : OnboardingRequirement.RECOMMENDED)
              .withFieldPath(field.getFieldPath())
              .withConditions(List.of()));
    }
    OnboardingGate creation =
        new OnboardingGate()
            .withStage(OnboardingLifecycle.CREATION)
            .withSteps(steps)
            .withBlockTransition(true);
    return new OnboardingConfiguration()
        .withEnabled(!Boolean.FALSE.equals(form.getEnabled()))
        .withStages(OnboardingLifecycle.defaultStages())
        .withGates(List.of(creation));
  }

  private static <T> List<T> listOrEmpty(List<T> list) {
    return list == null ? List.of() : list;
  }
}
