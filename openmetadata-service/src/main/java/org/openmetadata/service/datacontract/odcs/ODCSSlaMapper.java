/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.datacontract.odcs;

import static java.util.Map.entry;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.schema.api.data.MaxLatency;
import org.openmetadata.schema.api.data.RefreshFrequency;
import org.openmetadata.schema.api.data.Retention;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueCategory;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSSlaProperty;

/**
 * Converts between ODCS {@code slaProperties} and the contract SLA. An SLA property OpenMetadata cannot
 * represent — an unknown property, a value that is not a whole number, a unit the SLA field does
 * not offer — is left out and reported rather than failing the import or being stored as 0.
 */
@Slf4j
public final class ODCSSlaMapper {
  private static final String SLA_PROPERTIES = "slaProperties";
  private static final String FRESHNESS = "freshness";
  private static final String LATENCY = "latency";
  private static final String RETENTION = "retention";
  private static final String AVAILABILITY_TIME = "availabilityTime";

  private enum Kind {
    FRESHNESS,
    LATENCY,
    RETENTION,
    AVAILABILITY
  }

  private static final Map<String, Kind> KINDS =
      Map.ofEntries(
          entry("freshness", Kind.FRESHNESS),
          entry("refreshfrequency", Kind.FRESHNESS),
          entry("latency", Kind.LATENCY),
          entry("maxlatency", Kind.LATENCY),
          entry("retention", Kind.RETENTION),
          entry("availabilitytime", Kind.AVAILABILITY));

  private static final Set<String> REFRESH_UNITS = values(RefreshFrequency.Unit.values());
  private static final Set<String> LATENCY_UNITS = values(MaxLatency.Unit.values());
  private static final Set<String> RETENTION_UNITS = values(Retention.Unit.values());
  private static final Set<String> TIMEZONES = values(ContractSLA.Timezone.values());

  /** One ODCS SLA property and where it sits in the document. */
  private record Entry(ODCSSlaProperty property, String path, ODCSImportIssues issues) {}

  private ODCSSlaMapper() {}

  public static ContractSLA toContractSla(
      List<ODCSSlaProperty> properties, ODCSImportIssues issues) {
    ContractSLA sla = new ContractSLA().withTimezone(null);
    for (int index = 0; index < properties.size(); index++) {
      apply(
          sla, new Entry(properties.get(index), ODCSPaths.element(SLA_PROPERTIES, index), issues));
    }
    return sla;
  }

  public static List<ODCSSlaProperty> toOdcs(ContractSLA sla) {
    List<ODCSSlaProperty> properties = new ArrayList<>();
    if (sla.getRefreshFrequency() != null) {
      properties.add(
          property(
                  FRESHNESS,
                  sla.getRefreshFrequency().getInterval(),
                  sla.getRefreshFrequency().getUnit())
              .withElement(ODCSSlaColumn.toElement(sla.getColumnName())));
    }
    if (sla.getMaxLatency() != null) {
      properties.add(
          property(LATENCY, sla.getMaxLatency().getValue(), sla.getMaxLatency().getUnit()));
    }
    if (sla.getRetention() != null) {
      properties.add(
          property(RETENTION, sla.getRetention().getPeriod(), sla.getRetention().getUnit()));
    }
    if (sla.getAvailabilityTime() != null) {
      properties.add(
          new ODCSSlaProperty()
              .withProperty(AVAILABILITY_TIME)
              .withValue(sla.getAvailabilityTime())
              .withValueExt(sla.getTimezone() == null ? null : sla.getTimezone().value()));
    }
    return properties;
  }

  private static void apply(ContractSLA sla, Entry entry) {
    String name = entry.property().getProperty();
    Kind kind = name == null ? null : KINDS.get(name.toLowerCase(Locale.ROOT));
    if (kind == null) {
      warn(
          entry,
          "property",
          String.format(
              "SLA property `%s` has no OpenMetadata equivalent, so it is not imported.", name));
    } else {
      switch (kind) {
        case FRESHNESS -> applyFreshness(sla, entry);
        case LATENCY -> applyLatency(sla, entry);
        case RETENTION -> applyRetention(sla, entry);
        case AVAILABILITY -> applyAvailability(sla, entry);
      }
    }
  }

  private static void applyFreshness(ContractSLA sla, Entry entry) {
    Integer interval = wholeNumber(entry);
    String unit = usableUnit(entry, REFRESH_UNITS);
    if (interval != null && isUnitUsable(entry, unit)) {
      sla.setRefreshFrequency(
          new RefreshFrequency()
              .withInterval(interval)
              .withUnit(unit == null ? null : RefreshFrequency.Unit.fromValue(unit)));
      sla.setColumnName(elementColumn(entry.property().getElement()));
    }
  }

  private static void applyLatency(ContractSLA sla, Entry entry) {
    Integer value = wholeNumber(entry);
    String unit = usableUnit(entry, LATENCY_UNITS);
    if (value != null && isUnitUsable(entry, unit)) {
      sla.setMaxLatency(
          new MaxLatency()
              .withValue(value)
              .withUnit(unit == null ? null : MaxLatency.Unit.fromValue(unit)));
    }
  }

  private static void applyRetention(ContractSLA sla, Entry entry) {
    Integer period = wholeNumber(entry);
    String unit = usableUnit(entry, RETENTION_UNITS);
    if (period != null && isUnitUsable(entry, unit)) {
      sla.setRetention(
          new Retention()
              .withPeriod(period)
              .withUnit(unit == null ? null : Retention.Unit.fromValue(unit)));
    }
  }

  private static void applyAvailability(ContractSLA sla, Entry entry) {
    sla.setAvailabilityTime(entry.property().getValue());
    String timezone = entry.property().getValueExt();
    if (TIMEZONES.contains(timezone)) {
      sla.setTimezone(ContractSLA.Timezone.fromValue(timezone));
    } else if (!nullOrEmpty(timezone)) {
      warn(
          entry,
          "valueExt",
          String.format(
              "Timezone `%s` is not one OpenMetadata lists, so the availability time has no timezone.",
              timezone));
    }
  }

  private static Integer wholeNumber(Entry entry) {
    String value = entry.property().getValue();
    Integer number = null;
    try {
      number = value == null ? null : Integer.valueOf(value.trim());
    } catch (NumberFormatException e) {
      LOG.debug("ODCS SLA value '{}' is not a whole number", value);
    }
    if (number == null) {
      warn(
          entry,
          "value",
          String.format(
              "SLA `%s` value `%s` is not a whole number, so it is not imported.",
              entry.property().getProperty(), value));
    }
    return number;
  }

  /** The unit in OpenMetadata's spelling, or null when absent or not one the SLA field offers. */
  private static String usableUnit(Entry entry, Set<String> allowed) {
    String unit = ODCSTimeUnits.normalize(entry.property().getUnit());
    boolean usable = unit == null || allowed.contains(unit);
    if (!usable) {
      warn(
          entry,
          "unit",
          String.format(
              "SLA `%s` in `%s` is not imported: OpenMetadata allows %s.",
              entry.property().getProperty(), unit, String.join(", ", allowed)));
    }
    return usable ? unit : null;
  }

  private static boolean isUnitUsable(Entry entry, String normalizedUnit) {
    return entry.property().getUnit() == null || normalizedUnit != null;
  }

  /**
   * ODCS names an SLA element {@code object.property}; the contract keeps only the column, since
   * it already belongs to one object.
   */
  private static String elementColumn(String element) {
    return nullOrEmpty(element) ? null : element.substring(element.lastIndexOf('.') + 1);
  }

  private static ODCSSlaProperty property(String name, Integer value, Enum<?> unit) {
    return new ODCSSlaProperty()
        .withProperty(name)
        .withValue(String.valueOf(value))
        .withUnit(unit == null ? null : unit.toString());
  }

  private static void warn(Entry entry, String field, String message) {
    entry
        .issues()
        .warning(ODCSImportIssueCategory.SLA, field, ODCSPaths.child(entry.path(), field), message);
  }

  private static Set<String> values(Enum<?>[] constants) {
    Set<String> values = new LinkedHashSet<>();
    Arrays.stream(constants).map(Enum::toString).forEach(values::add);
    return Collections.unmodifiableSet(values);
  }
}
