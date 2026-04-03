/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.search;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public final class SearchResultCsvExporter {

  public static final String CSV_HEADER =
      "Entity Type,Service Name,Service Type,FQN,Name,Display Name,Description,Owners,Tags,Glossary Terms,Domains,Tier";

  public static final int MAX_EXPORT_ROWS = 200_000;
  public static final int BATCH_SIZE = 1_000;

  public static final List<String> EXPORT_SOURCE_FIELDS =
      Arrays.asList(
          "entityType",
          "name",
          "displayName",
          "fullyQualifiedName",
          "description",
          "service",
          "serviceType",
          "owners",
          "tags",
          "tier",
          "domain",
          "domains");

  private SearchResultCsvExporter() {}

  @SuppressWarnings("unchecked")
  public static String toCsvRow(Map<String, Object> source) {
    String entityType = getString(source, "entityType");
    String serviceName = extractServiceName(source);
    String serviceType = getString(source, "serviceType");
    String name = getString(source, "name");
    String displayName = getString(source, "displayName");
    String fqn = getString(source, "fullyQualifiedName");
    String description = getString(source, "description");
    String owners = extractOwners(source);
    String tags = extractTags(source);
    String glossaryTerms = extractGlossaryTerms(source);
    String domains = extractDomains(source);
    String tier = extractTier(source);

    return String.join(
        ",",
        escapeCsv(entityType),
        escapeCsv(serviceName),
        escapeCsv(serviceType),
        escapeCsv(fqn),
        escapeCsv(name),
        escapeCsv(displayName),
        escapeCsv(description),
        escapeCsv(owners),
        escapeCsv(tags),
        escapeCsv(glossaryTerms),
        escapeCsv(domains),
        escapeCsv(tier));
  }

  static String escapeCsv(String value) {
    if (value == null || value.isEmpty()) {
      return "";
    }
    String stripped = value.stripLeading();
    if (!stripped.isEmpty()) {
      char first = stripped.charAt(0);
      if (first == '=' || first == '+' || first == '-' || first == '@') {
        value = "'" + value;
      }
    }
    if (value.contains(",")
        || value.contains("\"")
        || value.contains("\n")
        || value.contains("\r")) {
      return "\"" + value.replace("\"", "\"\"") + "\"";
    }
    return value;
  }

  @SuppressWarnings("unchecked")
  static String extractServiceName(Map<String, Object> source) {
    Object service = source.get("service");
    if (service instanceof Map) {
      Object name = ((Map<String, Object>) service).get("name");
      return name != null ? name.toString() : "";
    }
    return "";
  }

  @SuppressWarnings("unchecked")
  static String extractOwners(Map<String, Object> source) {
    Object owners = source.get("owners");
    if (owners instanceof List) {
      return ((List<Object>) owners)
          .stream()
              .filter(o -> o instanceof Map)
              .map(
                  o -> {
                    Map<String, Object> ownerMap = (Map<String, Object>) o;
                    Object displayName = ownerMap.get("displayName");
                    if (displayName != null && !displayName.toString().isEmpty()) {
                      return displayName.toString();
                    }
                    Object name = ownerMap.get("name");
                    return name != null ? name.toString() : "";
                  })
              .filter(s -> !s.isEmpty())
              .collect(Collectors.joining("|"));
    }
    return "";
  }

  @SuppressWarnings("unchecked")
  static String extractTags(Map<String, Object> source) {
    return extractTagsBySource(source, "Classification");
  }

  @SuppressWarnings("unchecked")
  static String extractGlossaryTerms(Map<String, Object> source) {
    return extractTagsBySource(source, "Glossary");
  }

  @SuppressWarnings("unchecked")
  private static String extractTagsBySource(Map<String, Object> source, String tagSource) {
    Object tags = source.get("tags");
    if (tags instanceof List) {
      return ((List<Object>) tags)
          .stream()
              .filter(t -> t instanceof Map)
              .map(t -> (Map<String, Object>) t)
              .filter(t -> tagSource.equals(getString(t, "source")))
              .map(t -> getString(t, "tagFQN"))
              .filter(s -> s != null && !s.isEmpty())
              .collect(Collectors.joining("|"));
    }
    return "";
  }

  @SuppressWarnings("unchecked")
  static String extractDomains(Map<String, Object> source) {
    Object domains = source.get("domains");
    if (domains instanceof List) {
      List<String> names = new ArrayList<>();
      for (Object d : (List<Object>) domains) {
        if (d instanceof Map) {
          Object displayName = ((Map<String, Object>) d).get("displayName");
          if (displayName != null && !displayName.toString().isEmpty()) {
            names.add(displayName.toString());
            continue;
          }
          Object name = ((Map<String, Object>) d).get("name");
          if (name != null) {
            names.add(name.toString());
          }
        }
      }
      return String.join("|", names);
    }
    Object domain = source.get("domain");
    if (domain instanceof Map) {
      Object displayName = ((Map<String, Object>) domain).get("displayName");
      if (displayName != null && !displayName.toString().isEmpty()) {
        return displayName.toString();
      }
      Object name = ((Map<String, Object>) domain).get("name");
      return name != null ? name.toString() : "";
    }
    return "";
  }

  @SuppressWarnings("unchecked")
  static String extractTier(Map<String, Object> source) {
    Object tier = source.get("tier");
    if (tier instanceof Map) {
      Object tagFQN = ((Map<String, Object>) tier).get("tagFQN");
      return tagFQN != null ? tagFQN.toString() : "";
    }
    return "";
  }

  private static String getString(Map<String, Object> map, String key) {
    Object value = map.get(key);
    return value != null ? value.toString() : "";
  }
}
