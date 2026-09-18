package org.openmetadata.service.migration.utils.v203;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.configuration.RelationCardinality;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.util.GlossaryTermRelationSettingsUtil;

@Slf4j
public class MigrationUtil {

  private static final String GLOSSARY_TERM_RELATION_SETTINGS = "glossaryTermRelationSettings";

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
}
