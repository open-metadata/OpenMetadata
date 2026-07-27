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
import { EntityType } from '../../../../../enums/entity.enum';
import { RuleQueryBuilderField } from './RuleQueryBuilderField.component';

const mockAddRule = jest.fn();
const mockQueryActions = { addRule: mockAddRule };

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock(
  '../../../../common/QueryBuilderWidgetV1/QueryBuilderWidgetV1',
  () => {
    const MockQueryBuilderWidget = ({
      getQueryActions,
      onChange,
    }: {
      getQueryActions?: (actions: { addRule: typeof mockAddRule }) => void;
      onChange?: (value: string, tree: Record<string, string>) => void;
    }) => {
      const React = jest.requireActual<typeof import('react')>('react');
      React.useEffect(() => {
        getQueryActions?.(mockQueryActions);
      }, [getQueryActions]);

      return (
        <button
          data-testid="emit-query-change"
          onClick={() => onChange?.('{"query":{}}', { id: 'tree' })}>
          change
        </button>
      );
    };

    return { __esModule: true, default: MockQueryBuilderWidget };
  }
);

describe('RuleQueryBuilderField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes add condition and serializes query tree changes', async () => {
    const onChange = jest.fn();
    render(
      <RuleQueryBuilderField
        entityType={EntityType.TABLE}
        onChange={onChange}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId('add-context-condition')).toBeEnabled()
    );
    fireEvent.click(screen.getByTestId('add-context-condition'));
    fireEvent.click(screen.getByTestId('emit-query-change'));

    expect(mockAddRule).toHaveBeenCalledWith([]);
    expect(onChange).toHaveBeenCalledWith(
      '{"query":{}}',
      JSON.stringify({ id: 'tree' })
    );
  });

  it('hides mutation controls when readonly', () => {
    render(
      <RuleQueryBuilderField
        readonly
        entityType={EntityType.TABLE}
        onChange={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('add-context-condition')
    ).not.toBeInTheDocument();
  });
});
