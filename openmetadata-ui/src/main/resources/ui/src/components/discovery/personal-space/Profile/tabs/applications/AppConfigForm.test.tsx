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

jest.mock('../../../../../../hooks/useFormFieldDocs', () => ({
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

  it('asks before Cancel drops an edit, and not once the edit is saved', async () => {
    const { rerender } = renderForm();
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(onCancel).not.toHaveBeenCalled();
    expect(
      await screen.findByTestId('unsaved-changes-popover')
    ).toBeInTheDocument();

    // The host refreshes the app after a save, which moves the baseline.
    rerender(
      <AppConfigForm
        appData={{ ...appData, appConfiguration: { active: true } } as App}
        isSaving={false}
        jsonSchema={schema}
        showHint={false}
        submitLabel="label.save"
        onCancel={onCancel}
        onSave={onSave}
      />
    );
    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(onCancel).toHaveBeenCalled();
  });

  // A stored appConfiguration can carry keys the current schema no longer
  // knows about (schema upgrades, hand-written JSON_REMOVE migrations only
  // cover some apps). With `omitExtraData` and no `liveOmit`, RJSF prunes
  // those keys on submit but keeps them in change events, so the dirty
  // snapshot must re-sync to the refreshed baseline after a save or the
  // form reads as dirty immediately after a successful save.
  const strictSchema: RJSFSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      active: {
        type: 'boolean',
        title: 'Active',
        description: 'Whether the workflow runs.',
      },
    },
  };
  const legacyAppData = {
    name: 'AutoPilotApplication',
    appConfiguration: { active: false, legacyKey: 'x' },
  } as unknown as App;

  const renderLegacyForm = () =>
    render(
      <AppConfigForm
        appData={legacyAppData}
        isSaving={false}
        jsonSchema={strictSchema}
        showHint={false}
        submitLabel="label.save"
        onCancel={onCancel}
        onSave={onSave}
      />
    );

  it('stays clean on mount when the stored config carries a schema-unknown key', () => {
    renderLegacyForm();

    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(onCancel).toHaveBeenCalled();
    expect(
      screen.queryByTestId('unsaved-changes-popover')
    ).not.toBeInTheDocument();
  });

  it('stays clean after a reverted edit when the stored config carries a schema-unknown key', () => {
    renderLegacyForm();

    // Edit active: false -> true, then revert true -> false.
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(onCancel).toHaveBeenCalled();
    expect(
      screen.queryByTestId('unsaved-changes-popover')
    ).not.toBeInTheDocument();
  });

  it('reads clean after a save when the stored config carried a schema-unknown key', async () => {
    const { rerender } = renderLegacyForm();

    fireEvent.click(screen.getByRole('switch'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    // RJSF prunes the schema-unknown key from the submit payload.
    expect(onSave).toHaveBeenCalledWith({ formData: { active: true } });

    // The host refreshes the app with the pruned config (AppDetails
    // setAppData(response) on a successful patchApplication).
    rerender(
      <AppConfigForm
        appData={
          { ...legacyAppData, appConfiguration: { active: true } } as App
        }
        isSaving={false}
        jsonSchema={strictSchema}
        showHint={false}
        submitLabel="label.save"
        onCancel={onCancel}
        onSave={onSave}
      />
    );
    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(onCancel).toHaveBeenCalled();
    expect(
      screen.queryByTestId('unsaved-changes-popover')
    ).not.toBeInTheDocument();
  });

  it('stays dirty after a failed save, so the user does not lose their edit silently', async () => {
    // A failed patchApplication is caught inside the host's `onSave`
    // (AppDetails onConfigSave try/catch), which resolves without calling
    // setAppData(response). The saved `appConfiguration` reference is
    // unchanged on the next render, so the useEffect that resets the live
    // snapshot does not fire and the form must still report the user's edit
    // as unsaved.
    const resolvedButNoPersistSave = jest.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <AppConfigForm
        appData={appData}
        isSaving={false}
        jsonSchema={schema}
        showHint={false}
        submitLabel="label.save"
        onCancel={onCancel}
        onSave={resolvedButNoPersistSave}
      />
    );
    fireEvent.click(screen.getByRole('switch'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(resolvedButNoPersistSave).toHaveBeenCalled();

    // Host leaves appData unchanged after the failure (no setAppData).
    rerender(
      <AppConfigForm
        appData={appData}
        isSaving={false}
        jsonSchema={schema}
        showHint={false}
        submitLabel="label.save"
        onCancel={onCancel}
        onSave={resolvedButNoPersistSave}
      />
    );
    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(onCancel).not.toHaveBeenCalled();
    expect(
      await screen.findByTestId('unsaved-changes-popover')
    ).toBeInTheDocument();
  });

  it('keeps an unsaved edit when the schema changes without a save', async () => {
    // e.g. MCP tool names load after settings and reshape the schema.
    const { rerender } = renderLegacyForm();
    fireEvent.click(screen.getByRole('switch'));

    rerender(
      <AppConfigForm
        appData={legacyAppData}
        isSaving={false}
        jsonSchema={{
          ...strictSchema,
          properties: {
            ...strictSchema.properties,
            tools: { type: 'array', items: { type: 'string' } },
          },
        }}
        showHint={false}
        submitLabel="label.save"
        onCancel={onCancel}
        onSave={onSave}
      />
    );
    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(onCancel).not.toHaveBeenCalled();
    expect(
      await screen.findByTestId('unsaved-changes-popover')
    ).toBeInTheDocument();
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
