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
import AddGlossary from './AddGlossary.component';
import { GlossaryFormValues } from './AddGlossary.interface';
import { GLOSSARY_FORM_DEFAULTS } from './AddGlossary.utils';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: () => ({
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
      canAddMultipleDomains: true,
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
  jest.fn(({ onTextChange }: { onTextChange: (value: string) => void }) => (
    <textarea
      aria-label="description-editor"
      onChange={(event) => onTextChange(event.target.value)}
    />
  ))
);

jest.mock('../../Tag/TagSelector/TagSelector', () =>
  jest.fn(() => <div data-testid="tag-selector" />)
);

const onSubmit = jest.fn();

const Harness = () => {
  const form = useForm<GlossaryFormValues>({
    defaultValues: GLOSSARY_FORM_DEFAULTS,
  });

  return (
    <>
      <AddGlossary form={form} onSubmit={onSubmit} />
      <button onClick={() => form.handleSubmit(onSubmit)()}>submit</button>
    </>
  );
};

describe('AddGlossary', () => {
  beforeEach(() => {
    onSubmit.mockReset();
  });

  it('renders every glossary field and no configure-glossary side panel', () => {
    render(<Harness />);

    expect(screen.getByTestId('add-glossary-form')).toBeInTheDocument();
    expect(screen.getByLabelText('label.name')).toBeInTheDocument();
    expect(screen.getByLabelText('label.display-name')).toBeInTheDocument();
    expect(screen.getByLabelText('description-editor')).toBeInTheDocument();
    expect(screen.getByTestId('tag-selector')).toBeInTheDocument();
    expect(screen.getByText('label.mutually-exclusive')).toBeInTheDocument();
    expect(screen.getByText('label.owner-plural')).toBeInTheDocument();
    expect(screen.getByText('label.reviewer-plural')).toBeInTheDocument();
    expect(screen.getByText('label.domain-plural')).toBeInTheDocument();
    expect(screen.queryByTestId('right-panel')).not.toBeInTheDocument();
  });

  it('blocks submit until name and description are filled', async () => {
    render(<Harness />);

    fireEvent.click(screen.getByText('submit'));

    expect(await screen.findAllByText('label.field-required')).toHaveLength(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects names that break the entity name pattern', async () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('label.name'), {
      target: { value: 'bad::name' },
    });
    fireEvent.change(screen.getByLabelText('description-editor'), {
      target: { value: 'Description' },
    });
    fireEvent.click(screen.getByText('submit'));

    expect(
      await screen.findByText('message.entity-name-validation')
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the entered values', async () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('label.name'), {
      target: { value: 'Business' },
    });
    fireEvent.change(screen.getByLabelText('description-editor'), {
      target: { value: 'Business terms' },
    });
    fireEvent.click(screen.getByText('submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    expect(onSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        name: 'Business',
        description: 'Business terms',
        mutuallyExclusive: false,
      })
    );
  });

  it('warns about mutual exclusivity only once it is switched on', async () => {
    render(<Harness />);

    expect(screen.queryByTestId('form-item-alert')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch'));

    expect(await screen.findByTestId('form-item-alert')).toHaveTextContent(
      'message.mutually-exclusive-alert'
    );
  });
});
