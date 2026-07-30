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

import { Form } from 'antd';
import React, { forwardRef, useImperativeHandle } from 'react';
import { CustomProperty } from '../../../generated/entity/type';
import { IntakeFormField } from '../../../generated/governance/intakeForm';
import AddDomainFormExtensionFields from '../../Domain/AddDomainForm/AddDomainFormExtensionFields';

export interface GlossaryTermIntakeFieldsHandle {
  getExtension: () => Record<string, unknown>;
  validate: () => Promise<boolean>;
}

interface GlossaryTermIntakeFieldsProps {
  customProperties: CustomProperty[];
  formFields: IntakeFormField[];
}

/**
 * Renders custom-property intake fields for the Glossary Term create modal.
 *
 * Owns its own antd Form instance so that calling Form.useForm() in this child
 * does not interfere with the parent antd Form. The parent interacts via an
 * imperative ref (validate + getExtension).
 */
const GlossaryTermIntakeFields = forwardRef<
  GlossaryTermIntakeFieldsHandle,
  GlossaryTermIntakeFieldsProps
>(({ customProperties, formFields }, ref) => {
  const [form] = Form.useForm<{ extension?: Record<string, unknown> }>();

  useImperativeHandle(
    ref,
    () => ({
      validate: () =>
        form
          .validateFields()
          .then(() => true)
          .catch(() => false),
      getExtension: () => {
        const values = form.getFieldsValue();

        return (values.extension as Record<string, unknown>) ?? {};
      },
    }),
    [form]
  );

  return (
    <Form form={form} layout="vertical">
      <AddDomainFormExtensionFields
        customProperties={customProperties}
        formFields={formFields}
      />
    </Form>
  );
});

GlossaryTermIntakeFields.displayName = 'GlossaryTermIntakeFields';

export default GlossaryTermIntakeFields;
