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

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.entity.governance.IntakeForm;
import org.openmetadata.schema.entity.governance.IntakeFormField;
import org.openmetadata.schema.entity.governance.IntakeFormRequiredField;

public final class IntakeFormUtil {

  private IntakeFormUtil() {}

  public static List<IntakeFormField> getEffectiveFormFields(IntakeForm form) {
    if (!nullOrEmpty(form.getFormFields()) || nullOrEmpty(form.getRequiredFields())) {
      return new ArrayList<>(listOrEmpty(form.getFormFields()));
    }
    return toFormFields(form.getRequiredFields());
  }

  public static void synchronizeFields(IntakeForm form) {
    List<IntakeFormField> formFields = getEffectiveFormFields(form);
    form.setFormFields(formFields);
    form.setRequiredFields(toRequiredFields(formFields));
  }

  public static boolean removeCustomPropertyField(IntakeForm form, String propertyName) {
    String extensionPath = "extension." + propertyName;
    List<IntakeFormField> formFields = new ArrayList<>(getEffectiveFormFields(form));
    boolean removed =
        formFields.removeIf(
            field ->
                extensionPath.equals(field.getFieldPath())
                    || (IntakeFormField.FieldKind.CUSTOM_PROPERTY.equals(field.getFieldKind())
                        && propertyName.equals(field.getFieldPath())));
    if (removed) {
      form.setFormFields(formFields);
      form.setRequiredFields(toRequiredFields(formFields));
    }
    return removed;
  }

  private static List<IntakeFormField> toFormFields(List<IntakeFormRequiredField> requiredFields) {
    return listOrEmpty(requiredFields).stream()
        .map(
            field ->
                new IntakeFormField()
                    .withFieldPath(field.getFieldPath())
                    .withFieldLabel(field.getFieldLabel())
                    .withFieldKind(
                        field.getFieldKind() == null
                            ? null
                            : IntakeFormField.FieldKind.fromValue(field.getFieldKind().value()))
                    .withRequired(true)
                    .withErrorMessage(field.getErrorMessage()))
        .toList();
  }

  private static List<IntakeFormRequiredField> toRequiredFields(List<IntakeFormField> formFields) {
    return listOrEmpty(formFields).stream()
        .filter(field -> Boolean.TRUE.equals(field.getRequired()))
        .map(
            field ->
                new IntakeFormRequiredField()
                    .withFieldPath(field.getFieldPath())
                    .withFieldLabel(field.getFieldLabel())
                    .withFieldKind(
                        field.getFieldKind() == null
                            ? null
                            : IntakeFormRequiredField.FieldKind.fromValue(
                                field.getFieldKind().value()))
                    .withErrorMessage(field.getErrorMessage()))
        .toList();
  }
}
