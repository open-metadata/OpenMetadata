package org.openmetadata.service.migration.utils.v203;

import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.configuration.RelationCardinality;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.util.GlossaryTermRelationSettingsUtil;

@Slf4j
public class MigrationUtil {

  private static final String GLOSSARY_TERM_RELATION_SETTINGS = "glossaryTermRelationSettings";

  private static final String DATA_CONSUMER_POLICY = "DataConsumerPolicy";
  private static final String CREATE_TASK_RULE_NAME = "DataConsumerPolicy-CreateTask-Rule";
  private static final String TASK_RULE_NAME = "DataConsumerPolicy-TaskRule";

  // Postgres stores the settings column as jsonb and won't implicitly cast a bound string
  // (::jsonb is required); MySQL's JSON column parses the string directly.
  private static final String UPDATE_MYSQL =
      "UPDATE openmetadata_settings SET json = :json WHERE configType = :configType";
  private static final String UPDATE_POSTGRES =
      "UPDATE openmetadata_settings SET json = :json::jsonb WHERE configType = :configType";

  private final Handle handle;

  public MigrationUtil(Handle handle) {
    this.handle = handle;
  }

  /**
   * Older installs seeded the system glossary relation types before the cardinality field existed,
   * so GET returned {@code cardinality: null} and the UI fell back to MANY_TO_MANY. Persist that
   * same MANY_TO_MANY on the system defaults whose cardinality is still null. Bounds are derived by
   * the canonical normalizer (the settings PUT path), leaving these relations unbounded - metadata
   * only, no new enforcement.
   */
  public void backfillGlossaryTermRelationCardinality() {
    GlossaryTermRelationSettings settings = loadSettings();
    if (settings == null || settings.getRelationTypes() == null) {
      return;
    }

    boolean changed = false;
    for (GlossaryTermRelationType relationType : settings.getRelationTypes()) {
      if (relationType != null
          && Boolean.TRUE.equals(relationType.getIsSystemDefined())
          && relationType.getCardinality() == null) {
        relationType.setCardinality(RelationCardinality.MANY_TO_MANY);
        GlossaryTermRelationSettingsUtil.normalize(relationType);
        changed = true;
        LOG.info(
            "Backfilled MANY_TO_MANY cardinality on system relation '{}'", relationType.getName());
      }
    }

    if (changed) {
      persist(settings);
    }
  }

  private GlossaryTermRelationSettings loadSettings() {
    String json =
        handle
            .createQuery("SELECT json FROM openmetadata_settings WHERE configType = :configType")
            .bind("configType", GLOSSARY_TERM_RELATION_SETTINGS)
            .mapTo(String.class)
            .findOne()
            .orElse(null);
    if (json == null) {
      LOG.info("No glossaryTermRelationSettings row found; skipping cardinality backfill");
      return null;
    }
    return JsonUtils.readValue(json, GlossaryTermRelationSettings.class);
  }

  private void persist(GlossaryTermRelationSettings settings) {
    boolean isMySQL = Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL());
    handle
        .createUpdate(isMySQL ? UPDATE_MYSQL : UPDATE_POSTGRES)
        .bind("configType", GLOSSARY_TERM_RELATION_SETTINGS)
        .bind("json", JsonUtils.pojoToJson(settings))
        .execute();
  }

  /**
   * Re-apply the DataConsumerPolicy task rules on installs already upgraded to 2.0.0/2.0.1. v200
   * dropped {@code DataConsumerPolicy-CreateTask-Rule} via a stale L1 name cache (#32668) and never
   * re-runs on those installs, so these copies repair them here. They intentionally duplicate the
   * v200 helpers rather than importing them: a version's data migration only runs once, so keeping
   * the logic self-contained per version means fixing or evolving one release train cannot silently
   * change what another already recorded.
   *
   * <p>Both read past the L1 name cache ({@code findByName(..., false)}) and persist via {@link
   * #persistPolicyAndInvalidateCache} (raw write then cache invalidation) so back-to-back
   * invocations in one migrate JVM cannot overwrite each other with a stale snapshot. Idempotent -
   * each skips when its rule already exists.
   */
  public static void addCreateTaskRuleToDataConsumerPolicy(CollectionDAO collectionDAO) {
    PolicyRepository repository = (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);
    try {
      Policy policy = repository.findByName(DATA_CONSUMER_POLICY, Include.NON_DELETED, false);
      if (policy.getRules() == null) {
        policy.setRules(new ArrayList<>());
      }
      boolean ruleExists = false;
      for (Rule rule : policy.getRules()) {
        if (CREATE_TASK_RULE_NAME.equals(rule.getName())) {
          ruleExists = true;
          break;
        }
      }
      if (!ruleExists) {
        Rule createTaskRule =
            new Rule()
                .withName(CREATE_TASK_RULE_NAME)
                .withDescription(
                    "Allow authenticated users to create tasks"
                        + " (data access requests, suggestions, etc.).")
                .withResources(List.of("task"))
                .withOperations(List.of(MetadataOperation.CREATE))
                .withEffect(Rule.Effect.ALLOW);
        policy.getRules().add(createTaskRule);
        persistPolicyAndInvalidateCache(collectionDAO, policy);
        LOG.info("Added {} rule to {}", CREATE_TASK_RULE_NAME, DATA_CONSUMER_POLICY);
      }
    } catch (EntityNotFoundException ex) {
      LOG.warn("{} not found, skipping CreateTask rule backfill", DATA_CONSUMER_POLICY);
    } catch (Exception ex) {
      LOG.error(
          "Failed to add {} to {}: {}",
          CREATE_TASK_RULE_NAME,
          DATA_CONSUMER_POLICY,
          ex.getMessage(),
          ex);
    }
  }

  public static void addTaskRuleToDataConsumerPolicy(CollectionDAO collectionDAO) {
    PolicyRepository repository = (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);
    try {
      Policy policy = repository.findByName(DATA_CONSUMER_POLICY, Include.NON_DELETED, false);
      if (policy.getRules() == null) {
        policy.setRules(new ArrayList<>());
      }
      boolean ruleExists = false;
      for (Rule rule : policy.getRules()) {
        if (TASK_RULE_NAME.equals(rule.getName())) {
          ruleExists = true;
          break;
        }
      }
      if (!ruleExists) {
        Rule taskRule =
            new Rule()
                .withName(TASK_RULE_NAME)
                .withDescription(
                    "Allow authenticated users to file and edit tasks (data access requests,"
                        + " suggestions, etc.) against any entity. Restrict this rule (e.g. with"
                        + " an isOwner condition) to limit who can file or edit tasks on which"
                        + " entities.")
                .withResources(List.of("all"))
                .withOperations(List.of(MetadataOperation.CREATE_TASK, MetadataOperation.EDIT_TASK))
                .withEffect(Rule.Effect.ALLOW);
        policy.getRules().add(taskRule);
        persistPolicyAndInvalidateCache(collectionDAO, policy);
        LOG.info("Added {} rule to {}", TASK_RULE_NAME, DATA_CONSUMER_POLICY);
      }
    } catch (EntityNotFoundException ex) {
      LOG.warn("{} not found, skipping TaskRule backfill", DATA_CONSUMER_POLICY);
    } catch (Exception ex) {
      LOG.error(
          "Failed to add {} to {}: {}", TASK_RULE_NAME, DATA_CONSUMER_POLICY, ex.getMessage(), ex);
    }
  }

  /**
   * Persist a policy edited during migration via the raw DAO and then evict it from the repository
   * caches. The raw {@code policyDAO().update(...)} writes the DB row but skips the invalidation
   * that {@link EntityRepository} performs on its own write path, so a later read of the same policy
   * in this migrate JVM would otherwise be served a stale L1 snapshot.
   */
  private static void persistPolicyAndInvalidateCache(CollectionDAO collectionDAO, Policy policy) {
    collectionDAO
        .policyDAO()
        .update(policy.getId(), policy.getFullyQualifiedName(), JsonUtils.pojoToJson(policy));
    EntityRepository.invalidateCacheForEntity(
        Entity.POLICY, policy.getId(), policy.getFullyQualifiedName());
  }
}
