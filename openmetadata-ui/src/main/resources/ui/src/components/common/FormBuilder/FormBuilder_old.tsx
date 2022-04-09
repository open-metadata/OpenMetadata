/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 *  Copyright 2021 Collate
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

import { isArray, startCase } from 'lodash';
import { ConfigFormFields } from 'Models';
import React, { Fragment, FunctionComponent } from 'react';
import { errorMsg, requiredField } from '../../../utils/CommonUtils';
import { Field } from '../../Field/Field';

interface Props {
  elemFields: Array<ConfigFormFields>;
  onChange?: (
    e: React.ChangeEvent<{ value: ConfigFormFields['value'] }>,
    field: ConfigFormFields
  ) => void;
}

const FormBuilder: FunctionComponent<Props> = ({
  elemFields,
  onChange,
}: Props) => {
  const handleChange = (
    e: React.ChangeEvent<{ value: ConfigFormFields['value'] }>,
    field: ConfigFormFields
  ) => {
    if (onChange) {
      onChange(e, field);
    }
  };

  const getFieldInput = (field: ConfigFormFields) => {
    switch (typeof field.value) {
      case 'string': {
        return (
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid={field.key}
            defaultValue={field.value}
            id={field.key}
            name={field.key}
            placeholder={field.placeholder}
            readOnly={field.readOnly}
            type={field.secret ? 'password' : 'text'}
            onChange={(e) => handleChange(e, field)}
          />
        );
      }
      case 'number': {
        return (
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid={field.key}
            defaultValue={field.value}
            id={field.key}
            name={field.key}
            placeholder={field.placeholder}
            readOnly={field.readOnly}
            type={field.secret ? 'password' : 'number'}
            onChange={(e) => handleChange(e, field)}
          />
        );
      }
      case 'boolean': {
        return (
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid={field.key}
            defaultChecked={field.value}
            id={field.key}
            name={field.key}
            placeholder={field.placeholder}
            readOnly={field.readOnly}
            type="checkbox"
            onChange={(e) => handleChange(e, field)}
          />
        );
      }
      default: {
        if (isArray(field.value)) {
          return (
            <input
              className="tw-form-inputs tw-px-3 tw-py-1"
              data-testid={field.key}
              defaultValue={field.value.join()}
              id={field.key}
              name={field.key}
              placeholder={field.placeholder}
              readOnly={field.readOnly}
              type={field.secret ? 'password' : 'text'}
              onChange={(e) => handleChange(e, field)}
            />
          );
        }

        return <></>;
      }
    }
  };

  const getFormFields = () => {
    return elemFields.map((field) => {
      const label = `${startCase(field.key)}:`;

      return (
        <Fragment key={field.key}>
          <Field>
            <label className="tw-block tw-form-label" htmlFor={field.key}>
              {field.required ? requiredField(label) : label}
            </label>
            {getFieldInput(field)}
            {field.error && errorMsg(field.error)}
          </Field>
        </Fragment>
      );
    });
  };

  return <>{getFormFields()}</>;
};

export default FormBuilder;
