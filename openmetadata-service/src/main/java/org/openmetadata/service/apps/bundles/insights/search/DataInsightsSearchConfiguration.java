package org.openmetadata.service.apps.bundles.insights.search;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import org.openmetadata.schema.dataInsight.custom.DataAssetType;

@Getter
public class DataInsightsSearchConfiguration {
  private MappingFields mappingFields;

  /**
   * The per-type attribute lists from {@code dataInsights/config.json}: {@code common} applies to
   * every document, and each remaining key adds the attributes specific to one entity type.
   *
   * <p>Those keys are typed as {@link DataAssetType} rather than kept as strings, so a key naming
   * something Data Insights does not cover cannot exist. Jackson resolves them through the enum's
   * {@code @JsonCreator}, which lets the file keep its flat shape while a misspelling fails at load
   * instead of silently producing documents without their type-specific attributes.
   */
  @Getter
  public static class MappingFields {
    private List<String> common = List.of();
    private final Map<DataAssetType, List<String>> byType = new EnumMap<>(DataAssetType.class);

    @JsonAnySetter
    void putByType(String entityType, List<String> attributeFields) {
      try {
        byType.put(DataAssetType.fromValue(entityType), attributeFields);
      } catch (IllegalArgumentException e) {
        // Chaining `e` would hide this message: Jackson's any-setter path reports the root cause,
        // so the operator would see fromValue's bare "<key>" instead.
        throw new IllegalArgumentException(
            String.format(
                "%s declares mappingFields for '%s', which is not a Data Insights asset type",
                DataInsightsSearchInterface.DATA_INSIGHTS_SEARCH_CONFIG_PATH, entityType));
      }
    }
  }
}
