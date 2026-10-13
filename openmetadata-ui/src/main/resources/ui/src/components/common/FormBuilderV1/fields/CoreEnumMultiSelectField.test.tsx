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

import { FieldProps } from '@rjsf/utils';
import { render, screen } from '@testing-library/react';
import { ReactElement } from 'react';
import CoreEnumMultiSelectField, {
  ALL_VALUE,
  getNextEnumSelection,
} from './CoreEnumMultiSelectField';

jest.mock('react-i18next', () => {
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

const renderField = (props: Partial<FieldProps>) =>
  render(
    <CoreEnumMultiSelectField
      {...({
        name: 'entities',
        idSchema: { $id: 'root/entities' },
        onChange: jest.fn(),
        schema: {
          type: 'array',
          title: 'Entities',
          items: { type: 'string', enum: ['table', 'topic'] },
        },
        ...props,
      } as FieldProps)}
    />
  );

describe('CoreEnumMultiSelectField', () => {
  it('keeps "all" and specific values mutually exclusive', () => {
    expect(getNextEnumSelection(['table'], ALL_VALUE)).toEqual([ALL_VALUE]);
    expect(getNextEnumSelection([ALL_VALUE], 'table')).toEqual(['table']);
    expect(getNextEnumSelection(['table'], 'topic')).toEqual([
      'table',
      'topic',
    ]);
  });

  it('renders the selected values as chips', () => {
    renderField({ formData: ['table'] });

    expect(screen.getByText('Entities')).toBeInTheDocument();
    expect(screen.getByText('Table')).toBeInTheDocument();
  });

  it('shows a fully expanded selection as the single "All" chip', () => {
    renderField({
      formData: ['table', 'topic'],
      schema: {
        type: 'array',
        title: 'Entities',
        expandAllValue: true,
        items: { type: 'string', enum: ['table', 'topic'] },
      },
    });

    expect(screen.getByText('label.all')).toBeInTheDocument();
    expect(screen.queryByText('Topic')).not.toBeInTheDocument();
  });

  it('is disabled when read-only', () => {
    renderField({ formData: [], readonly: true });

    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('follows a value changed from outside the field', () => {
    const props = {
      name: 'entities',
      idSchema: { $id: 'root/entities' },
      onChange: jest.fn(),
      schema: {
        type: 'array',
        title: 'Entities',
        items: { type: 'string', enum: ['table', 'topic'] },
      },
    } as unknown as FieldProps;
    const field = (formData: string[]): ReactElement => (
      <CoreEnumMultiSelectField {...props} formData={formData} />
    );
    const { rerender } = render(field(['table']));

    expect(screen.getByText('Table')).toBeInTheDocument();

    rerender(field(['topic']));

    expect(screen.getByText('Topic')).toBeInTheDocument();
    expect(screen.queryByText('Table')).not.toBeInTheDocument();
  });
});
