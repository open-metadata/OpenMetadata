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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.governance.IntakeForm;
import org.openmetadata.schema.entity.governance.IntakeFormField;
import org.openmetadata.schema.entity.governance.IntakeFormRequiredField;

class IntakeFormUtilTest {

  @Test
  void getEffectiveFormFieldsConvertsLegacyRequiredFields() {
    IntakeFormRequiredField requiredField =
        new IntakeFormRequiredField()
            .withFieldPath("extension.steward")
            .withFieldLabel("Steward")
            .withFieldKind(IntakeFormRequiredField.FieldKind.CUSTOM_PROPERTY);
    IntakeForm intakeForm = new IntakeForm().withRequiredFields(List.of(requiredField));

    List<IntakeFormField> fields = IntakeFormUtil.getEffectiveFormFields(intakeForm);

    assertEquals(1, fields.size());
    assertEquals("extension.steward", fields.get(0).getFieldPath());
    assertTrue(fields.get(0).getRequired());
  }

  @Test
  void synchronizeFieldsKeepsOptionalFieldsOutOfLegacyRequiredFields() {
    IntakeFormField optionalField =
        new IntakeFormField()
            .withFieldPath("extension.steward")
            .withFieldLabel("Steward")
            .withFieldKind(IntakeFormField.FieldKind.CUSTOM_PROPERTY)
            .withRequired(false);
    IntakeFormField requiredField =
        new IntakeFormField()
            .withFieldPath("dataProductType")
            .withFieldLabel("Data Product Type")
            .withFieldKind(IntakeFormField.FieldKind.NATIVE)
            .withRequired(true);
    IntakeForm intakeForm = new IntakeForm().withFormFields(List.of(optionalField, requiredField));

    IntakeFormUtil.synchronizeFields(intakeForm);

    assertEquals(2, intakeForm.getFormFields().size());
    assertFalse(intakeForm.getFormFields().get(0).getRequired());
    assertEquals(1, intakeForm.getRequiredFields().size());
    assertEquals("dataProductType", intakeForm.getRequiredFields().get(0).getFieldPath());
  }

  @Test
  void removeCustomPropertyFieldRemovesIncludedAndRequiredRepresentations() {
    IntakeFormField requiredField =
        new IntakeFormField()
            .withFieldPath("extension.steward")
            .withFieldLabel("Steward")
            .withFieldKind(IntakeFormField.FieldKind.CUSTOM_PROPERTY)
            .withRequired(true);
    IntakeFormField optionalField =
        new IntakeFormField()
            .withFieldPath("extension.audience")
            .withFieldLabel("Audience")
            .withFieldKind(IntakeFormField.FieldKind.CUSTOM_PROPERTY)
            .withRequired(false);
    IntakeForm intakeForm = new IntakeForm().withFormFields(List.of(requiredField, optionalField));
    IntakeFormUtil.synchronizeFields(intakeForm);

    assertTrue(IntakeFormUtil.removeCustomPropertyField(intakeForm, "steward"));

    assertEquals(1, intakeForm.getFormFields().size());
    assertEquals("extension.audience", intakeForm.getFormFields().get(0).getFieldPath());
    assertTrue(intakeForm.getRequiredFields().isEmpty());
  }

  @Test
  void removeCustomPropertyFieldSupportsLegacyRequiredFields() {
    IntakeFormRequiredField requiredField =
        new IntakeFormRequiredField()
            .withFieldPath("extension.steward")
            .withFieldLabel("Steward")
            .withFieldKind(IntakeFormRequiredField.FieldKind.CUSTOM_PROPERTY);
    IntakeForm intakeForm = new IntakeForm().withRequiredFields(List.of(requiredField));

    assertTrue(IntakeFormUtil.removeCustomPropertyField(intakeForm, "steward"));

    assertTrue(intakeForm.getFormFields().isEmpty());
    assertTrue(intakeForm.getRequiredFields().isEmpty());
  }

  @Test
  void removeCustomPropertyFieldSupportsBareLegacyCustomPropertyPaths() {
    IntakeFormField requiredField =
        new IntakeFormField()
            .withFieldPath("steward")
            .withFieldLabel("Steward")
            .withFieldKind(IntakeFormField.FieldKind.CUSTOM_PROPERTY)
            .withRequired(true);
    IntakeForm intakeForm = new IntakeForm().withFormFields(List.of(requiredField));

    assertTrue(IntakeFormUtil.removeCustomPropertyField(intakeForm, "steward"));

    assertTrue(intakeForm.getFormFields().isEmpty());
    assertTrue(intakeForm.getRequiredFields().isEmpty());
  }

  @Test
  void removeCustomPropertyFieldLeavesUnrelatedFieldsUnchanged() {
    IntakeFormField requiredField =
        new IntakeFormField()
            .withFieldPath("extension.steward")
            .withFieldLabel("Steward")
            .withFieldKind(IntakeFormField.FieldKind.CUSTOM_PROPERTY)
            .withRequired(true);
    IntakeForm intakeForm = new IntakeForm().withFormFields(List.of(requiredField));

    assertFalse(IntakeFormUtil.removeCustomPropertyField(intakeForm, "audience"));

    assertEquals(List.of(requiredField), intakeForm.getFormFields());
  }
}
