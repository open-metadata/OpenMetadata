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

package org.openmetadata.service.config.source;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.databind.node.TextNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.SortedMap;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;

/**
 * The deployment configuration as written, before environment substitution: which environment
 * variable sets each field, and the value the field takes when that variable is unset.
 *
 * <p>Helm charts and docker-compose files set every variable explicitly, usually to the default,
 * so "the variable is set" says nothing. A field counts as deliberately configured only when its
 * value differs from the default written in the file, or when the file holds a literal value.
 */
@Slf4j
public final class DeploymentTemplate {
  private static final YAMLMapper YAML = new YAMLMapper();
  private static final Pattern PLACEHOLDER =
      Pattern.compile("^\\$\\{([A-Za-z_][A-Za-z0-9_]*)(:-(.*))?}$", Pattern.DOTALL);
  private static final Pattern ANY_VARIABLE = Pattern.compile("\\$\\{([A-Za-z_][A-Za-z0-9_]*)");
  private static final String VARIABLE_START = "${";
  private static final DeploymentTemplate EMPTY = new DeploymentTemplate(new TreeMap<>());

  private final SortedMap<String, TemplateField> fields;

  /**
   * @param envVariable the variable that sets the field, if the file uses one
   * @param defaultValue the value the field takes when the variable is unset; null when unknown
   * @param literal whether the file holds the value itself rather than a variable
   */
  record TemplateField(String envVariable, JsonNode defaultValue, boolean literal) {
    boolean isDeliberate(JsonNode deploymentValue) {
      return literal
          || (defaultValue != null && !SettingValues.same(deploymentValue, defaultValue));
    }
  }

  private DeploymentTemplate(SortedMap<String, TemplateField> fields) {
    this.fields = fields;
  }

  public static DeploymentTemplate empty() {
    return EMPTY;
  }

  /** Reads the section at {@code sectionPointer}, for example {@code /authenticationConfiguration}. */
  public static DeploymentTemplate parse(String yaml, String sectionPointer) {
    try {
      JsonNode section = JsonPointers.valueAt(YAML.readTree(yaml), sectionPointer);
      SortedMap<String, TemplateField> fields = new TreeMap<>();
      JsonPointers.leaves(section, pointer -> false)
          .forEach((pointer, value) -> fields.put(pointer, fieldOf(value)));
      return new DeploymentTemplate(fields);
    } catch (JsonProcessingException unreadable) {
      LOG.warn("Could not read the deployment configuration template: {}", unreadable.getMessage());
      return EMPTY;
    }
  }

  public boolean isAvailable() {
    return !fields.isEmpty();
  }

  public Set<String> paths() {
    return fields.keySet();
  }

  /** Whether the deployment deliberately configures any of {@code pointers}. */
  public boolean isDeliberate(JsonNode deployment, Collection<String> pointers) {
    return fieldsCovering(pointers)
        .anyMatch(
            entry ->
                entry.getValue().isDeliberate(JsonPointers.valueAt(deployment, entry.getKey())));
  }

  public boolean covers(Collection<String> pointers) {
    return fieldsCovering(pointers).findAny().isPresent();
  }

  public Optional<String> envVariable(Collection<String> pointers) {
    return fieldsCovering(pointers)
        .map(entry -> entry.getValue().envVariable())
        .filter(variable -> variable != null)
        .findFirst();
  }

  private Stream<Map.Entry<String, TemplateField>> fieldsCovering(Collection<String> pointers) {
    return fields.entrySet().stream()
        .filter(entry -> pointers.stream().anyMatch(pointer -> overlaps(entry.getKey(), pointer)));
  }

  private static boolean overlaps(String templatePointer, String pointer) {
    return JsonPointers.isUnder(templatePointer, pointer)
        || JsonPointers.isUnder(pointer, templatePointer);
  }

  private static TemplateField fieldOf(JsonNode value) {
    String text = value.isTextual() ? value.asText() : "";
    Matcher placeholder = PLACEHOLDER.matcher(text);
    TemplateField field;
    if (placeholder.matches()) {
      field = new TemplateField(placeholder.group(1), defaultOf(placeholder), false);
    } else if (text.contains(VARIABLE_START)) {
      field = new TemplateField(firstVariable(text), null, false);
    } else {
      field = new TemplateField(null, null, true);
    }
    return field;
  }

  /** Without a default, an unset variable leaves the placeholder text in place. */
  private static JsonNode defaultOf(Matcher placeholder) {
    String defaultText = placeholder.group(3);
    JsonNode defaultValue;
    if (placeholder.group(2) == null) {
      defaultValue = TextNode.valueOf(placeholder.group(0));
    } else if (defaultText.contains(VARIABLE_START)) {
      defaultValue = null;
    } else {
      defaultValue = parseScalar(defaultText);
    }
    return defaultValue;
  }

  private static JsonNode parseScalar(String text) {
    try {
      JsonNode parsed = YAML.readTree(text);
      return parsed == null || parsed.isMissingNode() ? NullNode.getInstance() : parsed;
    } catch (JsonProcessingException notYaml) {
      return TextNode.valueOf(text);
    }
  }

  private static String firstVariable(String text) {
    Matcher variable = ANY_VARIABLE.matcher(text);
    return variable.find() ? variable.group(1) : null;
  }
}
