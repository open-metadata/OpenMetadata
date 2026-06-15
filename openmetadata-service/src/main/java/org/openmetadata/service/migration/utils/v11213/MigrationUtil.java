package org.openmetadata.service.migration.utils.v11213;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class MigrationUtil {
  private MigrationUtil() {}

  private static final String TAG_TABLE = "tag";
  private static final String FQN_HASH_COLUMN = "fqnHash";
  private static final String JSON_COLUMN = "json";
  private static final String RECOGNIZERS_FIELD = "recognizers";
  private static final String RECOGNIZER_CONFIG_FIELD = "recognizerConfig";
  private static final String CONTEXT_FIELD = "context";
  private static final String NAME_FIELD = "name";

  private static final String PII_SENSITIVE_FQN = "PII.Sensitive";
  private static final String PII_NON_SENSITIVE_FQN = "PII.NonSensitive";

  private static final String UPDATE_MYSQL = "UPDATE tag SET json = :json WHERE fqnHash = :fqnHash";
  private static final String UPDATE_POSTGRES =
      "UPDATE tag SET json = :json::jsonb WHERE fqnHash = :fqnHash";
  private static final String SELECT_TAG = "SELECT json FROM tag WHERE fqnHash = :fqnHash";
  private static final String SELECT_TAG_POSTGRES =
      "SELECT json::text AS json FROM tag WHERE fqnHash = :fqnHash";

  private static final Map<String, Set<String>> KEYWORDS_TO_REMOVE =
      Map.of(
          "CvvRecognizer", Set.of("code", "security", "verification", "card"),
          "UsBankRecognizer", Set.of("check", "save"),
          "UsSsnRecognizer", Set.of("social", "security", "id_number"),
          "CryptoRecognizer", Set.of("address"),
          "PhoneRecognizer", Set.of("call"));

  private static final String SPACY_RECOGNIZER = "SpacyRecognizer";
  private static final String PERSON_ENTITY = "PERSON";
  private static final String SUPPORTED_ENTITIES_FIELD = "supportedEntities";
  private static final Set<String> SPACY_PERSON_KEYWORDS_TO_REMOVE = Set.of("name");

  public static void removeBroadPiiContextKeywords(Handle handle) {
    LOG.info("v11213: removing overly broad context keywords from PII recognizers");
    boolean isMySQL = Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL());
    migrateTag(handle, PII_SENSITIVE_FQN, isMySQL);
    migrateTag(handle, PII_NON_SENSITIVE_FQN, isMySQL);
    LOG.info("v11213: PII recognizer context keyword cleanup complete");
  }

  private static void migrateTag(Handle handle, String tagFqn, boolean isMySQL) {
    String fqnHash = FullyQualifiedName.buildHash(tagFqn);
    String selectSql = isMySQL ? SELECT_TAG : SELECT_TAG_POSTGRES;
    List<Map<String, Object>> rows =
        handle.createQuery(selectSql).bind(FQN_HASH_COLUMN, fqnHash).mapToMap().list();
    if (nullOrEmpty(rows)) {
      LOG.warn("v11213: tag '{}' not found, skipping", tagFqn);
      return;
    }
    String jsonStr = rows.getFirst().get(JSON_COLUMN).toString();
    ObjectNode root;
    try {
      root = (ObjectNode) JsonUtils.readTree(jsonStr);
    } catch (Exception e) {
      LOG.warn("v11213: failed to parse tag '{}' JSON, skipping: {}", tagFqn, e.getMessage());
      return;
    }
    boolean modified = processRecognizers(root, tagFqn);
    if (modified) {
      String updateSql = isMySQL ? UPDATE_MYSQL : UPDATE_POSTGRES;
      handle
          .createUpdate(updateSql)
          .bind(JSON_COLUMN, root.toString())
          .bind(FQN_HASH_COLUMN, fqnHash)
          .execute();
      LOG.info("v11213: updated PII recognizer context keywords for tag '{}'", tagFqn);
    } else {
      LOG.info("v11213: no changes needed for tag '{}'", tagFqn);
    }
  }

  private static boolean processRecognizers(ObjectNode root, String tagFqn) {
    JsonNode recognizersNode = root.get(RECOGNIZERS_FIELD);
    if (recognizersNode == null || !recognizersNode.isArray()) {
      return false;
    }
    boolean modified = false;
    for (JsonNode recognizerNode : recognizersNode) {
      if (recognizerNode instanceof ObjectNode recognizer) {
        modified |= processRecognizer(recognizer, tagFqn);
      }
    }
    return modified;
  }

  private static boolean processRecognizer(ObjectNode recognizer, String tagFqn) {
    JsonNode nameNode = recognizer.get(NAME_FIELD);
    if (nameNode == null) {
      return false;
    }
    String recognizerName = nameNode.asText();
    JsonNode configNode = recognizer.get(RECOGNIZER_CONFIG_FIELD);
    if (!(configNode instanceof ObjectNode config)) {
      return false;
    }
    boolean modified = removeFromKeywordsMap(recognizerName, config);
    modified |= removeSpacyPersonKeyword(recognizerName, config, tagFqn);
    return modified;
  }

  private static boolean removeFromKeywordsMap(String recognizerName, ObjectNode config) {
    Set<String> toRemove = KEYWORDS_TO_REMOVE.get(recognizerName);
    if (toRemove == null) {
      return false;
    }
    return removeKeywordsFromContext(config, toRemove, recognizerName);
  }

  private static boolean removeSpacyPersonKeyword(
      String recognizerName, ObjectNode config, String tagFqn) {
    if (!SPACY_RECOGNIZER.equals(recognizerName)) {
      return false;
    }
    JsonNode entitiesNode = config.get(SUPPORTED_ENTITIES_FIELD);
    if (!isPersonRecognizer(entitiesNode)) {
      return false;
    }
    return removeKeywordsFromContext(config, SPACY_PERSON_KEYWORDS_TO_REMOVE, recognizerName);
  }

  private static boolean isPersonRecognizer(JsonNode entitiesNode) {
    if (entitiesNode == null || !entitiesNode.isArray()) {
      return false;
    }
    for (JsonNode entity : entitiesNode) {
      if (PERSON_ENTITY.equals(entity.asText())) {
        return true;
      }
    }
    return false;
  }

  private static boolean removeKeywordsFromContext(
      ObjectNode config, Set<String> toRemove, String recognizerName) {
    JsonNode contextNode = config.get(CONTEXT_FIELD);
    if (contextNode == null || !contextNode.isArray()) {
      return false;
    }
    ArrayNode newContext = JsonUtils.getObjectMapper().createArrayNode();
    boolean removed = false;
    for (JsonNode keyword : contextNode) {
      String kw = keyword.asText();
      if (toRemove.contains(kw)) {
        LOG.info("v11213: removing keyword '{}' from {} context", kw, recognizerName);
        removed = true;
      } else {
        newContext.add(keyword);
      }
    }
    if (removed) {
      config.set(CONTEXT_FIELD, newContext);
    }
    return removed;
  }
}
