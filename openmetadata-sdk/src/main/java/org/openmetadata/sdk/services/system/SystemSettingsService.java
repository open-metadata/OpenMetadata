package org.openmetadata.sdk.services.system;

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
 * <p>Focused on glossary term relation types. Type registration appends via RFC-6902 JSON Patch, so
 * concurrent callers never overwrite each other's relation types (unlike a full {@code PUT} that
 * replaces the whole list).
 */
public class SystemSettingsService {
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
   * Register a glossary term relation type. Idempotent: if a type with the same name already
   * exists, this is a no-op that returns the current settings unchanged. Otherwise the type is
   * appended via JSON Patch so other callers' types are never clobbered.
   *
   * @param relationType the relation type to register
   * @return the resulting settings
   */
  public Settings defineGlossaryRelationType(GlossaryTermRelationType relationType)
      throws OpenMetadataException {
    Settings current = getGlossaryRelationSettings();
    Settings result = current;
    if (!relationTypeExists(current, relationType.getName())) {
      result = appendRelationType(relationType);
    }
    return result;
  }

  private Settings appendRelationType(GlossaryTermRelationType relationType)
      throws OpenMetadataException {
    ArrayNode patch = objectMapper.createArrayNode();
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
