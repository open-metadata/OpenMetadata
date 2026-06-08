package org.openmetadata.service.migration.utils.v202;

import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.configuration.RelationCardinality;
import org.openmetadata.schema.utils.JsonUtils;

@Slf4j
public class MigrationUtil {

  private static final String GLOSSARY_TERM_RELATION_SETTINGS = "glossaryTermRelationSettings";

  private static final Map<String, RelationCardinality> SYSTEM_DEFAULT_CARDINALITIES =
      systemDefaultCardinalities();

  private final Handle handle;

  public MigrationUtil(Handle handle) {
    this.handle = handle;
  }

  public void backfillGlossaryTermRelationCardinality() {
    String json =
        handle
            .createQuery("SELECT json FROM openmetadata_settings WHERE configType = :configType")
            .bind("configType", GLOSSARY_TERM_RELATION_SETTINGS)
            .mapTo(String.class)
            .findOne()
            .orElse(null);
    if (json == null) {
      LOG.info("No glossaryTermRelationSettings row found; skipping cardinality backfill");
      return;
    }

    GlossaryTermRelationSettings settings =
        JsonUtils.readValue(json, GlossaryTermRelationSettings.class);
    if (settings == null || settings.getRelationTypes() == null) {
      return;
    }

    boolean changed = false;
    for (GlossaryTermRelationType relationType : settings.getRelationTypes()) {
      if (relationType == null
          || !Boolean.TRUE.equals(relationType.getIsSystemDefined())
          || relationType.getCardinality() != null) {
        continue;
      }
      RelationCardinality expected = SYSTEM_DEFAULT_CARDINALITIES.get(relationType.getName());
      if (expected == null) {
        continue;
      }
      relationType.setCardinality(expected);
      applyCardinalityBounds(relationType, expected);
      changed = true;
      LOG.info(
          "Backfilled cardinality {} on system relation '{}'", expected, relationType.getName());
    }

    if (!changed) {
      return;
    }

    handle
        .createUpdate(
            "UPDATE openmetadata_settings SET json = :json WHERE configType = :configType")
        .bind("configType", GLOSSARY_TERM_RELATION_SETTINGS)
        .bind("json", JsonUtils.pojoToJson(settings))
        .execute();
  }

  private static Map<String, RelationCardinality> systemDefaultCardinalities() {
    Map<String, RelationCardinality> defaults = new HashMap<>();
    defaults.put("relatedTo", RelationCardinality.MANY_TO_MANY);
    defaults.put("synonym", RelationCardinality.MANY_TO_MANY);
    defaults.put("antonym", RelationCardinality.MANY_TO_MANY);
    defaults.put("broader", RelationCardinality.ONE_TO_MANY);
    defaults.put("narrower", RelationCardinality.MANY_TO_ONE);
    defaults.put("partOf", RelationCardinality.MANY_TO_MANY);
    defaults.put("hasPart", RelationCardinality.MANY_TO_MANY);
    defaults.put("calculatedFrom", RelationCardinality.MANY_TO_MANY);
    defaults.put("usedToCalculate", RelationCardinality.MANY_TO_MANY);
    defaults.put("seeAlso", RelationCardinality.MANY_TO_MANY);
    return defaults;
  }

  private static void applyCardinalityBounds(
      GlossaryTermRelationType relationType, RelationCardinality cardinality) {
    switch (cardinality) {
      case ONE_TO_ONE -> {
        relationType.setSourceMax(1);
        relationType.setTargetMax(1);
      }
      case ONE_TO_MANY -> {
        relationType.setSourceMax(1);
        relationType.setTargetMax(null);
      }
      case MANY_TO_ONE -> {
        relationType.setSourceMax(null);
        relationType.setTargetMax(1);
      }
      case MANY_TO_MANY -> {
        relationType.setSourceMax(null);
        relationType.setTargetMax(null);
      }
      default -> {
        // CUSTOM or unknown: keep explicit source/target values as-is.
      }
    }
  }
}
