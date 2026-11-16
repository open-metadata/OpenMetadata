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

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { InheritedPropertyEntry } from '../../../../utils/governance/glossary/GlossaryTermProperties.types';
import { GlossaryTermFormValues } from '../../../Glossary/AddGlossaryTermForm/AddGlossaryTermForm.interface';
import {
  buildGlossaryTermSavePayload,
  GLOSSARY_TERM_FORM_DEFAULTS,
} from '../../../Glossary/AddGlossaryTermForm/AddGlossaryTermForm.utils';
import GlossaryTermPropertiesFormSection from './GlossaryTermPropertiesFormSection';

const inherited = [
  {
    property: {
      name: 'regulatoryScope',
      displayName: 'Regulatory scope',
      datatype: 'enum',
      enumValues: ['GDPR', 'CCPA'],
    },
    declaredBy: { id: 'c', name: 'Customer', type: 'glossaryTerm' },
    values: ['GDPR'],
  },
] as unknown as InheritedPropertyEntry[];

const onSubmit = jest.fn();

const Harness = () => {
  const form = useForm<GlossaryTermFormValues>({
    defaultValues: GLOSSARY_TERM_FORM_DEFAULTS,
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <GlossaryTermPropertiesFormSection
        form={form}
        inheritedProperties={inherited}
      />
      <button data-testid="submit" type="submit">
        submit
      </button>
    </form>
  );
};

describe('GlossaryTermPropertiesFormSection', () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

  beforeEach(() => onSubmit.mockClear());

  it('lists what the term inherits with its source and value', () => {
    render(<Harness />);

    const row = screen.getByTestId('inherited-property-regulatoryScope');

    expect(row).toHaveTextContent('Regulatory scope');
    expect(row).toHaveTextContent('GDPR');
    expect(row).toHaveTextContent('Customer');
    expect(
      screen.getByText('message.glossary-term-properties-create-note')
    ).toBeInTheDocument();
  });

  it('overrides an inherited value inline and sends it as a property value', async () => {
    render(<Harness />);

    await user.click(screen.getByTestId('override-inherited-regulatoryScope'));
    await user.click(
      screen.getByRole('button', { name: /label.value-for-this-term/ })
    );
    await user.click(await screen.findByRole('option', { name: 'CCPA' }));
    await user.click(screen.getByTestId('submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = buildGlossaryTermSavePayload({
      values: {
        ...(onSubmit.mock.calls[0][0] as GlossaryTermFormValues),
        name: 'Phone',
        description: 'd',
      },
      editMode: false,
      inheritedProperties: inherited,
    });

    expect(payload.propertyValues).toEqual({ regulatoryScope: ['CCPA'] });
    expect(payload).not.toHaveProperty('propertyDefinitions');
  });

  it('reverts an override back to the inherited value', async () => {
    render(<Harness />);

    await user.click(screen.getByTestId('override-inherited-regulatoryScope'));
    await user.click(
      screen.getByRole('button', { name: /label.value-for-this-term/ })
    );
    await user.click(await screen.findByRole('option', { name: 'CCPA' }));

    expect(
      within(
        screen.getByTestId('inherited-property-regulatoryScope')
      ).getByText('label.overridden-here')
    ).toBeInTheDocument();

    await user.click(screen.getByTestId('revert-inherited-regulatoryScope'));

    expect(screen.queryByText('label.overridden-here')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('submit'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    expect(
      buildGlossaryTermSavePayload({
        values: {
          ...(onSubmit.mock.calls[0][0] as GlossaryTermFormValues),
          name: 'Phone',
          description: 'd',
        },
        editMode: false,
        inheritedProperties: inherited,
      })
    ).not.toHaveProperty('propertyValues');
  });

  it('submits the declared properties and values as create fields', async () => {
    render(<Harness />);

    await user.click(screen.getByTestId('add-property-row'));
    await user.type(screen.getByTestId('property-name-0'), 'Owner team');
    await user.type(screen.getByTestId('property-value-0'), 'Payments');
    await user.click(screen.getByTestId('submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const values = onSubmit.mock.calls[0][0] as GlossaryTermFormValues;

    expect(
      buildGlossaryTermSavePayload({
        values: { ...values, name: 'Phone', description: 'd' },
        editMode: false,
      })
    ).toEqual(
      expect.objectContaining({
        propertyDefinitions: [
          { name: 'Owner team', displayName: 'Owner team', datatype: 'string' },
        ],
        propertyValues: { 'Owner team': ['Payments'] },
      })
    );
  });

  it('blocks submit when a row repeats an inherited name', async () => {
    render(<Harness />);

    await user.click(screen.getByTestId('add-property-row'));
    await user.type(screen.getByTestId('property-name-0'), 'regulatoryscope');
    await user.click(screen.getByTestId('submit'));

    expect(
      await screen.findByText('message.glossary-term-property-name-exists')
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ignores a row left blank', async () => {
    render(<Harness />);

    await user.click(screen.getByTestId('add-property-row'));
    await user.click(screen.getByTestId('submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    expect(
      buildGlossaryTermSavePayload({
        values: {
          ...(onSubmit.mock.calls[0][0] as GlossaryTermFormValues),
          name: 'Phone',
          description: 'd',
        },
        editMode: false,
      })
    ).not.toHaveProperty('propertyDefinitions');
  });
});
