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

import { RJSFSchema } from '@rjsf/utils';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../../../../../generated/entity/applications/app';
import AppConfigForm, { HintToggle } from './AppConfigForm';

jest.mock('react-i18next', () => {
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

jest.mock('../../../../../../utils/i18next/LocalUtil', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
  t: (key: string) => key,
}));

jest.mock(
  '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1',
  () => jest.fn(({ markdown }: { markdown: string }) => <p>{markdown}</p>)
);

jest.mock('../platform-settings/useFormFieldDocs', () => ({
  useFormFieldDocs: jest.fn(() => ({ active: 'Turn the workflow on.' })),
}));

const schema: RJSFSchema = {
  type: 'object',
  properties: {
    active: {
      type: 'boolean',
      title: 'Active',
      description: 'Whether the workflow runs.',
    },
  },
};

const appData = {
  name: 'AutoPilotApplication',
  appConfiguration: { active: false },
} as unknown as App;

const onSave = jest.fn();
const onCancel = jest.fn();

const renderForm = (showHint = false) =>
  render(
    <AppConfigForm
      appData={appData}
      isSaving={false}
      jsonSchema={schema}
      showHint={showHint}
      submitLabel="label.save"
      onCancel={onCancel}
      onSave={onSave}
    />
  );

describe('AppConfigForm', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders a boolean as a toggle card with core-ui only', () => {
    const { container } = renderForm();
    const card = screen.getByTestId('toggle-card-active');

    expect(card).toHaveTextContent('Active');
    expect(card).toHaveTextContent('Whether the workflow runs.');
    expect(screen.getByRole('switch')).not.toBeChecked();
    expect(container.querySelector('[class*="ant-"]')).toBeNull();
  });

  it('submits the edited configuration from the footer', async () => {
    renderForm();

    fireEvent.click(screen.getByRole('switch'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(onSave).toHaveBeenCalledWith({ formData: { active: true } });
  });

  it('calls onCancel from the footer', () => {
    renderForm();

    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(onCancel).toHaveBeenCalled();
  });

  it('registers field hints only while hints are shown', () => {
    const { container, unmount } = renderForm(false);

    expect(container.querySelector('[data-field-doc]')).toBeNull();

    unmount();
    const { container: withHints } = renderForm(true);

    expect(
      withHints.querySelector('[data-field-doc="root/active"]')
    ).toBeInTheDocument();
  });

  it('renders the hint toggle', () => {
    const onChange = jest.fn();
    render(<HintToggle isSelected={false} onChange={onChange} />);

    fireEvent.click(screen.getByTestId('show-hint-toggle'));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders read-only without footer actions', () => {
    render(
      <AppConfigForm
        isReadOnly
        appData={appData}
        isSaving={false}
        jsonSchema={schema}
        showHint={false}
        submitLabel="label.save"
        onCancel={onCancel}
        onSave={onSave}
      />
    );

    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.queryByTestId('save-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cancel-button')).not.toBeInTheDocument();
  });
});
