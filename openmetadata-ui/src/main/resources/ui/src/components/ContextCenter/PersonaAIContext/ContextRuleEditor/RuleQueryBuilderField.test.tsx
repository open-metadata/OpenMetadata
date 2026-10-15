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
import { EntityType } from '../../../../enums/entity.enum';
import * as metadataTypeAPI from '../../../../rest/metadataTypeAPI';
import { RuleQueryBuilderField } from './RuleQueryBuilderField.component';

// setupTests.js globally stubs `getQbConfigs` to `{}`. This suite renders a real
// builder so RAQB's sanitizer runs against the config the bug depends on.
jest.mock('../../../../utils/AdvancedSearchClassBase', () =>
  jest.requireActual('../../../../utils/AdvancedSearchClassBase')
);

jest.mock('../../../../rest/searchAPI', () => ({ searchQuery: jest.fn() }));

jest.mock('../../../../utils/RouterUtils', () => ({
  getExplorePath: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const CUSTOM_PROPERTY_FIELD = 'extension.business_domain.keyword';

const savedTreeWithCustomProperty = JSON.stringify({
  id: 'root',
  type: 'group',
  properties: { conjunction: 'AND', not: false },
  children1: {
    r1: {
      type: 'rule',
      id: 'r1',
      properties: {
        field: CUSTOM_PROPERTY_FIELD,
        operator: 'select_equals',
        value: ['Finance'],
        valueSrc: ['value'],
      },
    },
  },
});

describe('RuleQueryBuilderField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(metadataTypeAPI, 'getAllCustomProperties').mockResolvedValue({});
  });

  it('should serialise query tree changes', async () => {
    const onChange = jest.fn();
    render(
      <RuleQueryBuilderField
        entityType={EntityType.TABLE}
        onChange={onChange}
      />
    );

    fireEvent.click(await screen.findByTestId('add-context-condition'));

    await waitFor(() => expect(onChange).toHaveBeenCalled());

    expect(typeof onChange.mock.calls.at(-1)?.[1]).toBe('string');
  });

  it('should hide mutation controls when readonly', async () => {
    render(
      <RuleQueryBuilderField
        readonly
        entityType={EntityType.TABLE}
        onChange={jest.fn()}
      />
    );

    await screen.findByTestId('query-builder-form-field');

    expect(
      screen.queryByTestId('add-context-condition')
    ).not.toBeInTheDocument();
  });

  it('should show a loader until the custom properties resolve', async () => {
    let resolveCustomProps: (value: unknown) => void = jest.fn();
    jest.spyOn(metadataTypeAPI, 'getAllCustomProperties').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCustomProps = resolve as typeof resolveCustomProps;
        })
    );

    render(
      <RuleQueryBuilderField
        entityType={EntityType.TABLE}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('loader')).toBeInTheDocument();

    resolveCustomProps({});

    await screen.findByTestId('query-builder-form-field');
  });

  it('should still mount when getAllCustomProperties rejects', async () => {
    jest
      .spyOn(metadataTypeAPI, 'getAllCustomProperties')
      .mockRejectedValue(new Error('network error'));

    render(
      <RuleQueryBuilderField
        entityType={EntityType.TABLE}
        onChange={jest.fn()}
      />
    );

    expect(await screen.findByTestId('query-builder-form-field')).toBeVisible();
  });

  // Issue #34445: mounting before the custom properties arrive let RAQB's sanitizer
  // field-null the saved extension rule, dropping the condition on the next change.
  it('should keep a custom-property condition across an edit', async () => {
    jest.spyOn(metadataTypeAPI, 'getAllCustomProperties').mockResolvedValue({
      table: [{ name: 'business_domain', type: 'string' }],
    } as never);
    const onChange = jest.fn();

    render(
      <RuleQueryBuilderField
        entityType={EntityType.TABLE}
        filterJsonTree={savedTreeWithCustomProperty}
        onChange={onChange}
      />
    );

    fireEvent.click(await screen.findByTestId('add-context-condition'));

    await waitFor(() => expect(onChange).toHaveBeenCalled());

    expect(onChange.mock.calls.at(-1)?.[1]).toContain(CUSTOM_PROPERTY_FIELD);
  });
});
