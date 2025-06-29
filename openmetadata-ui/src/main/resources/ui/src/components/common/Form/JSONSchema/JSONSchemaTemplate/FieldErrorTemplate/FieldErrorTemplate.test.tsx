/*
 *  Copyright 2023 Collate.
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
import { FieldErrorProps } from '@rjsf/utils';
import { render } from '@testing-library/react';
import { FieldErrorTemplate } from './FieldErrorTemplate';

describe('FieldErrorTemplate', () => {
  it('renders error list correctly', () => {
    const errors = ['Error 1', 'Error 2'];
    const schema = { $id: 'schema-id' };
    const idSchema = { $id: 'id-schema-id' };

    const { container } = render(
      <FieldErrorTemplate
        errors={errors}
        idSchema={idSchema as FieldErrorProps['idSchema']}
        registry={{} as FieldErrorProps['registry']}
        schema={schema}
      />
    );

    const errorItems = container.querySelectorAll(
      '.ant-form-item-explain-error'
    );

    expect(errorItems).toHaveLength(errors.length);

    errorItems.forEach((item, index) => {
      expect(item.textContent).toBe(errors[index]);
    });
  });

  it('renders null when errors are empty', () => {
    const errors: string[] = [];
    const schema = { $id: 'schema-id' };
    const idSchema = { $id: 'id-schema-id' };

    const { container } = render(
      <FieldErrorTemplate
        errors={errors}
        idSchema={idSchema as FieldErrorProps['idSchema']}
        registry={{} as FieldErrorProps['registry']}
        schema={schema}
      />
    );

    const errorItems = container.querySelectorAll(
      '.ant-form-item-explain-error'
    );

    expect(errorItems).toHaveLength(0);
  });
});
