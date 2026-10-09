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
import { fireEvent, render, screen } from '@testing-library/react';
import SsoArrayField from './SsoArrayField';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const renderField = (props: Partial<FieldProps>) => {
  const onChange = jest.fn();
  render(
    <SsoArrayField
      {...({
        idSchema: {
          $id: 'root/authenticationConfiguration/oidcConfiguration/scope',
        },
        name: 'scope',
        label: 'Scope',
        formContext: {},
        onBlur: jest.fn(),
        registry: {},
        onChange,
        ...props,
      } as unknown as FieldProps)}
    />
  );

  return onChange;
};

describe('SsoArrayField', () => {
  it('edits a space-separated scope string as tags', () => {
    const onChange = renderField({
      schema: { type: 'string' },
      formData: 'openid email',
    });

    expect(screen.getByText('openid')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'profile' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('openid email profile');
  });

  it('passes real arrays through unchanged', () => {
    const onChange = renderField({
      schema: { type: 'array', items: { type: 'string' } },
      formData: ['email'],
    });

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'sub' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(['email', 'sub']);
  });
});
