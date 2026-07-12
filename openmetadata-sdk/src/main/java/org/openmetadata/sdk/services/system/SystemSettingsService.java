package org.openmetadata.sdk.services.system;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Objects;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Client for OpenMetadata system settings ({@code /v1/system/settings}).
 *
 * <p>Focused on glossary term relation types. Type registration preserves the server's missing,
 * null, or array representation and reconciles a fresh snapshot after potential concurrent
 * updates.
 */
public class SystemSettingsService {
  private static final int MAX_REGISTRATION_ATTEMPTS = 3;
  private static final String SETTINGS_BASE = "/v1/system/settings";
  private static final String RELATION_TYPES_PATH = "/relationTypes";
  private static final String RELATION_TYPES_APPEND_PATH = "/relationTypes/-";

  private final HttpClient httpClient;
  private final ObjectMapper objectMapper;

  public SystemSettingsService(HttpClient httpClient) {
    this.httpClient = httpClient;
    this.objectMapper = new ObjectMapper();
  }

  /** Get a setting by name (e.g. {@code glossaryTermRelationSettings}). */
  public Settings get(String name) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.GET, SETTINGS_BASE + "/" + name, null, Settings.class);
  }

  /** Replace a setting wholesale via {@code PUT} (the whole config value is overwritten). */
  public Settings update(Settings settings) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.PUT, SETTINGS_BASE, settings, Settings.class);
  }

  public Settings getGlossaryRelationSettings() throws OpenMetadataException {
    return get(glossaryRelationSettingsKey());
  }

  public List<GlossaryTermRelationType> glossaryRelationTypes() throws OpenMetadataException {
    List<GlossaryTermRelationType> types = glossaryRelationConfig().getRelationTypes();
    return types != null ? types : List.of();
  }

  /**
   * Register a glossary term relation type while preserving the current {@code relationTypes}
   * representation. After a potential precondition failure, a fresh snapshot confirms whether
   * another caller changed the setting. A concurrently registered matching name then becomes an
   * idempotent no-op.
   *
   * @param relationType the relation type to register
   * @return the updated settings, or the current settings unchanged if the name already existed
   */
  public Settings defineGlossaryRelationType(GlossaryTermRelationType relationType)
      throws OpenMetadataException {
    int attempts = 0;
    Settings current = getGlossaryRelationSettings();
    RelationTypesSnapshot snapshot = relationTypesSnapshot(current);
    while (true) {
      if (relationTypeExists(snapshot.relationTypes(), relationType.getName())) {
        return current;
      }
      try {
        return appendRelationType(relationType, snapshot);
      } catch (OpenMetadataException exception) {
        if (!isPotentialConcurrentUpdate(exception)) {
          throw exception;
        }
        attempts++;
        Settings latest = getGlossaryRelationSettings();
        RelationTypesSnapshot latestSnapshot = relationTypesSnapshot(latest);
        if (relationTypeExists(latestSnapshot.relationTypes(), relationType.getName())) {
          return latest;
        }
        if (attempts >= MAX_REGISTRATION_ATTEMPTS || hasSamePatchState(snapshot, latestSnapshot)) {
          throw exception;
        }
        current = latest;
        snapshot = latestSnapshot;
      }
    }
  }

  private Settings appendRelationType(
      GlossaryTermRelationType relationType, RelationTypesSnapshot snapshot)
      throws OpenMetadataException {
    ArrayNode patch = objectMapper.createArrayNode();
    JsonNode relationTypeValue = objectMapper.valueToTree(relationType);
    if (!snapshot.present()) {
      addOperation(
          patch, "add", RELATION_TYPES_PATH, objectMapper.createArrayNode().add(relationTypeValue));
    } else if (snapshot.patchValue().isNull()) {
      addOperation(patch, "test", RELATION_TYPES_PATH, snapshot.patchValue());
      addOperation(
          patch,
          "replace",
          RELATION_TYPES_PATH,
          objectMapper.createArrayNode().add(relationTypeValue));
    } else {
      addOperation(patch, "test", RELATION_TYPES_PATH, snapshot.patchValue());
      addOperation(patch, "add", RELATION_TYPES_APPEND_PATH, relationTypeValue);
    }
    return httpClient.execute(
        HttpMethod.PATCH,
        SETTINGS_BASE + "/" + glossaryRelationSettingsKey(),
        patch,
        Settings.class);
  }

  private void addOperation(ArrayNode patch, String op, String path, JsonNode value) {
    ObjectNode operation = patch.addObject();
    operation.put("op", op);
    operation.put("path", path);
    operation.set("value", value);
  }

  private RelationTypesSnapshot relationTypesSnapshot(Settings settings) {
    JsonNode config = objectMapper.valueToTree(settings.getConfigValue());
    if (!config.isObject()) {
      throw new OpenMetadataException("glossary relation settings must be a JSON object");
    }
    JsonNode relationTypes = config.get("relationTypes");
    boolean present = config.has("relationTypes");
    if (present && !relationTypes.isNull() && !relationTypes.isArray()) {
      throw new OpenMetadataException("glossary relationTypes must be an array, null, or absent");
    }
    List<GlossaryTermRelationType> types = toRelationConfig(settings).getRelationTypes();
    return new RelationTypesSnapshot(types != null ? types : List.of(), relationTypes, present);
  }

  private boolean isPotentialConcurrentUpdate(OpenMetadataException exception) {
    int statusCode = exception.getStatusCode();
    return statusCode == 400 || statusCode == 409 || statusCode == 412 || statusCode == 422;
  }

  private boolean hasSamePatchState(RelationTypesSnapshot first, RelationTypesSnapshot second) {
    return first.present() == second.present()
        && Objects.equals(first.patchValue(), second.patchValue());
  }

  private boolean relationTypeExists(List<GlossaryTermRelationType> types, String name) {
    return types.stream().anyMatch(type -> Objects.equals(type.getName(), name));
  }

  private GlossaryTermRelationSettings glossaryRelationConfig() throws OpenMetadataException {
    return toRelationConfig(getGlossaryRelationSettings());
  }

  private GlossaryTermRelationSettings toRelationConfig(Settings settings) {
    return objectMapper.convertValue(settings.getConfigValue(), GlossaryTermRelationSettings.class);
  }

  private String glossaryRelationSettingsKey() {
    return SettingsType.GLOSSARY_TERM_RELATION_SETTINGS.value();
  }

  private record RelationTypesSnapshot(
      List<GlossaryTermRelationType> relationTypes, JsonNode patchValue, boolean present) {}
}
