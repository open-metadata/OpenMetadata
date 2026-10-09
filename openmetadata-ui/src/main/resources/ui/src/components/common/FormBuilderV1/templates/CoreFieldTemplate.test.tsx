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
import {
  FieldDocPopover,
  FieldDocProvider,
} from '@openmetadata/ui-core-components';
import { RJSFSchema } from '@rjsf/utils';
import { fireEvent, render, screen } from '@testing-library/react';
import FormBuilderV1 from '../FormBuilderV1';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// `deprecated` is JSON Schema 2019-09; RJSF's draft-07 type does not name it.
const SCHEMA = {
  type: 'object',
  properties: {
    clientId: { type: 'string', title: 'Client ID' },
    principalDomain: {
      type: 'string',
      title: 'Principal Domain',
      deprecated: true,
    },
  },
} as RJSFSchema;

const renderForm = (fieldDocs?: Record<string, string>, showHint = true) =>
  render(
    <FieldDocProvider enabled={showHint}>
      <FormBuilderV1 hideFooter fieldDocs={fieldDocs} schema={SCHEMA} />
      <FieldDocPopover />
    </FieldDocProvider>
  );

describe('CoreFieldTemplate', () => {
  it('marks fields the schema deprecates', () => {
    renderForm();

    expect(
      screen.getByTestId('deprecated-badge-principalDomain')
    ).toHaveTextContent('label.deprecated');
    expect(
      screen.queryByTestId('deprecated-badge-clientId')
    ).not.toBeInTheDocument();
  });

  it('shows the focused field doc when the form passes field docs', async () => {
    renderForm({ clientId: 'The client id from your IdP.' });

    fireEvent.focus(screen.getByRole('textbox', { name: /^Client ID/ }));

    expect(await screen.findByRole('note')).toHaveTextContent(
      'The client id from your IdP.'
    );
  });

  it('picks up docs that arrive after the first render', async () => {
    const { rerender } = renderForm();
    rerender(
      <FieldDocProvider enabled>
        <FormBuilderV1
          hideFooter
          fieldDocs={{ clientId: 'Loaded later.' }}
          schema={SCHEMA}
        />
        <FieldDocPopover />
      </FieldDocProvider>
    );

    fireEvent.focus(screen.getByRole('textbox', { name: /^Client ID/ }));

    expect(await screen.findByRole('note')).toHaveTextContent('Loaded later.');
  });

  it('adds nothing for forms without field docs', () => {
    renderForm();

    fireEvent.focus(screen.getByRole('textbox', { name: /^Client ID/ }));

    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(document.querySelector('[data-field-doc]')).toBeNull();
  });

  it('registers no doc while hints are off', () => {
    renderForm({ clientId: 'The client id.' }, false);

    fireEvent.focus(screen.getByRole('textbox', { name: /^Client ID/ }));

    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
