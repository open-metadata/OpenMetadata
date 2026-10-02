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

const mockAddRule = jest.fn();
const mockQueryActions = { addRule: mockAddRule };

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../common/QueryBuilder/QueryBuilder', () => {
  const MockQueryBuilderWidget = ({
    onActionsReady,
    onChange,
    fields,
  }: {
    onActionsReady?: (actions: { addRule: typeof mockAddRule }) => void;
    onChange?: (value: string, tree: Record<string, string>) => void;
    fields?: unknown;
  }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(() => {
      onActionsReady?.(mockQueryActions);
    }, [onActionsReady]);

    return (
      <div
        data-fields-defined={String(Boolean(fields))}
        data-testid="query-builder-mounted">
        <button
          data-testid="emit-query-change"
          onClick={() => onChange?.('{"query":{}}', { id: 'tree' })}>
          change
        </button>
      </div>
    );
  };

  return { __esModule: true, default: MockQueryBuilderWidget };
});

describe('RuleQueryBuilderField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(metadataTypeAPI, 'getAllCustomProperties').mockResolvedValue({});
  });

  it('exposes add condition and serializes query tree changes', async () => {
    const onChange = jest.fn();
    render(
      <RuleQueryBuilderField
        entityType={EntityType.TABLE}
        onChange={onChange}
      />
    );

    // Wait for QueryBuilder to mount after custom properties resolve.
    const button = await screen.findByTestId('emit-query-change');
    fireEvent.click(button);

    expect(onChange).toHaveBeenCalledWith(
      '{"query":{}}',
      JSON.stringify({ id: 'tree' })
    );
  });

  it('hides mutation controls when readonly', async () => {
    render(
      <RuleQueryBuilderField
        readonly
        entityType={EntityType.TABLE}
        onChange={jest.fn()}
      />
    );

    // Wait for QueryBuilder to mount.
    await screen.findByTestId('emit-query-change');

    expect(
      screen.queryByTestId('add-context-condition')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('add-condition-button')
    ).not.toBeInTheDocument();
  });

  // Regression test for the silent field-nulling bug: QueryBuilder must never mount
  // before enrichedFields is ready, because RAQB's load-time sanitizer field-nulls any
  // saved extension.<customProperty> rule when the config's extension.subfields is empty.
  it('does not mount QueryBuilder until custom properties are loaded', async () => {
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

    // While custom properties are loading, QueryBuilder is not mounted and a loader is shown.
    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(
      screen.queryByTestId('query-builder-mounted')
    ).not.toBeInTheDocument();

    // Once the fetch resolves, QueryBuilder mounts.
    resolveCustomProps({});
    await screen.findByTestId('query-builder-mounted');
  });

  it('mounts QueryBuilder once custom properties resolve', async () => {
    render(
      <RuleQueryBuilderField
        entityType={EntityType.TABLE}
        onChange={jest.fn()}
      />
    );

    // QueryBuilder mounts after getAllCustomProperties resolves.
    const builder = await screen.findByTestId('query-builder-mounted');

    // The fields prop must be defined (not undefined) when QueryBuilder mounts,
    // so RAQB's sanitizer never runs against an empty extension.subfields config.
    expect(builder.getAttribute('data-fields-defined')).toBe('true');
  });

  // Even when the custom-property fetch fails, enrichedFields should be set
  // (the catch handler sets customProps to {}) so QueryBuilder still mounts.
  it('mounts QueryBuilder even when getAllCustomProperties rejects', async () => {
    jest
      .spyOn(metadataTypeAPI, 'getAllCustomProperties')
      .mockRejectedValue(new Error('network error'));

    render(
      <RuleQueryBuilderField
        entityType={EntityType.TABLE}
        onChange={jest.fn()}
      />
    );

    const builder = await screen.findByTestId('query-builder-mounted');

    expect(builder.getAttribute('data-fields-defined')).toBe('true');
  });

  // A rule with custom-property conditions preserved across reopen requires
  // enrichedFields to be populated before the builder initializes. This test
  // confirms the builder delays mount until fields are ready even when a
  // pre-existing filter is provided.
  it('does not mount QueryBuilder with stale filterJsonTree before fields are ready', async () => {
    const filterJsonTree = JSON.stringify({
      type: 'group',
      properties: { conjunction: 'and', not: false },
      children1: {
        rule1: {
          type: 'rule',
          properties: {
            field: 'extension.business_domain',
            operator: 'select_equals',
            value: ['Finance'],
            valueSrc: ['value'],
          },
        },
      },
    });

    render(
      <RuleQueryBuilderField
        entityType={EntityType.TABLE}
        filterJsonTree={filterJsonTree}
        queryFilter='{"query":{"bool":{"must":[{"term":{"extension.business_domain":"Finance"}}]}}}'
        onChange={jest.fn()}
      />
    );

    // A loader is shown while fields are loading — the builder must not initialize
    // against the fallback config that would field-null the extension rule.
    expect(screen.getByTestId('loader')).toBeInTheDocument();

    // After fields resolve, the builder mounts and will sanitize the tree against
    // a config that knows about extension.business_domain.
    await screen.findByTestId('query-builder-mounted');

    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });
  });
});
