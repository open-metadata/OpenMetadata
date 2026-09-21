/*
 *  Copyright 2026 Collate.
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
import { HookForm } from '@openmetadata/ui-core-components';
import { forwardRef, useImperativeHandle } from 'react';
import { useForm } from 'react-hook-form';
import { CustomProperty } from '../../../generated/entity/type';
import { IntakeFormField } from '../../../generated/governance/intakeForm';
import { serializeExtensionValue } from '../../../utils/CustomProperty.utils';
import { DomainFormValues } from '../../Domain/AddDomainForm/AddDomainForm.interface';
import AddDomainFormExtensionFields from '../../Domain/AddDomainForm/AddDomainFormExtensionFields';
import { getExtensionPropertyNameFromFormKey } from '../../Domain/AddDomainForm/AddDomainFormExtensionFields.utils';

export interface GlossaryTermIntakeFieldsHandle {
  getExtension: () => Record<string, unknown>;
  validate: () => Promise<boolean>;
}

interface GlossaryTermIntakeFieldsProps {
  customProperties: CustomProperty[];
  formFields: IntakeFormField[];
}

const findCustomPropertyByName = (
  customProperties: CustomProperty[],
  propertyName: string
) => customProperties.find((property) => property.name === propertyName);

/**
 * Renders the intake custom properties for the Glossary Term create modal.
 *
 * The surrounding form is Ant Design, but custom properties are rendered with
 * the shared react-hook-form/UntitledUI field set. The RHF instance is owned
 * here rather than by the parent on purpose: calling `useForm` in the same
 * component that hosts the antd `Form` re-renders that form mid-validation and
 * its required rules silently stop resolving. Keeping it in a child means the
 * parent only holds a ref and never re-renders when these fields change.
 */
const GlossaryTermIntakeFields = forwardRef<
  GlossaryTermIntakeFieldsHandle,
  GlossaryTermIntakeFieldsProps
>(({ customProperties, formFields }, ref) => {
  const form = useForm<DomainFormValues>({
    defaultValues: { extensionFormValues: {} },
  });

  useImperativeHandle(
    ref,
    () => ({
      validate: () => form.trigger(),
      getExtension: () =>
        Object.entries(form.getValues('extensionFormValues') ?? {}).reduce<
          Record<string, unknown>
        >((result, [formKey, rawValue]) => {
          const propertyName = getExtensionPropertyNameFromFormKey(formKey);
          const definition = findCustomPropertyByName(
            customProperties,
            propertyName
          );
          const serializedValue = definition
            ? serializeExtensionValue(definition, rawValue)
            : rawValue;

          if (serializedValue !== undefined) {
            result[propertyName] = serializedValue;
          }

          return result;
        }, {}),
    }),
    [customProperties, form]
  );

  // The section heading and divider come from AddDomainFormExtensionFields, so
  // this only supplies the RHF form element around them.
  return (
    <HookForm
      className="tw:flex tw:flex-col tw:gap-6 m-t-md"
      form={form}
      onSubmit={(event) => event.preventDefault()}>
      <AddDomainFormExtensionFields
        control={form.control}
        customProperties={customProperties}
        formFields={formFields}
      />
    </HookForm>
  );
});

GlossaryTermIntakeFields.displayName = 'GlossaryTermIntakeFields';

export default GlossaryTermIntakeFields;
