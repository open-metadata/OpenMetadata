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

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTranslation } from 'react-i18next';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import { MOCK_PERMISSIONS } from '../../../../mocks/Glossary.mock';
import {
  getGlossaryTermPropertyImpact,
  patchGlossaryTerm,
} from '../../../../rest/glossaryAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import GlossaryTermProperties from './GlossaryTermProperties';

const mockContext = {
  data: {} as GlossaryTerm,
  onUpdate: jest.fn(),
  isVersionView: false,
  permissions: MOCK_PERMISSIONS,
};

jest.mock('../../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn().mockImplementation(() => mockContext),
}));

jest.mock('../../../../rest/glossaryAPI', () => ({
  getGlossaryTermPropertyImpact: jest.fn(),
  getGlossaryTermsById: jest.fn(),
  patchGlossaryTerm: jest.fn().mockResolvedValue({}),
}));

const ref = (id: string, name: string) => ({ id, name, type: 'glossaryTerm' });

const customer = ref('customer-id', 'Customer');
const phone = ref('phone-id', 'Phone');

const owner = {
  name: 'ownerTeam',
  displayName: 'Owner team',
  datatype: 'string',
};
const scope = {
  name: 'regulatoryScope',
  displayName: 'Regulatory scope',
  datatype: 'enum',
  enumValues: ['GDPR', 'CCPA'],
};
const retention = {
  name: 'retentionDays',
  datatype: 'decimal',
  unit: 'days',
};

const phoneTerm = {
  id: 'phone-id',
  name: 'Phone',
  fullyQualifiedName: 'Data.Customer.Phone',
  childrenCount: 2,
  propertyDefinitions: [retention],
  propertyValues: { retentionDays: ['365'], regulatoryScope: ['CCPA'] },
  effectiveProperties: [
    {
      property: retention,
      declaredBy: phone,
      inherited: false,
      values: ['365'],
      valuesFrom: phone,
    },
    {
      property: scope,
      declaredBy: customer,
      inherited: true,
      values: ['CCPA'],
      valuesFrom: phone,
    },
    {
      property: owner,
      declaredBy: customer,
      inherited: true,
      values: ['Payments'],
      valuesFrom: customer,
    },
  ],
} as unknown as GlossaryTerm;

const renderProperties = (term: GlossaryTerm = phoneTerm) => {
  mockContext.data = term;

  return renderWithQueryClient(<GlossaryTermProperties />);
};

const row = (name: string) =>
  within(screen.getByTestId(`glossary-term-property-${name}`));

describe('GlossaryTermProperties', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContext.permissions = MOCK_PERMISSIONS;
    mockContext.isVersionView = false;
  });

  it('shows each property with its type, value and where the value comes from', () => {
    renderProperties();

    expect(row('retentionDays').getByText('365 days')).toBeInTheDocument();
    expect(
      row('retentionDays').getByText('label.defined-here')
    ).toBeInTheDocument();
    expect(
      row('regulatoryScope').getByText('Regulatory scope')
    ).toBeInTheDocument();
    expect(row('regulatoryScope').getByText('CCPA')).toBeInTheDocument();
    expect(row('regulatoryScope').getByText('Customer')).toBeInTheDocument();
    expect(
      row('regulatoryScope').getByText('label.overridden-here')
    ).toBeInTheDocument();
    expect(row('ownerTeam').getByText('Payments')).toBeInTheDocument();
    expect(row('ownerTeam').getByText('Customer')).toBeInTheDocument();
    expect(
      row('ownerTeam').queryByText('label.overridden-here')
    ).not.toBeInTheDocument();
  });

  it('shows the type as plain text and the declaring term as a source badge', () => {
    renderProperties();

    expect(row('retentionDays').getByText('label.number')).toBeInTheDocument();
    expect(row('regulatoryScope').getByText('label.enum')).toBeInTheDocument();
    expect(
      screen.getByTestId('glossary-term-properties-count')
    ).toHaveTextContent('3');
  });

  it('renders a URL value as a link and ignores non-http schemes', () => {
    const link = {
      name: 'runbook',
      displayName: 'Runbook',
      datatype: 'url',
    };
    renderProperties({
      ...phoneTerm,
      effectiveProperties: [
        {
          property: link,
          declaredBy: phone,
          inherited: false,
          values: ['https://wiki.acme.com/runbook'],
          valuesFrom: phone,
        },
        {
          property: { ...link, name: 'unsafe', displayName: 'Unsafe' },
          declaredBy: phone,
          inherited: false,
          values: ['javascript:alert(1)'],
          valuesFrom: phone,
        },
      ],
    } as unknown as GlossaryTerm);

    expect(
      screen.getByRole('link', { name: 'https://wiki.acme.com/runbook' })
    ).toHaveAttribute('href', 'https://wiki.acme.com/runbook');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('picks a type card with the keyboard', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderProperties();

    await user.click(screen.getByTestId('add-property-button'));
    const group = screen.getByRole('radiogroup', { name: 'label.type' });

    expect(within(group).getAllByRole('radio')).toHaveLength(6);
    expect(
      within(group).getByRole('radio', { name: 'label.text' })
    ).toBeChecked();

    await user.click(within(group).getByRole('radio', { name: 'label.text' }));
    await user.keyboard('{ArrowRight}');

    expect(
      within(group).getByRole('radio', { name: 'label.number' })
    ).toBeChecked();
    expect(screen.getByTestId('property-type-note')).toHaveTextContent(
      'message.glossary-term-property-type-locked-note'
    );
  });

  it('summarizes own, inherited and child term counts', () => {
    (useTranslation as jest.Mock).mockReturnValueOnce({
      t: (key: string, options?: Record<string, unknown>) =>
        `${key}${options ? JSON.stringify(options) : ''}`,
    });
    renderProperties();

    expect(
      screen.getByTestId('glossary-term-properties-summary')
    ).toHaveTextContent(
      'message.glossary-term-properties-summary{"own":1,"inherited":2} · message.child-terms-inherit-these{"count":2}'
    );
  });

  it('shows the empty state when the term has no properties', () => {
    renderProperties({ ...phoneTerm, effectiveProperties: [] });

    expect(
      screen.getByText('message.glossary-term-properties-empty')
    ).toBeInTheDocument();
  });

  it('offers edit and delete on an own property, override on an inherited one, reset only when overridden here', () => {
    renderProperties();

    expect(
      screen.getByTestId('edit-property-retentionDays')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('delete-property-retentionDays')
    ).toBeInTheDocument();
    expect(screen.getByTestId('edit-property-ownerTeam')).toBeInTheDocument();
    expect(
      screen.queryByTestId('delete-property-ownerTeam')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('reset-property-ownerTeam')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('reset-property-regulatoryScope')
    ).toBeInTheDocument();
  });

  it('is read-only without edit permission', () => {
    mockContext.permissions = { ...MOCK_PERMISSIONS, EditAll: false };
    renderProperties();

    expect(row('retentionDays').getByText('365 days')).toBeInTheDocument();
    expect(screen.queryByTestId('add-property-button')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('edit-property-retentionDays')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('delete-property-retentionDays')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('reset-property-regulatoryScope')
    ).not.toBeInTheDocument();
  });

  it('allows editing with only the property operation granted', () => {
    mockContext.permissions = {
      ...MOCK_PERMISSIONS,
      EditAll: false,
      EditGlossaryTermProperties: true,
    };
    renderProperties();

    expect(screen.getByTestId('add-property-button')).toBeInTheDocument();
    expect(
      screen.getByTestId('edit-property-retentionDays')
    ).toBeInTheDocument();
  });

  it('is read-only in version view', () => {
    mockContext.isVersionView = true;
    renderProperties();

    expect(screen.queryByTestId('add-property-button')).not.toBeInTheDocument();
  });

  it('resets an overridden value by removing this term own entry', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderProperties();

    await user.click(screen.getByTestId('reset-property-regulatoryScope'));

    await waitFor(() =>
      expect(patchGlossaryTerm).toHaveBeenCalledWith('phone-id', [
        { op: 'remove', path: '/propertyValues/regulatoryScope' },
      ])
    );
  });

  it('overrides an inherited value for this term only', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderProperties();

    await user.click(screen.getByTestId('edit-property-ownerTeam'));
    const input = screen.getByTestId('property-value-input');

    expect(input).toHaveValue('Payments');

    await user.clear(input);
    await user.type(input, 'Risk');
    await user.click(screen.getByTestId('property-save'));

    await waitFor(() =>
      expect(patchGlossaryTerm).toHaveBeenCalledWith('phone-id', [
        { op: 'add', path: '/propertyValues/ownerTeam', value: ['Risk'] },
      ])
    );
  });

  it('adds a property whose name is derived from the label', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderProperties();

    await user.click(screen.getByTestId('add-property-button'));
    await user.type(screen.getByTestId('property-name-input'), 'Data steward');
    await user.type(screen.getByTestId('property-value-input'), 'Alex');
    await user.click(screen.getByTestId('property-save'));

    await waitFor(() =>
      expect(patchGlossaryTerm).toHaveBeenCalledWith('phone-id', [
        {
          op: 'add',
          path: '/propertyDefinitions/-',
          value: {
            name: 'Data steward',
            displayName: 'Data steward',
            datatype: 'string',
          },
        },
        { op: 'add', path: '/propertyValues/Data steward', value: ['Alex'] },
      ])
    );
  });

  it('refuses a name an inherited property already uses without calling the server', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderProperties();

    await user.click(screen.getByTestId('add-property-button'));
    await user.type(screen.getByTestId('property-name-input'), 'OWNERteam');
    await user.click(screen.getByTestId('property-save'));

    expect(
      await screen.findByText('message.glossary-term-property-name-exists')
    ).toBeInTheDocument();
    expect(patchGlossaryTerm).not.toHaveBeenCalled();
  });

  it('locks the type when editing and sends only the changed label', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderProperties();

    await user.click(screen.getByTestId('edit-property-retentionDays'));

    expect(
      within(screen.getByTestId('property-type-locked')).getByRole('radio', {
        name: 'label.number',
      })
    ).toBeChecked();
    expect(
      within(screen.getByTestId('property-type-locked')).getByRole('radio', {
        name: 'label.text',
      })
    ).toBeDisabled();

    const nameInput = screen.getByTestId('property-name-input');
    await user.clear(nameInput);
    await user.type(nameInput, 'Retention');
    await user.click(screen.getByTestId('property-save'));

    await waitFor(() =>
      expect(patchGlossaryTerm).toHaveBeenCalledWith('phone-id', [
        {
          op: 'test',
          path: '/propertyDefinitions/0/name',
          value: 'retentionDays',
        },
        {
          op: 'add',
          path: '/propertyDefinitions/0/displayName',
          value: 'Retention',
        },
      ])
    );
  });

  it('asks the server what a delete removes below, then deletes behind a name guard', async () => {
    (getGlossaryTermPropertyImpact as jest.Mock).mockResolvedValue({
      termsWithEntries: 2,
      sample: [
        {
          id: 'a',
          type: 'glossaryTerm',
          fullyQualifiedName: 'Data.Customer.Phone.Mobile',
        },
      ],
    });
    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string, options?: Record<string, unknown>) =>
        `${key}${options ? JSON.stringify(options) : ''}`,
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderProperties();

    await user.click(screen.getByTestId('delete-property-retentionDays'));

    expect(getGlossaryTermPropertyImpact).toHaveBeenCalledWith(
      'phone-id',
      'retentionDays'
    );
    expect(
      await screen.findByText(
        'message.glossary-term-property-delete-impact{"count":2,"terms":"Data.Customer.Phone.Mobile"}'
      )
    ).toBeInTheDocument();

    await user.click(screen.getByTestId('confirm-button'));

    await waitFor(() =>
      expect(patchGlossaryTerm).toHaveBeenCalledWith('phone-id', [
        {
          op: 'test',
          path: '/propertyDefinitions/0/name',
          value: 'retentionDays',
        },
        { op: 'remove', path: '/propertyValues/retentionDays' },
        { op: 'remove', path: '/propertyDefinitions/0' },
      ])
    );
  });
});
