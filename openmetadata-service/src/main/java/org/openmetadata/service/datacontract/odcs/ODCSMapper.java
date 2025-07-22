package org.openmetadata.service.datacontract.odcs;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.MaxLatency;
import org.openmetadata.schema.api.data.RefreshFrequency;
import org.openmetadata.schema.api.data.Retention;
import org.openmetadata.schema.api.data.Sla;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContractStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.QualityExpectation;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;

@Slf4j
public class ODCSMapper {

  private static final Map<String, String> ODCS_TYPE_MAPPING = new HashMap<>();

  static {
    ODCS_TYPE_MAPPING.put("string", "STRING");
    ODCS_TYPE_MAPPING.put("varchar", "VARCHAR");
    ODCS_TYPE_MAPPING.put("char", "CHAR");
    ODCS_TYPE_MAPPING.put("text", "TEXT");
    ODCS_TYPE_MAPPING.put("integer", "INT");
    ODCS_TYPE_MAPPING.put("int", "INT");
    ODCS_TYPE_MAPPING.put("bigint", "BIGINT");
    ODCS_TYPE_MAPPING.put("smallint", "SMALLINT");
    ODCS_TYPE_MAPPING.put("tinyint", "TINYINT");
    ODCS_TYPE_MAPPING.put("long", "BIGINT");
    ODCS_TYPE_MAPPING.put("decimal", "DECIMAL");
    ODCS_TYPE_MAPPING.put("numeric", "NUMERIC");
    ODCS_TYPE_MAPPING.put("float", "FLOAT");
    ODCS_TYPE_MAPPING.put("double", "DOUBLE");
    ODCS_TYPE_MAPPING.put("real", "FLOAT");
    ODCS_TYPE_MAPPING.put("boolean", "BOOLEAN");
    ODCS_TYPE_MAPPING.put("bool", "BOOLEAN");
    ODCS_TYPE_MAPPING.put("date", "DATE");
    ODCS_TYPE_MAPPING.put("datetime", "DATETIME");
    ODCS_TYPE_MAPPING.put("timestamp", "TIMESTAMP");
    ODCS_TYPE_MAPPING.put("time", "TIME");
    ODCS_TYPE_MAPPING.put("binary", "BINARY");
    ODCS_TYPE_MAPPING.put("bytes", "BYTES");
    ODCS_TYPE_MAPPING.put("array", "ARRAY");
    ODCS_TYPE_MAPPING.put("object", "STRUCT");
    ODCS_TYPE_MAPPING.put("map", "MAP");
    ODCS_TYPE_MAPPING.put("json", "JSON");
  }

  private final List<String> mappingErrors = new ArrayList<>();

  public DataContract mapToDataContract(ODCSContract odcs, EntityReference targetEntity) {
    mappingErrors.clear(); // Clear any previous errors

    DataContract contract = new DataContract();
    contract.setId(UUID.randomUUID());
    String contractName = generateContractName(odcs, targetEntity);
    LOG.info(
        "Generated contract name: {} for entity: {}",
        contractName,
        targetEntity.getFullyQualifiedName());
    contract.setName(contractName);
    contract.setDisplayName(odcs.getName() != null ? odcs.getName() : contract.getName());
    contract.setVersion(0.1); // New contracts start at 0.1
    contract.setDescription(buildDescription(odcs));
    contract.setStatus(mapStatus(odcs.getStatus()));
    contract.setEntity(targetEntity);
    if (odcs.getSchema() != null && !odcs.getSchema().isEmpty()) {
      contract.setSchema(mapSchema(odcs.getSchema()));
    }
    if (odcs.getQuality() != null && !odcs.getQuality().isEmpty()) {
      MappedQualityRules mappedRules = mapQualityRules(odcs.getQuality());
      contract.setQualityExpectations(mappedRules.expectations);
      contract.setSemantics(mappedRules.semanticRules);
    }
    if (odcs.getSlaProperties() != null && !odcs.getSlaProperties().isEmpty()) {
      contract.setSla(mapSlaProperties(odcs.getSlaProperties()));
    }
    if (odcs.getTeam() != null && !odcs.getTeam().isEmpty()) {
      TeamMapping teamMapping = mapTeamMembers(odcs.getTeam());
      contract.setOwners(teamMapping.owners);
      contract.setReviewers(teamMapping.reviewers);
    }

    contract.setEffectiveFrom(new Date());
    return contract;
  }

  public List<String> getMappingErrors() {
    return new ArrayList<>(mappingErrors);
  }

  private String generateContractName(ODCSContract odcs, EntityReference entity) {
    if (odcs.getName() != null && !odcs.getName().isEmpty()) {
      return odcs.getName();
    }
    return entity.getName() + "_contract_v" + odcs.getVersion().replace(".", "_");
  }

  private String buildDescription(ODCSContract odcs) {
    StringBuilder desc = new StringBuilder();

    desc.append("**ODCS Contract ID:** ").append(odcs.getId()).append("\n");
    desc.append("**ODCS Version:** ").append(odcs.getApiVersion()).append("\n");
    desc.append("**Contract Version:** ").append(odcs.getVersion()).append("\n\n");

    if (odcs.getDescription() != null) {
      desc.append(odcs.getDescription().toMarkdown());
    }

    return desc.toString();
  }

  private ContractStatus mapStatus(String odcsStatus) {
    if (odcsStatus == null) {
      return ContractStatus.Draft;
    }

    return switch (odcsStatus.toLowerCase()) {
      case "proposed", "draft" -> ContractStatus.Draft;
      case "active" -> ContractStatus.Active;
      case "deprecated", "retired" -> ContractStatus.Deprecated;
      default -> {
        LOG.warn("Unknown ODCS status '{}', defaulting to Draft", odcsStatus);
        yield ContractStatus.Draft;
      }
    };
  }

  private List<Column> mapSchema(List<ODCSSchema> odcsSchemas) {
    List<Column> columns = new ArrayList<>();

    if (!odcsSchemas.isEmpty()) {
      ODCSSchema firstSchema = odcsSchemas.getFirst();
      if (firstSchema.getProperties() != null) {
        for (ODCSProperty property : firstSchema.getProperties()) {
          columns.add(mapPropertyToColumn(property));
        }
      }
    }

    return columns;
  }

  private Column mapPropertyToColumn(ODCSProperty property) {
    Column column = new Column();
    column.setName(property.getName());
    if (property.getBusinessName() != null) {
      column.setDisplayName(property.getBusinessName());
    }
    column.setDescription(property.getDescription());
    column.setDataType(mapLogicalType(property.getLogicalType()));
    if (property.getPrecision() != null || property.getScale() != null) {
      String typeDisplay = column.getDataType().value();
      if (property.getPrecision() != null) {
        typeDisplay += "(" + property.getPrecision();
        if (property.getScale() != null) {
          typeDisplay += "," + property.getScale();
        }
        typeDisplay += ")";
      }
      column.setDataTypeDisplay(typeDisplay);
    }
    if (property.getMaxLength() != null) {
      column.setDataLength(property.getMaxLength());
    }

    // Set constraint - OpenMetadata supports single constraint, so prioritize PRIMARY_KEY > UNIQUE
    // > NOT_NULL
    if (Boolean.TRUE.equals(property.getPrimaryKey())) {
      column.setConstraint(ColumnConstraint.PRIMARY_KEY);
    } else if (Boolean.TRUE.equals(property.getUnique())) {
      column.setConstraint(ColumnConstraint.UNIQUE);
    } else if (Boolean.TRUE.equals(property.getRequired())) {
      column.setConstraint(ColumnConstraint.NOT_NULL);
    }

    if (property.getClassification() != null) {
      column.setTags(mapClassificationToTags(property.getClassification()));
    }
    return column;
  }

  private ColumnDataType mapLogicalType(String odcsType) {
    if (odcsType == null) {
      return ColumnDataType.UNKNOWN;
    }

    String mappedType = ODCS_TYPE_MAPPING.get(odcsType.toLowerCase());
    if (mappedType != null) {
      try {
        return ColumnDataType.fromValue(mappedType);
      } catch (IllegalArgumentException e) {
        LOG.warn("Failed to map ODCS type '{}' to OpenMetadata type", odcsType);
      }
    }

    // Try direct mapping
    try {
      return ColumnDataType.fromValue(odcsType.toUpperCase());
    } catch (IllegalArgumentException e) {
      LOG.warn("Unknown ODCS logical type '{}', using UNKNOWN", odcsType);
      return ColumnDataType.UNKNOWN;
    }
  }

  private List<TagLabel> mapClassificationToTags(String classification) {
    List<TagLabel> tags = new ArrayList<>();

    switch (classification.toLowerCase()) {
      case "pii", "personal", "sensitive" -> tags.add(createTagLabel("PII.Sensitive"));
      case "confidential" -> tags.add(createTagLabel("Tier.Tier1"));
      case "internal" -> tags.add(createTagLabel("Tier.Tier2"));
      case "public" -> tags.add(createTagLabel("Tier.Tier3"));
      default -> tags.add(createTagLabel("Classification." + classification));
    }
    return tags;
  }

  private TagLabel createTagLabel(String tagFQN) {
    TagLabel tag = new TagLabel();
    tag.setTagFQN(tagFQN);
    tag.setSource(TagLabel.TagSource.CLASSIFICATION);
    tag.setState(TagLabel.State.CONFIRMED);
    return tag;
  }

  private MappedQualityRules mapQualityRules(List<ODCSQuality> odcsQuality) {
    MappedQualityRules result = new MappedQualityRules();
    result.expectations = new ArrayList<>();
    result.semanticRules = new ArrayList<>();

    for (ODCSQuality quality : odcsQuality) {
      switch (quality.getType()) {
        case "text" -> {
          QualityExpectation expectation = new QualityExpectation();
          expectation.setName(
              quality.getDescription() != null ? quality.getDescription() : "Quality Rule");
          expectation.setDescription(quality.getRule());
          result.expectations.add(expectation);
        }
        case "sql" -> {
          SemanticsRule semantic = new SemanticsRule();
          semantic.setName(
              quality.getDescription() != null ? quality.getDescription() : "SQL Rule");
          semantic.setDescription("SQL Rule: " + quality.getRule());
          semantic.setRule(quality.getRule());
          result.semanticRules.add(semantic);
        }
        case "library" -> {
          QualityExpectation libExpectation = new QualityExpectation();
          libExpectation.setName(
              quality.getDescription() != null ? quality.getDescription() : quality.getLibrary());
          libExpectation.setDescription(
              "Library: " + quality.getLibrary() + " - Rule: " + quality.getRule());
          result.expectations.add(libExpectation);
        }
        case "custom" -> {
          QualityExpectation customExpectation = new QualityExpectation();
          customExpectation.setName(
              quality.getDescription() != null ? quality.getDescription() : "Custom Rule");
          customExpectation.setDescription("Custom Rule: " + quality.getRule());
          result.expectations.add(customExpectation);
        }
        default -> LOG.warn("Unknown Quality Rules");
      }
    }

    return result;
  }

  private Sla mapSlaProperties(List<ODCSSla> slaProperties) {
    Sla sla = new Sla();

    for (ODCSSla prop : slaProperties) {
      String property = prop.getProperty().toLowerCase();
      String value = prop.getValue();
      String unit = prop.getUnit();

      switch (property) {
        case "latency", "maxlatency" -> {
          MaxLatency maxLatency = new MaxLatency();
          try {
            maxLatency.setValue(Integer.parseInt(value));
            maxLatency.setUnit(mapLatencyUnit(unit));
            sla.setMaxLatency(maxLatency);
          } catch (NumberFormatException e) {
            LOG.warn("Unable to parse max latency value: {}", value);
          }
        }
        case "frequency", "refreshfrequency" -> {
          RefreshFrequency refreshFrequency = new RefreshFrequency();
          try {
            int interval = Integer.parseInt(value);
            RefreshFrequency.Unit mappedUnit = mapFrequencyUnit(unit);

            // Convert minutes to hours if needed
            if (unit != null && unit.toLowerCase().contains("minute")) {
              // Convert minutes to hours (rounding up)
              interval = (interval + 59) / 60;
              if (interval == 0) interval = 1; // At least 1 hour
              mappedUnit = RefreshFrequency.Unit.HOUR;
            }

            refreshFrequency.setInterval(interval);
            refreshFrequency.setUnit(mappedUnit);
            sla.setRefreshFrequency(refreshFrequency);
          } catch (NumberFormatException e) {
            LOG.warn("Unable to parse refresh frequency value: {}", value);
          }
        }
        case "availability", "availabilitytime" ->
        // Store availability time as-is
        sla.setAvailabilityTime(value);
        case "retention" -> {
          Retention retention = new Retention();
          try {
            retention.setPeriod(Integer.parseInt(value));
            retention.setUnit(mapRetentionUnit(unit));
            sla.setRetention(retention);
          } catch (NumberFormatException e) {
            LOG.warn("Unable to parse retention value: {}", value);
          }
        }
        default -> LOG.warn("Unknown SLA property: {}", property);
      }
    }

    return sla;
  }

  private MaxLatency.Unit mapLatencyUnit(String unit) {
    if (unit == null) return MaxLatency.Unit.HOUR;

    return switch (unit.toLowerCase()) {
      case "minute", "minutes", "min" -> MaxLatency.Unit.MINUTE;
      case "hour", "hours", "hr" -> MaxLatency.Unit.HOUR;
      case "day", "days" -> MaxLatency.Unit.DAY;
      default -> {
        LOG.warn("Unknown latency unit '{}', defaulting to HOUR", unit);
        yield MaxLatency.Unit.HOUR;
      }
    };
  }

  private RefreshFrequency.Unit mapFrequencyUnit(String unit) {
    if (unit == null) return RefreshFrequency.Unit.DAY;

    return switch (unit.toLowerCase()) {
      case "hour", "hours", "hr" -> RefreshFrequency.Unit.HOUR;
      case "day", "days" -> RefreshFrequency.Unit.DAY;
      case "week", "weeks" -> RefreshFrequency.Unit.WEEK;
      case "month", "months" -> RefreshFrequency.Unit.MONTH;
      default -> {
        LOG.warn("Unknown frequency unit '{}', defaulting to DAY", unit);
        yield RefreshFrequency.Unit.DAY;
      }
    };
  }

  private Retention.Unit mapRetentionUnit(String unit) {
    if (unit == null) return Retention.Unit.DAY;

    return switch (unit.toLowerCase()) {
      case "day", "days" -> Retention.Unit.DAY;
      case "year", "years" -> Retention.Unit.YEAR;
      default -> {
        LOG.warn("Unknown retention unit '{}', defaulting to DAY", unit);
        yield Retention.Unit.DAY;
      }
    };
  }

  private TeamMapping mapTeamMembers(List<ODCSTeam> team) {
    TeamMapping mapping = new TeamMapping();
    mapping.owners = new ArrayList<>();
    mapping.reviewers = new ArrayList<>();

    for (ODCSTeam member : team) {
      if (member.getUsername() == null) {
        continue;
      }

      // Try to find the user in OpenMetadata
      EntityReference userRef = null;
      try {
        // Look up user by name
        User user =
            Entity.getEntityByName(Entity.USER, member.getUsername(), "id", Include.NON_DELETED);

        // Get entity reference from existing user
        userRef = user.getEntityReference();

      } catch (EntityNotFoundException e) {
        // User not found - add to errors and skip
        String error =
            String.format(
                "User '%s' not found in OpenMetadata. Team member skipped.", member.getUsername());
        mappingErrors.add(error);
        LOG.warn(error);
        continue;
      } catch (Exception e) {
        // Other error - add to errors and skip
        String error =
            String.format("Error looking up user '%s': %s", member.getUsername(), e.getMessage());
        mappingErrors.add(error);
        LOG.error(error);
        continue;
      }

      // Map based on role
      String role = member.getRole() != null ? member.getRole().toLowerCase() : "";
      if (role.contains("owner") || role.contains("lead") || role.contains("manager")) {
        mapping.owners.add(userRef);
      } else if (role.contains("review") || role.contains("approve")) {
        mapping.reviewers.add(userRef);
      } else {
        // Default to owner if role is unclear
        mapping.owners.add(userRef);
      }
    }

    return mapping;
  }

  private static class MappedQualityRules {
    List<QualityExpectation> expectations;
    List<SemanticsRule> semanticRules;
  }

  private static class TeamMapping {
    List<EntityReference> owners;
    List<EntityReference> reviewers;
  }
}
