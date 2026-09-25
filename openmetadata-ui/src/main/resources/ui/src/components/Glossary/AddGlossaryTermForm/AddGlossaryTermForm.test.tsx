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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { IntakeFormField } from '../../../generated/governance/intakeForm';
import { GlossaryTermIntakeFormState } from '../hooks/useGlossaryTermIntakeForm';
import AddGlossaryTermForm from './AddGlossaryTermForm.component';
import { GlossaryTermFormValues } from './AddGlossaryTermForm.interface';
import { GLOSSARY_TERM_FORM_DEFAULTS } from './AddGlossaryTermForm.utils';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: () => ({
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
    },
  }),
}));

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({ hits: { hits: [] } }),
}));

jest.mock('../../../rest/domainAPI', () => ({
  searchDomains: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../common/RichTextEditor/RichTextEditor', () =>
  jest.fn(
    ({
      initialValue,
      onTextChange,
    }: {
      initialValue?: string;
      onTextChange: (value: string) => void;
    }) => (
      <textarea
        aria-label="description-editor"
        defaultValue={initialValue}
        onChange={(event) => onTextChange(event.target.value)}
      />
    )
  )
);

jest.mock('../../Tag/TagSelector/TagSelector', () =>
  jest.fn(() => <div data-testid="tag-selector" />)
);

jest.mock('../../common/GlossaryTermPicker/GlossaryTermPicker', () =>
  jest.fn(() => <div data-testid="related-terms" />)
);

jest.mock('../../Domain/AddDomainForm/AddDomainFormExtensionFields', () =>
  jest.fn(() => <div data-testid="extension-fields" />)
);

const onSubmit = jest.fn();

const NO_INTAKE: GlossaryTermIntakeFormState = {
  customProperties: [],
  extensionFormFields: [],
  isLoaded: true,
  requiredNativeFields: new Map(),
};

const Harness = ({
  editMode = false,
  intake = NO_INTAKE,
  defaultValues = GLOSSARY_TERM_FORM_DEFAULTS,
}: {
  editMode?: boolean;
  intake?: GlossaryTermIntakeFormState;
  defaultValues?: GlossaryTermFormValues;
}) => {
  const form = useForm<GlossaryTermFormValues>({ defaultValues });

  return (
    <>
      <AddGlossaryTermForm
        editMode={editMode}
        form={form}
        intake={intake}
        onSubmit={onSubmit}
      />
      <button onClick={() => form.handleSubmit(onSubmit)()}>submit</button>
    </>
  );
};

const fillRequired = () => {
  fireEvent.change(screen.getByLabelText('label.name'), {
    target: { value: 'Revenue' },
  });
  fireEvent.change(screen.getByLabelText('description-editor'), {
    target: { value: 'Money in' },
  });
};

describe('AddGlossaryTermForm', () => {
  beforeEach(() => {
    onSubmit.mockReset();
  });

  it('renders the term fields', () => {
    render(<Harness />);

    expect(screen.getByLabelText('label.name')).toBeInTheDocument();
    expect(screen.getByLabelText('label.display-name')).toBeInTheDocument();
    expect(screen.getByTestId('tag-selector')).toBeInTheDocument();
    expect(screen.getByTestId('related-terms')).toBeInTheDocument();
    expect(screen.getByText('label.synonym-plural')).toBeInTheDocument();
    expect(screen.getByText('label.icon')).toBeInTheDocument();
    expect(screen.getByText('label.color')).toBeInTheDocument();
    expect(screen.getByText('label.reference-plural')).toBeInTheDocument();
    expect(screen.getByText('label.owner-plural')).toBeInTheDocument();
    expect(screen.getByText('label.reviewer-plural')).toBeInTheDocument();
  });

  it('seeds the description editor from the form defaults', () => {
    render(
      <Harness
        editMode
        defaultValues={{
          ...GLOSSARY_TERM_FORM_DEFAULTS,
          name: 'Revenue',
          description: 'Existing description',
        }}
      />
    );

    expect(screen.getByLabelText('description-editor')).toHaveValue(
      'Existing description'
    );
    expect(screen.getByLabelText('label.name')).toHaveValue('Revenue');
  });

  it('adds, validates and removes references', async () => {
    render(<Harness />);
    fillRequired();

    fireEvent.click(screen.getByTestId('add-reference'));
    fireEvent.change(screen.getAllByLabelText('label.endpoint')[0], {
      target: { value: 'ftp://wiki' },
    });
    fireEvent.click(screen.getByText('submit'));

    expect(
      await screen.findByText('message.field-text-is-required')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.url-must-start-with-http-or-https')
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('remove-reference-0'));
    fireEvent.click(screen.getByText('submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    expect(onSubmit.mock.calls[0][0].references).toEqual([]);
  });

  it('submits entered references', async () => {
    render(<Harness />);
    fillRequired();

    fireEvent.click(screen.getByTestId('add-reference'));
    fireEvent.change(screen.getAllByLabelText('label.name')[1], {
      target: { value: 'Wiki' },
    });
    fireEvent.change(screen.getAllByLabelText('label.endpoint')[0], {
      target: { value: 'https://wiki' },
    });
    fireEvent.click(screen.getByText('submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    expect(onSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        name: 'Revenue',
        description: 'Money in',
        references: [{ name: 'Wiki', endpoint: 'https://wiki' }],
      })
    );
  });

  it('enforces native fields the intake form makes required', async () => {
    render(
      <Harness
        intake={{
          ...NO_INTAKE,
          requiredNativeFields: new Map([
            [
              'displayName',
              {
                fieldPath: 'displayName',
                errorMessage: 'Display name is mandatory',
              } as IntakeFormField,
            ],
          ]),
        }}
      />
    );
    fillRequired();

    fireEvent.click(screen.getByText('submit'));

    expect(
      await screen.findByText('Display name is mandatory')
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders intake custom properties on create only', () => {
    const { rerender } = render(<Harness />);

    expect(screen.getByTestId('extension-fields')).toBeInTheDocument();

    rerender(<Harness editMode />);

    expect(screen.queryByTestId('extension-fields')).not.toBeInTheDocument();
  });
});
