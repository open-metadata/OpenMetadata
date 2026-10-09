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
import FormBuilderV1 from '../../../../../common/FormBuilderV1/FormBuilderV1';
import SsoFieldTemplate from './SsoFieldTemplate';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const SCHEMA: RJSFSchema = {
  type: 'object',
  properties: {
    clientId: { type: 'string', title: 'Client ID' },
    principalDomain: { type: 'string', title: 'Principal Domain' },
    hiddenField: { type: 'string' },
  },
};

const renderForm = (fieldDocs: Record<string, string>, showHint = true) =>
  render(
    <FieldDocProvider enabled={showHint}>
      <FormBuilderV1
        hideFooter
        formContext={{ fieldDocs }}
        schema={SCHEMA}
        templates={{ FieldTemplate: SsoFieldTemplate }}
        uiSchema={{ hiddenField: { 'ui:widget': 'hidden' } }}
      />
      <FieldDocPopover />
    </FieldDocProvider>
  );

describe('SsoFieldTemplate', () => {
  it('marks deprecated SSO properties with a badge', () => {
    renderForm({});

    expect(
      screen.getByTestId('deprecated-badge-principalDomain')
    ).toHaveTextContent('label.deprecated');
    expect(
      screen.queryByTestId('deprecated-badge-clientId')
    ).not.toBeInTheDocument();
  });

  it('shows the doc mapped to the focused field', async () => {
    renderForm({ clientId: 'The client id from your IdP.' });

    fireEvent.focus(screen.getByRole('textbox', { name: /^Client ID/ }));

    expect(await screen.findByRole('note')).toHaveTextContent(
      'The client id from your IdP.'
    );
  });

  it('registers no doc while hints are off', () => {
    renderForm({ clientId: 'The client id from your IdP.' }, false);

    fireEvent.focus(screen.getByRole('textbox', { name: /^Client ID/ }));

    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(document.querySelector('[data-field-doc]')).toBeNull();
  });

  it('keeps hidden fields out of the layout', () => {
    renderForm({});

    expect(
      screen.queryByRole('textbox', { name: /hidden field/i })
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
  });
});
