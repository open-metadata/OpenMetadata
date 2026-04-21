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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.api.domains.CreateDataProduct.DataProductType;
import org.openmetadata.schema.api.governance.CreateIntakeForm.TargetEntityType;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.governance.IntakeForm;
import org.openmetadata.schema.entity.governance.IntakeFormRequiredField;
import org.openmetadata.schema.entity.governance.IntakeFormRequiredField.FieldKind;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.IntakeFormRepository;

class IntakeFormValidatorTest {

  private MockedStatic<Entity> entityStatic;
  private IntakeFormRepository mockRepo;

  @BeforeEach
  void setUp() {
    entityStatic = Mockito.mockStatic(Entity.class, Mockito.CALLS_REAL_METHODS);
    mockRepo = mock(IntakeFormRepository.class);
    entityStatic.when(() -> Entity.getEntityRepository(Entity.INTAKE_FORM)).thenReturn(mockRepo);
  }

  @AfterEach
  void tearDown() {
    entityStatic.close();
  }

  // ---------------------------------------------------------------------------
  // No-op when no intake form is configured
  // ---------------------------------------------------------------------------

  @Test
  void validate_passesWhenNoIntakeFormConfigured() {
    when(mockRepo.findEnabledForEntityType(anyString())).thenReturn(null);

    DataProduct dp = validDataProduct();

    assertDoesNotThrow(() -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
  }

  @Test
  void validate_doesNotEnforceSchemaRequiredFieldsItself() {
    // Schema-required fields (name, description) are enforced by Jackson + Bean Validation
    // at the request boundary. The intake-form validator must NOT re-enforce them, otherwise
    // legitimate patch/update paths that clear optional values on existing entities would
    // break. Regression guard for GlossaryTermResourceIT#get_entityWithEmptyDescription*.
    when(mockRepo.findEnabledForEntityType(anyString())).thenReturn(null);

    DataProduct dp = validDataProduct().withName(null).withDescription(null);

    assertDoesNotThrow(() -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
  }

  @Test
  void validate_worksForDomainEntityType() {
    when(mockRepo.findEnabledForEntityType(anyString())).thenReturn(null);

    Domain domain = new Domain().withId(UUID.randomUUID()).withName("eng").withDescription("x");

    assertDoesNotThrow(() -> IntakeFormValidator.validate(domain, Entity.DOMAIN));
  }

  // ---------------------------------------------------------------------------
  // Intake-form-required enforcement
  // ---------------------------------------------------------------------------

  @Test
  void validate_passesWhenIntakeFormConfiguredAndAllRequiredFieldsSet() {
    IntakeForm form = intakeFormRequiring("dataProductType", FieldKind.NATIVE);
    when(mockRepo.findEnabledForEntityType(Entity.DATA_PRODUCT)).thenReturn(form);

    DataProduct dp = validDataProduct().withDataProductType(DataProductType.DATASET);

    assertDoesNotThrow(() -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
  }

  @Test
  void validate_rejectsWhenIntakeFormRequiredNativeFieldMissing() {
    IntakeForm form = intakeFormRequiring("dataProductType", FieldKind.NATIVE);
    when(mockRepo.findEnabledForEntityType(Entity.DATA_PRODUCT)).thenReturn(form);

    DataProduct dp = validDataProduct();

    IllegalArgumentException ex =
        assertThrows(
            IllegalArgumentException.class,
            () -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
    assertTrue(ex.getMessage().contains("intake form"));
    assertTrue(ex.getMessage().contains("Data Product Type"));
  }

  @Test
  void validate_usesCustomErrorMessageWhenProvided() {
    IntakeFormRequiredField field =
        new IntakeFormRequiredField()
            .withFieldPath("dataProductType")
            .withFieldLabel("Data Product Type")
            .withFieldKind(FieldKind.NATIVE)
            .withErrorMessage("Data product type must be specified for VCC governance policy");
    IntakeForm form = newEnabledForm(List.of(field));
    when(mockRepo.findEnabledForEntityType(Entity.DATA_PRODUCT)).thenReturn(form);

    DataProduct dp = validDataProduct();

    IllegalArgumentException ex =
        assertThrows(
            IllegalArgumentException.class,
            () -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
    assertTrue(ex.getMessage().contains("VCC governance policy"));
  }

  @Test
  void validate_passesWhenExtensionCustomPropertyIsSet() {
    IntakeForm form = intakeFormRequiring("extension.riskAssessment", FieldKind.CUSTOM_PROPERTY);
    when(mockRepo.findEnabledForEntityType(Entity.DATA_PRODUCT)).thenReturn(form);

    Map<String, Object> ext = new LinkedHashMap<>();
    ext.put("riskAssessment", "Low");
    DataProduct dp = validDataProduct().withExtension(ext);

    assertDoesNotThrow(() -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
  }

  @Test
  void validate_rejectsWhenExtensionCustomPropertyMissing() {
    IntakeForm form = intakeFormRequiring("extension.riskAssessment", FieldKind.CUSTOM_PROPERTY);
    when(mockRepo.findEnabledForEntityType(Entity.DATA_PRODUCT)).thenReturn(form);

    DataProduct dp = validDataProduct();

    IllegalArgumentException ex =
        assertThrows(
            IllegalArgumentException.class,
            () -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
    assertTrue(ex.getMessage().contains("intake form"));
  }

  @Test
  void validate_rejectsWhenExtensionCustomPropertyPresentButEmptyString() {
    IntakeForm form = intakeFormRequiring("extension.riskAssessment", FieldKind.CUSTOM_PROPERTY);
    when(mockRepo.findEnabledForEntityType(Entity.DATA_PRODUCT)).thenReturn(form);

    Map<String, Object> ext = new LinkedHashMap<>();
    ext.put("riskAssessment", "");
    DataProduct dp = validDataProduct().withExtension(ext);

    assertThrows(
        IllegalArgumentException.class,
        () -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
  }

  @Test
  void validate_rejectsWhenExtensionCustomPropertyIsWhitespaceOnly() {
    // Whitespace-only strings are effectively missing values — treating them as "set"
    // would let users bypass required-field enforcement by typing spaces.
    IntakeForm form = intakeFormRequiring("extension.riskAssessment", FieldKind.CUSTOM_PROPERTY);
    when(mockRepo.findEnabledForEntityType(Entity.DATA_PRODUCT)).thenReturn(form);

    Map<String, Object> ext = new LinkedHashMap<>();
    ext.put("riskAssessment", "   \t\n ");
    DataProduct dp = validDataProduct().withExtension(ext);

    assertThrows(
        IllegalArgumentException.class,
        () -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
  }

  @Test
  void validate_rejectsWhenNativeRequiredFieldIsWhitespaceOnly() {
    // Same logic as the extension case, but for native fields mapped via Jackson
    // into strings (e.g. a required description clobbered with spaces).
    IntakeForm form = intakeFormRequiring("description", FieldKind.NATIVE);
    when(mockRepo.findEnabledForEntityType(Entity.DATA_PRODUCT)).thenReturn(form);

    DataProduct dp = validDataProduct().withDescription("   ");

    assertThrows(
        IllegalArgumentException.class,
        () -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
  }

  @Test
  void validate_collectsAllMissingIntakeFormFieldsInSingleErrorMessage() {
    IntakeFormRequiredField f1 =
        new IntakeFormRequiredField()
            .withFieldPath("dataProductType")
            .withFieldLabel("Data Product Type")
            .withFieldKind(FieldKind.NATIVE);
    IntakeFormRequiredField f2 =
        new IntakeFormRequiredField()
            .withFieldPath("portfolioPriority")
            .withFieldLabel("Portfolio Priority")
            .withFieldKind(FieldKind.NATIVE);
    IntakeFormRequiredField f3 =
        new IntakeFormRequiredField()
            .withFieldPath("extension.riskAssessment")
            .withFieldLabel("Risk Assessment")
            .withFieldKind(FieldKind.CUSTOM_PROPERTY);
    IntakeForm form = newEnabledForm(List.of(f1, f2, f3));
    when(mockRepo.findEnabledForEntityType(Entity.DATA_PRODUCT)).thenReturn(form);

    DataProduct dp = validDataProduct();

    IllegalArgumentException ex =
        assertThrows(
            IllegalArgumentException.class,
            () -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
    assertTrue(ex.getMessage().contains("Data Product Type"));
    assertTrue(ex.getMessage().contains("Portfolio Priority"));
    assertTrue(ex.getMessage().contains("Risk Assessment"));
  }

  @Test
  void validate_passesWhenIntakeFormHasNoRequiredFields() {
    IntakeForm form = newEnabledForm(List.of());
    when(mockRepo.findEnabledForEntityType(Entity.DATA_PRODUCT)).thenReturn(form);

    DataProduct dp = validDataProduct();

    assertDoesNotThrow(() -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
  }

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  @Test
  void validate_skipsRequiredFieldEntryWithBlankFieldPath() {
    IntakeFormRequiredField blank =
        new IntakeFormRequiredField()
            .withFieldPath("   ")
            .withFieldLabel("Something")
            .withFieldKind(FieldKind.NATIVE);
    IntakeForm form = newEnabledForm(List.of(blank));
    when(mockRepo.findEnabledForEntityType(Entity.DATA_PRODUCT)).thenReturn(form);

    DataProduct dp = validDataProduct();

    assertDoesNotThrow(() -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
  }

  @Test
  void validate_rejectsWhenNativeFieldIsEmptyArray() {
    IntakeForm form = intakeFormRequiring("tags", FieldKind.NATIVE);
    when(mockRepo.findEnabledForEntityType(Entity.DATA_PRODUCT)).thenReturn(form);

    DataProduct dp = validDataProduct().withTags(List.of());

    assertThrows(
        IllegalArgumentException.class,
        () -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
  }

  @Test
  void validate_treatsFieldKindCustomPropertyAsExtensionLookupEvenWithoutPrefix() {
    IntakeForm form = intakeFormRequiring("riskAssessment", FieldKind.CUSTOM_PROPERTY);
    when(mockRepo.findEnabledForEntityType(Entity.DATA_PRODUCT)).thenReturn(form);

    Map<String, Object> ext = new LinkedHashMap<>();
    ext.put("riskAssessment", "Low");
    DataProduct dp = validDataProduct().withExtension(ext);

    assertDoesNotThrow(() -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
  }

  @Test
  void validate_treatsDisabledIntakeFormAsAbsent() {
    // IntakeFormRepository.findEnabledForEntityType returns null for disabled forms, so
    // this is implicit in the contract. Verifying the validator relies on that contract.
    when(mockRepo.findEnabledForEntityType(Entity.DATA_PRODUCT)).thenReturn(null);

    DataProduct dp = validDataProduct();

    assertDoesNotThrow(() -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
  }

  // ---------------------------------------------------------------------------
  // Fixtures
  // ---------------------------------------------------------------------------

  private static DataProduct validDataProduct() {
    return new DataProduct()
        .withId(UUID.randomUUID())
        .withName("sales-analytics")
        .withDescription("Customer sales rollup");
  }

  private static IntakeForm intakeFormRequiring(
      String fieldPath, IntakeFormRequiredField.FieldKind kind) {
    String label =
        fieldPath.startsWith("extension.")
            ? "Risk Assessment"
            : fieldPath.equals("dataProductType") ? "Data Product Type" : fieldPath;
    IntakeFormRequiredField field =
        new IntakeFormRequiredField()
            .withFieldPath(fieldPath)
            .withFieldLabel(label)
            .withFieldKind(kind);
    return newEnabledForm(List.of(field));
  }

  private static IntakeForm newEnabledForm(List<IntakeFormRequiredField> fields) {
    return new IntakeForm()
        .withId(UUID.randomUUID())
        .withName("dataProduct-intake")
        .withEntityType(TargetEntityType.DATA_PRODUCT)
        .withEnabled(Boolean.TRUE)
        .withRequiredFields(fields);
  }
}
