package org.openmetadata.sdk.services.system;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Locale;
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
 * <p>Focused on glossary term relation types. Type registration uses an optimistic RFC-6902 JSON
 * Patch precondition so concurrent registration of the same name converges without creating
 * duplicates.
 */
public class SystemSettingsService {
  private static final int MAX_REGISTRATION_ATTEMPTS = 3;
  private static final String PATCH_TEST_FAILURE = "operation 'test' failed";
  private static final String SETTINGS_BASE = "/v1/system/settings";
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
   * Register a glossary term relation type with a JSON Patch {@code test} for the current {@code
   * relationTypes} array before appending. If another caller changes the setting first, the failed
   * test triggers a bounded re-read. A concurrently registered matching name then becomes an
   * idempotent no-op.
   *
   * @param relationType the relation type to register
   * @return the updated settings, or the current settings unchanged if the name already existed
   */
  public Settings defineGlossaryRelationType(GlossaryTermRelationType relationType)
      throws OpenMetadataException {
    int attempts = 0;
    while (true) {
      Settings current = getGlossaryRelationSettings();
      if (relationTypeExists(current, relationType.getName())) {
        return current;
      }
      try {
        return appendRelationType(relationType, relationTypesSnapshot(current));
      } catch (OpenMetadataException exception) {
        attempts++;
        if (attempts >= MAX_REGISTRATION_ATTEMPTS || !isRelationTypesTestFailure(exception)) {
          throw exception;
        }
      }
    }
  }

  private Settings appendRelationType(
      GlossaryTermRelationType relationType, JsonNode currentRelationTypes)
      throws OpenMetadataException {
    ArrayNode patch = objectMapper.createArrayNode();
    ObjectNode precondition = patch.addObject();
    precondition.put("op", "test");
    precondition.put("path", "/relationTypes");
    precondition.set("value", currentRelationTypes);
    ObjectNode operation = patch.addObject();
    operation.put("op", "add");
    operation.put("path", RELATION_TYPES_APPEND_PATH);
    operation.set("value", objectMapper.valueToTree(relationType));
    return httpClient.execute(
        HttpMethod.PATCH,
        SETTINGS_BASE + "/" + glossaryRelationSettingsKey(),
        patch,
        Settings.class);
  }

  private JsonNode relationTypesSnapshot(Settings settings) {
    JsonNode config = objectMapper.valueToTree(settings.getConfigValue());
    JsonNode relationTypes = config.get("relationTypes");
    return relationTypes != null ? relationTypes : objectMapper.createArrayNode();
  }

  private boolean isRelationTypesTestFailure(OpenMetadataException exception) {
    int statusCode = exception.getStatusCode();
    if (statusCode == 409 || statusCode == 412) {
      return true;
    }
    String message = exception.getMessage();
    return statusCode == 400
        && message != null
        && message.toLowerCase(Locale.ROOT).contains(PATCH_TEST_FAILURE);
  }

  private boolean relationTypeExists(Settings settings, String name) {
    List<GlossaryTermRelationType> types = toRelationConfig(settings).getRelationTypes();
    boolean exists = false;
    if (types != null) {
      exists = types.stream().anyMatch(type -> Objects.equals(type.getName(), name));
    }
    return exists;
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
}
