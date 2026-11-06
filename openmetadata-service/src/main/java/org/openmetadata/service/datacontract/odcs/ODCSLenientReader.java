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

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssue;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueCategory;
import org.openmetadata.service.util.ODCSConverter;

/**
 * Reads an ODCS document without letting one unreadable value fail the whole import. A value
 * OpenMetadata cannot read, such as a logical type added in a newer ODCS version or a vendor
 * metric, is left out and reported, and reading continues. Only what identifies the document —
 * its {@code apiVersion}, {@code kind} and {@code status} — blocks the import.
 */
public final class ODCSLenientReader {
  private static final String API_VERSION = "apiVersion";
  private static final String KIND = "kind";
  private static final String STATUS = "status";
  private static final String METRIC = "metric";
  private static final String RULE = "rule";
  private static final String LOGICAL_TYPE = "logicalType";
  private static final String NEWEST_READ_VERSION = "v3.2.0";
  private static final String MAPPING_VERSION = "v3.1.0";
  private static final int MAX_REPAIRS = 1000;
  private static final int MAX_QUOTED_VALUE_LENGTH = 60;
  private static final Set<String> IDENTITY_FIELDS = Set.of(API_VERSION, KIND, STATUS);

  private ODCSLenientReader() {}

  /**
   * @return the contract, or empty when a blocking issue, now recorded in {@code issues}, prevents
   *     reading it
   */
  public static Optional<ODCSDataContract> read(
      ObjectMapper mapper, JsonNode document, ODCSImportIssues issues) {
    checkIdentity(document, issues);
    Optional<ODCSDataContract> contract = Optional.empty();
    if (!issues.hasBlocking()) {
      ObjectNode root = (ObjectNode) document;
      ODCSConverter.normalizeODCSInput(root);
      ODCSShapeNormalizer.normalize(root, issues);
      contract = Optional.of(readRepairing(mapper, root, issues));
    }
    return contract;
  }

  /** For imports that do not report: reads the document or rejects it with the blocking reasons. */
  public static ODCSDataContract readOrReject(ObjectMapper mapper, JsonNode document) {
    ODCSImportIssues issues = new ODCSImportIssues();
    return read(mapper, document, issues)
        .orElseThrow(
            () ->
                new IllegalArgumentException(
                    "Invalid ODCS content: "
                        + issues.toList().stream()
                            .map(ODCSImportIssue::getMessage)
                            .collect(Collectors.joining(" "))));
  }

  private static void checkIdentity(JsonNode document, ODCSImportIssues issues) {
    if (document == null || !document.isObject()) {
      issues.blocking(
          ODCSImportIssueCategory.DOCUMENT, null, "", "The file is not an ODCS document.");
    } else {
      checkApiVersion(document.get(API_VERSION), issues);
      checkEnumValue(document, KIND, ODCSDataContract.OdcsKind.values(), issues);
      checkEnumValue(document, STATUS, ODCSDataContract.OdcsStatus.values(), issues);
    }
  }

  private static void checkApiVersion(JsonNode apiVersion, ODCSImportIssues issues) {
    String version = apiVersion == null ? null : apiVersion.asText();
    if (version != null && !isKnown(version, ODCSDataContract.OdcsApiVersion.values())) {
      issues.blocking(
          ODCSImportIssueCategory.DOCUMENT,
          API_VERSION,
          API_VERSION,
          String.format(
              "ODCS %s is not supported. OpenMetadata reads %s.",
              version, allowedValues(ODCSDataContract.OdcsApiVersion.values())));
    } else if (NEWEST_READ_VERSION.equals(version)) {
      issues.info(
          ODCSImportIssueCategory.DOCUMENT,
          API_VERSION,
          API_VERSION,
          String.format(
              "ODCS %s is read with the ODCS %s mapping; fields added in %s are reported below.",
              version, MAPPING_VERSION, version));
    }
  }

  private static void checkEnumValue(
      JsonNode document, String field, Enum<?>[] allowed, ODCSImportIssues issues) {
    JsonNode value = document.get(field);
    if (value == null || value.isNull()) {
      issues.blocking(
          ODCSImportIssueCategory.DOCUMENT,
          field,
          field,
          String.format("The document has no `%s`, which ODCS requires.", field));
    } else if (!isKnown(value.asText(), allowed)) {
      issues.blocking(
          ODCSImportIssueCategory.DOCUMENT,
          field,
          field,
          String.format(
              "`%s: %s` is not valid; ODCS allows %s.",
              field, value.asText(), allowedValues(allowed)));
    }
  }

  private static ODCSDataContract readRepairing(
      ObjectMapper mapper, ObjectNode root, ODCSImportIssues issues) {
    ODCSDataContract contract = null;
    for (int attempt = 0; contract == null && attempt < MAX_REPAIRS; attempt++) {
      try {
        contract = mapper.treeToValue(root, ODCSDataContract.class);
      } catch (JsonMappingException e) {
        repair(root, e, issues);
      } catch (JsonProcessingException e) {
        throw new IllegalArgumentException("Invalid ODCS content: " + e.getOriginalMessage(), e);
      }
    }
    if (contract == null) {
      throw new IllegalArgumentException("Invalid ODCS content: too many unreadable values.");
    }
    return contract;
  }

  /** Leaves out the value Jackson could not read, or moves an unknown metric to {@code rule}. */
  private static void repair(ObjectNode root, JsonMappingException e, ODCSImportIssues issues) {
    List<JsonMappingException.Reference> path = e.getPath();
    JsonNode parent = path.isEmpty() ? null : navigate(root, path.subList(0, path.size() - 1));
    if (parent == null || isIdentityField(parent == root, path.getLast())) {
      throw new IllegalArgumentException("Invalid ODCS content: " + e.getOriginalMessage(), e);
    }
    JsonMappingException.Reference last = path.getLast();
    String location = describe(path);
    JsonNode value = valueAt(parent, last);
    if (METRIC.equals(last.getFieldName()) && parent instanceof ObjectNode rule) {
      moveMetricToRule(rule, value, location, issues);
    } else {
      remove(parent, last);
      reportUnreadable(fieldName(path), value, location, issues);
    }
  }

  private static void moveMetricToRule(
      ObjectNode rule, JsonNode metric, String location, ODCSImportIssues issues) {
    rule.remove(METRIC);
    if (!rule.hasNonNull(RULE)) {
      rule.set(RULE, TextNode.valueOf(metric.asText()));
    }
    issues.warning(
        ODCSImportIssueCategory.QUALITY,
        METRIC,
        location,
        String.format(
            "`metric: %s` is not an ODCS metric OpenMetadata knows; the rule is kept but does not run.",
            quote(metric)));
  }

  private static void reportUnreadable(
      String field, JsonNode value, String location, ODCSImportIssues issues) {
    String consequence =
        LOGICAL_TYPE.equals(field)
            ? "so the column type is taken from physicalType"
            : "so it is not imported";
    issues.warning(
        ODCSPaths.category(location),
        field,
        location,
        String.format("`%s: %s` cannot be read, %s.", field, quote(value), consequence));
  }

  /** The key being read; for a list element, the key of the list. */
  private static String fieldName(List<JsonMappingException.Reference> path) {
    return path.reversed().stream()
        .map(JsonMappingException.Reference::getFieldName)
        .filter(name -> name != null)
        .findFirst()
        .orElse("");
  }

  private static boolean isIdentityField(boolean atRoot, JsonMappingException.Reference field) {
    return atRoot && IDENTITY_FIELDS.contains(field.getFieldName());
  }

  private static JsonNode navigate(JsonNode root, List<JsonMappingException.Reference> path) {
    JsonNode node = root;
    for (JsonMappingException.Reference reference : path) {
      node = node == null ? null : valueAt(node, reference);
    }
    return node;
  }

  private static JsonNode valueAt(JsonNode node, JsonMappingException.Reference reference) {
    return reference.getFieldName() != null
        ? node.get(reference.getFieldName())
        : node.get(reference.getIndex());
  }

  private static void remove(JsonNode parent, JsonMappingException.Reference reference) {
    if (parent instanceof ObjectNode object && reference.getFieldName() != null) {
      object.remove(reference.getFieldName());
    } else if (parent instanceof ArrayNode array && reference.getIndex() >= 0) {
      array.remove(reference.getIndex());
    } else {
      throw new IllegalArgumentException("Invalid ODCS content at " + reference.getDescription());
    }
  }

  private static String describe(List<JsonMappingException.Reference> path) {
    StringBuilder location = new StringBuilder();
    for (JsonMappingException.Reference reference : path) {
      if (reference.getFieldName() != null) {
        location.append(location.isEmpty() ? "" : ".").append(reference.getFieldName());
      } else {
        location.append('[').append(reference.getIndex()).append(']');
      }
    }
    return location.toString();
  }

  private static String quote(JsonNode value) {
    String text = value == null ? "null" : value.isValueNode() ? value.asText() : value.toString();
    return text.length() > MAX_QUOTED_VALUE_LENGTH
        ? text.substring(0, MAX_QUOTED_VALUE_LENGTH) + "…"
        : text;
  }

  private static boolean isKnown(String value, Enum<?>[] allowed) {
    return Arrays.stream(allowed).anyMatch(candidate -> candidate.toString().equals(value));
  }

  private static String allowedValues(Enum<?>[] allowed) {
    return Arrays.stream(allowed).map(Enum::toString).collect(Collectors.joining(", "));
  }
}
