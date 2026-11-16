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
import { getAllCustomProperties } from '../../../../rest/metadataTypeAPI';
import { RuleQueryBuilderField } from './RuleQueryBuilderField.component';

// setupTests.js globally stubs `getQbConfigs` to `{}`. This suite renders a real
// builder so RAQB's sanitizer runs against the config the bug depends on.
jest.mock('../../../../utils/AdvancedSearchClassBase', () =>
  jest.requireActual('../../../../utils/AdvancedSearchClassBase')
);

jest.mock('../../../../rest/metadataTypeAPI', () => ({
  ...jest.requireActual('../../../../rest/metadataTypeAPI'),
  getAllCustomProperties: jest.fn(),
}));

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
    (getAllCustomProperties as jest.Mock).mockResolvedValue({});
  });

  it('keeps a saved DSL filter unchanged while the builder initializes', async () => {
    const onChange = jest.fn();
    const onValidityChange = jest.fn();
    const onReconstructionStatusChange = jest.fn();
    render(
      <RuleQueryBuilderField
        entityType={EntityType.TABLE}
        queryFilter={JSON.stringify({
          query: { term: { 'domains.fullyQualifiedName': 'DomainB' } },
        })}
        onChange={onChange}
        onReconstructionStatusChange={onReconstructionStatusChange}
        onValidityChange={onValidityChange}
      />
    );

    await screen.findByTestId('query-builder-form-field');

    expect(onChange).not.toHaveBeenCalled();
    expect(onValidityChange).not.toHaveBeenCalledWith(false);
    expect(onReconstructionStatusChange).toHaveBeenLastCalledWith(false);

    const addCondition = screen.getByTestId('add-context-condition');
    fireEvent.pointerDown(addCondition);
    fireEvent.click(addCondition);

    await waitFor(() => expect(onValidityChange).toHaveBeenCalledWith(false));
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
    (getAllCustomProperties as jest.Mock).mockImplementation(
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
    (getAllCustomProperties as jest.Mock).mockRejectedValue(
      new Error('network error')
    );

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
    (getAllCustomProperties as jest.Mock).mockResolvedValue({
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

  // A non-empty `queryFilter` that the reconstruction cannot parse should still
  // mount the builder, but the editor needs to know so it can warn the user
  // before the first builder edit overwrites the saved DSL.
  it('reports rendered=true for a filter supported by the builder', async () => {
    const onReconstructionStatusChange = jest.fn();
    render(
      <RuleQueryBuilderField
        entityType={EntityType.TABLE}
        queryFilter={JSON.stringify({
          query: {
            bool: {
              must: [{ wildcard: { description: '*orders*' } }],
            },
          },
        })}
        onChange={jest.fn()}
        onReconstructionStatusChange={onReconstructionStatusChange}
      />
    );

    await screen.findByTestId('query-builder-form-field');

    expect(onReconstructionStatusChange).toHaveBeenLastCalledWith(true);
  });

  it('reports rendered=false for an unrenderable queryFilter', async () => {
    const onReconstructionStatusChange = jest.fn();
    render(
      <RuleQueryBuilderField
        entityType={EntityType.TABLE}
        queryFilter={JSON.stringify({ query: { match: { unknown: 'x' } } })}
        onChange={jest.fn()}
        onReconstructionStatusChange={onReconstructionStatusChange}
      />
    );

    await screen.findByTestId('query-builder-form-field');

    expect(onReconstructionStatusChange).toHaveBeenLastCalledWith(false);
  });

  it('reports rendered=false when only part of the queryFilter is shown', async () => {
    const onReconstructionStatusChange = jest.fn();
    render(
      <RuleQueryBuilderField
        entityType={EntityType.TABLE}
        queryFilter={JSON.stringify({
          query: {
            bool: {
              should: [{ term: { name: 'x' } }],
              filter: [{ range: { updatedAt: { gte: 1 } } }],
            },
          },
        })}
        onChange={jest.fn()}
        onReconstructionStatusChange={onReconstructionStatusChange}
      />
    );

    await screen.findByTestId('query-builder-form-field');

    expect(onReconstructionStatusChange).toHaveBeenLastCalledWith(false);
  });

  // RAQB can emit a change on mount; for a partly shown filter that would replace
  // the saved DSL before the user touched the builder.
  it('forwards builder changes for a partly shown filter only after user input', async () => {
    const onChange = jest.fn();
    render(
      <RuleQueryBuilderField
        entityType={EntityType.TABLE}
        queryFilter={JSON.stringify({
          query: {
            bool: {
              should: [{ term: { name: 'x' } }],
              filter: [{ term: { name: 'y' } }],
            },
          },
        })}
        onChange={onChange}
      />
    );

    const addCondition = await screen.findByTestId('add-context-condition');
    fireEvent.click(addCondition);

    expect(onChange).not.toHaveBeenCalled();

    fireEvent.pointerDown(addCondition);
    fireEvent.click(addCondition);

    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it('reports rendered=true when there is no queryFilter', async () => {
    const onReconstructionStatusChange = jest.fn();
    render(
      <RuleQueryBuilderField
        entityType={EntityType.TABLE}
        onChange={jest.fn()}
        onReconstructionStatusChange={onReconstructionStatusChange}
      />
    );

    await screen.findByTestId('query-builder-form-field');

    expect(onReconstructionStatusChange).toHaveBeenLastCalledWith(true);
  });
});
