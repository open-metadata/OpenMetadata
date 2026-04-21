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

package org.openmetadata.service.util;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.governance.IntakeForm;
import org.openmetadata.schema.entity.governance.IntakeFormRequiredField;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.IntakeFormRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Layered validator for governance entities (DataProduct, Domain, later GlossaryTerm).
 *
 * <p>Two validation layers, applied in order:
 *
 * <ol>
 *   <li><b>Schema-required</b> — intrinsic to the entity's JSON schema (e.g. {@code name},
 *       {@code description}). Normally enforced at the request boundary by Jackson + Bean
 *       Validation before this method runs; this class re-checks as a sanity guard with a clear
 *       error message.
 *   <li><b>IntakeForm-required</b> — org-configurable policy. Only fires when an {@link
 *       IntakeForm} exists for the entity type and is enabled.
 * </ol>
 *
 * <p>Both layers fail fast with {@link IllegalArgumentException} so the resource layer can map
 * them to HTTP 400 responses. If no IntakeForm exists for the entity type, Layer 2 is a no-op —
 * existing behavior is unchanged.
 */
public final class IntakeFormValidator {

  private static final Logger LOG = LoggerFactory.getLogger(IntakeFormValidator.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String EXTENSION_PREFIX = "extension.";

  /**
   * Minimum schema-required fields per entity type. Kept narrow intentionally — this is a sanity
   * guard; the authoritative list lives in each entity's JSON schema and is enforced earlier by
   * the framework. Additions here should reflect the schema's own {@code "required"} array.
   */
  private static final Map<String, List<String>> SCHEMA_REQUIRED_FIELDS =
      Map.of(
          Entity.DATA_PRODUCT, List.of("name", "description"),
          Entity.DOMAIN, List.of("name", "description"),
          Entity.GLOSSARY_TERM, List.of("name", "description"));

  private IntakeFormValidator() {}

  /**
   * Validate the entity against schema-required fields first, then IntakeForm-required fields.
   *
   * @throws IllegalArgumentException if any required field is unset. The message indicates which
   *     layer fired.
   */
  public static void validate(EntityInterface entity, String entityType) {
    List<String> schemaMissing = checkSchemaRequiredFields(entity, entityType);
    if (!schemaMissing.isEmpty()) {
      throw new IllegalArgumentException(
          "Missing required field(s): " + String.join(", ", schemaMissing));
    }

    IntakeForm form = loadIntakeForm(entityType);
    if (form == null) return;

    List<String> intakeMissing = checkIntakeFormRequiredFields(entity, form);
    if (!intakeMissing.isEmpty()) {
      throw new IllegalArgumentException(
          "Missing required field(s) per intake form '"
              + form.getName()
              + "': "
              + String.join(", ", intakeMissing));
    }
  }

  private static List<String> checkSchemaRequiredFields(EntityInterface entity, String entityType) {
    List<String> required = SCHEMA_REQUIRED_FIELDS.getOrDefault(entityType, List.of());
    List<String> missing = new ArrayList<>();
    for (String path : required) {
      if (!isNativeFieldSet(entity, path)) {
        missing.add(path);
      }
    }
    return missing;
  }

  private static List<String> checkIntakeFormRequiredFields(
      EntityInterface entity, IntakeForm form) {
    List<String> missing = new ArrayList<>();
    for (IntakeFormRequiredField field : listOrEmpty(form.getRequiredFields())) {
      if (field.getFieldPath() == null || field.getFieldPath().isBlank()) continue;
      if (!isFieldSet(entity, field)) {
        missing.add(
            field.getErrorMessage() != null && !field.getErrorMessage().isBlank()
                ? field.getErrorMessage()
                : (field.getFieldLabel() != null ? field.getFieldLabel() : field.getFieldPath()));
      }
    }
    return missing;
  }

  private static boolean isFieldSet(EntityInterface entity, IntakeFormRequiredField field) {
    boolean isCustomProperty =
        IntakeFormRequiredField.FieldKind.CUSTOM_PROPERTY.equals(field.getFieldKind())
            || field.getFieldPath().startsWith(EXTENSION_PREFIX);
    if (isCustomProperty) {
      return isExtensionFieldSet(entity, field.getFieldPath());
    }
    return isNativeFieldSet(entity, field.getFieldPath());
  }

  private static boolean isNativeFieldSet(EntityInterface entity, String fieldName) {
    try {
      JsonNode node = MAPPER.valueToTree(entity);
      return hasMeaningfulValue(node.get(fieldName));
    } catch (Exception e) {
      LOG.debug("Could not resolve native field '{}' on entity: {}", fieldName, e.getMessage());
      return false;
    }
  }

  private static boolean isExtensionFieldSet(EntityInterface entity, String path) {
    String propertyName =
        path.startsWith(EXTENSION_PREFIX) ? path.substring(EXTENSION_PREFIX.length()) : path;
    Object ext = entity.getExtension();
    if (ext == null) return false;
    try {
      JsonNode extNode = MAPPER.valueToTree(ext);
      return hasMeaningfulValue(extNode.get(propertyName));
    } catch (Exception e) {
      LOG.debug(
          "Could not resolve extension field '{}' on entity: {}", propertyName, e.getMessage());
      return false;
    }
  }

  private static boolean hasMeaningfulValue(JsonNode value) {
    if (value == null || value.isNull() || value.isMissingNode()) return false;
    if (value.isTextual()) return !value.asText().isEmpty();
    if (value.isArray()) return value.size() > 0;
    if (value.isObject()) return value.size() > 0;
    return true;
  }

  private static IntakeForm loadIntakeForm(String entityType) {
    try {
      IntakeFormRepository repo =
          (IntakeFormRepository) Entity.getEntityRepository(Entity.INTAKE_FORM);
      return repo.findEnabledForEntityType(entityType);
    } catch (Exception e) {
      LOG.debug("IntakeForm lookup failed for {}: {}", entityType, e.getMessage());
      return null;
    }
  }
}
