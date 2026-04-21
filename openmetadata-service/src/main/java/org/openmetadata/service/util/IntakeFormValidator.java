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
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.governance.IntakeForm;
import org.openmetadata.schema.entity.governance.IntakeFormRequiredField;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.IntakeFormRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Org-configurable intake-form validator for governance entities (DataProduct, Domain,
 * GlossaryTerm). Fires only when an {@link IntakeForm} exists for the entity type and is enabled
 * — no-ops otherwise, so existing behavior is unchanged.
 *
 * <p>Schema-required fields (name, description, etc.) are intrinsic to the entity's JSON schema
 * and are enforced at the request boundary by Jackson + Bean Validation. This class intentionally
 * does NOT re-check schema-required fields: doing so during {@code repo.prepare()} would also run
 * for patch/update paths and reject legitimate operations that clear optional values on already-
 * created entities.
 *
 * <p>Fails fast with {@link IllegalArgumentException} so the resource layer can map it to HTTP
 * 400 responses.
 */
public final class IntakeFormValidator {

  private static final Logger LOG = LoggerFactory.getLogger(IntakeFormValidator.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String EXTENSION_PREFIX = "extension.";

  private IntakeFormValidator() {}

  /**
   * Validate the entity against org-configured intake-form required fields, if any.
   *
   * @throws IllegalArgumentException if any intake-form required field is unset.
   */
  public static void validate(EntityInterface entity, String entityType) {
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
    // nullOrEmpty covers null/JSON-null/missing/empty-text/empty-array/empty-object.
    if (nullOrEmpty(value)) return false;
    // Whitespace-only strings are effectively missing values for required-field
    // enforcement — treating them as present would let users bypass validation
    // by typing spaces. nullOrEmpty uses isEmpty() to match the (String) overload,
    // so we re-check blankness explicitly here.
    if (value.isTextual()) return !value.asText().isBlank();
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
