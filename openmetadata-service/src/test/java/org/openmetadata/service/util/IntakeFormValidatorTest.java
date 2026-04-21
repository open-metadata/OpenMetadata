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
  // Layer 1 — schema-required
  // ---------------------------------------------------------------------------

  @Test
  void validate_passesWhenAllSchemaRequiredFieldsSetAndNoIntakeForm() {
    when(mockRepo.findEnabledForEntityType(anyString())).thenReturn(null);

    DataProduct dp = validDataProduct();

    assertDoesNotThrow(() -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
  }

  @Test
  void validate_rejectsWhenSchemaRequiredNameMissing() {
    when(mockRepo.findEnabledForEntityType(anyString())).thenReturn(null);

    DataProduct dp = validDataProduct().withName(null);

    IllegalArgumentException ex =
        assertThrows(
            IllegalArgumentException.class,
            () -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
    assertTrue(ex.getMessage().contains("Missing required field"));
    assertTrue(ex.getMessage().contains("name"));
  }

  @Test
  void validate_rejectsWhenSchemaRequiredDescriptionMissing() {
    when(mockRepo.findEnabledForEntityType(anyString())).thenReturn(null);

    DataProduct dp = validDataProduct().withDescription(null);

    IllegalArgumentException ex =
        assertThrows(
            IllegalArgumentException.class,
            () -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
    assertTrue(ex.getMessage().contains("description"));
  }

  @Test
  void validate_rejectsWhenBothNameAndDescriptionMissing() {
    when(mockRepo.findEnabledForEntityType(anyString())).thenReturn(null);

    DataProduct dp = validDataProduct().withName(null).withDescription(null);

    IllegalArgumentException ex =
        assertThrows(
            IllegalArgumentException.class,
            () -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
    assertTrue(ex.getMessage().contains("name"));
    assertTrue(ex.getMessage().contains("description"));
  }

  @Test
  void validate_worksForDomainEntityType() {
    when(mockRepo.findEnabledForEntityType(anyString())).thenReturn(null);

    Domain domain = new Domain().withId(UUID.randomUUID()).withName("eng").withDescription("x");

    assertDoesNotThrow(() -> IntakeFormValidator.validate(domain, Entity.DOMAIN));
  }

  // ---------------------------------------------------------------------------
  // Layer 2 — IntakeForm-required
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

  @Test
  void validate_passesWhenNoIntakeFormIsConfiguredForEntityType() {
    when(mockRepo.findEnabledForEntityType(anyString())).thenReturn(null);

    DataProduct dp = validDataProduct();

    assertDoesNotThrow(() -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
  }

  // ---------------------------------------------------------------------------
  // Ordering — schema-required runs before intake-form-required
  // ---------------------------------------------------------------------------

  @Test
  void validate_surfacesSchemaFailureBeforeIntakeFormFailure() {
    IntakeForm form = intakeFormRequiring("dataProductType", FieldKind.NATIVE);
    when(mockRepo.findEnabledForEntityType(Entity.DATA_PRODUCT)).thenReturn(form);

    DataProduct dp =
        validDataProduct()
            .withName(null); // schema-required missing AND intake-form-required missing

    IllegalArgumentException ex =
        assertThrows(
            IllegalArgumentException.class,
            () -> IntakeFormValidator.validate(dp, Entity.DATA_PRODUCT));
    // Should report schema failure first, not intake form failure
    assertTrue(
        ex.getMessage().startsWith("Missing required field(s):"),
        "Expected schema-layer error first, got: " + ex.getMessage());
    assertTrue(ex.getMessage().contains("name"));
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
