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
import { fireEvent, render, screen } from '@testing-library/react';
import { TestCase } from '../../../../../generated/tests/testCase';
import { TestDefinition } from '../../../../../generated/tests/testDefinition';
import TestCaseConfigurationCard from './TestCaseConfigurationCard';
import { TestCaseConfigurationCardProps } from './TestCaseConfigurationCard.types';

jest.mock('../../../../common/IconButtons/EditIconButton', () => ({
  // `newLook`/`size`/`title` are the real button's own props — keep them off the
  // DOM node so they don't surface as React unknown-prop warnings.
  EditIconButton: jest.fn(({ onClick, 'data-testid': dataTestId }) => (
    <button data-testid={dataTestId} onClick={onClick}>
      edit
    </button>
  )),
}));

const COLUMN_ENTITY_LINK =
  '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::zip>';
const TABLE_ENTITY_LINK =
  '<#E::table::sample_data.ecommerce_db.shopify.dim_address>';

const mockOnEditParameter = jest.fn();

const defaultProps: TestCaseConfigurationCardProps = {
  testCaseData: { entityLink: COLUMN_ENTITY_LINK } as TestCase,
  testDefinition: {
    name: 'columnValuesToBeBetween',
    displayName: 'Column Values To Be Between',
  } as TestDefinition,
  parameterRows: [
    { label: 'min', value: '90001' },
    { label: 'max', value: '96162' },
  ],
  withSqlParams: [],
  isVersionPage: false,
  showEditButton: false,
  onEditParameter: mockOnEditParameter,
};

const renderCard = (overrides: Partial<TestCaseConfigurationCardProps> = {}) =>
  render(<TestCaseConfigurationCard {...defaultProps} {...overrides} />);

describe('TestCaseConfigurationCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the parameters shape with a row per parameter', () => {
    renderCard();

    expect(
      screen.getByTestId('test-case-configuration-card')
    ).toBeInTheDocument();
    expect(screen.getByTestId('configuration-test-name')).toHaveTextContent(
      'Column Values To Be Between'
    );
    expect(screen.getByTestId('configuration-parameter-min')).toHaveTextContent(
      '90001'
    );
    expect(screen.getByTestId('configuration-parameter-max')).toHaveTextContent(
      '96162'
    );
    expect(
      screen.queryByTestId('configuration-empty-state')
    ).not.toBeInTheDocument();
  });

  it('renders the dynamic assertion shape instead of parameter rows', () => {
    renderCard({
      testCaseData: {
        entityLink: COLUMN_ENTITY_LINK,
        useDynamicAssertion: true,
      } as TestCase,
      parameterRows: [],
    });

    expect(screen.getByTestId('dynamic-assertion')).toBeInTheDocument();
    expect(screen.getByText('label.dynamic-assertion')).toBeInTheDocument();
    expect(
      screen.getByText('message.bounds-learned-automatically')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('configuration-parameter-rows')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('configuration-empty-state')
    ).not.toBeInTheDocument();
  });

  it('renders the custom SQL shape alongside parameter rows', () => {
    renderCard({
      parameterRows: [{ label: 'Strategy', value: 'ROWS' }],
      withSqlParams: [
        { name: 'sqlExpression', value: 'SELECT COUNT(*) FROM customers' },
      ],
    });

    const sql = screen.getByTestId('sql-expression-container');

    expect(sql).toBeInTheDocument();
    expect(sql).toHaveTextContent('SELECT COUNT(*) FROM customers');
    // The prototype's shapes are independent: params and SQL co-render.
    expect(
      screen.getByTestId('configuration-parameter-Strategy')
    ).toBeInTheDocument();
  });

  it('numbers each SQL line and highlights only the keywords', () => {
    renderCard({
      parameterRows: [],
      withSqlParams: [
        {
          name: 'sqlExpression',
          value: 'SELECT COUNT(*)\nFROM customers\nWHERE email IS NULL',
        },
      ],
    });

    const sql = screen.getByTestId('sql-expression-container');

    expect(sql).toHaveTextContent('1');
    expect(sql).toHaveTextContent('3');
    // Keywords are styled; the table name beside them is not.
    expect(screen.getByText('SELECT')).toHaveClass(
      'tw:text-utility-purple-600'
    );
    expect(screen.getByText('WHERE')).toHaveClass('tw:text-utility-purple-600');
    expect(screen.getByText('customers')).not.toHaveClass(
      'tw:text-utility-purple-600'
    );
  });

  it('renders the empty shape when there is nothing to configure', () => {
    renderCard({ parameterRows: [], withSqlParams: [] });

    expect(screen.getByTestId('configuration-empty-state')).toHaveTextContent(
      'message.no-configurable-parameters'
    );
    expect(
      screen.queryByTestId('configuration-parameter-rows')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('dynamic-assertion')).not.toBeInTheDocument();
  });

  it('labels a column test with its column and a table test without one', () => {
    const { unmount } = renderCard();

    expect(screen.getByTestId('configuration-category')).toHaveTextContent(
      'label.column-test-with-column'
    );

    unmount();
    renderCard({
      testCaseData: { entityLink: TABLE_ENTITY_LINK } as TestCase,
    });

    expect(screen.getByTestId('configuration-category')).toHaveTextContent(
      'label.table-test'
    );
  });

  it('hides the edit affordance without permission and opens the editor with it', () => {
    const { unmount } = renderCard({ showEditButton: false });

    expect(screen.queryByTestId('edit-parameter-icon')).not.toBeInTheDocument();

    unmount();
    renderCard({ showEditButton: true });

    fireEvent.click(screen.getByTestId('edit-parameter-icon'));

    expect(mockOnEditParameter).toHaveBeenCalledTimes(1);
  });

  it('renders the version diff and hides the assertion SQL on a version page', () => {
    renderCard({
      isVersionPage: true,
      parameterRows: [],
      withSqlParams: [
        { name: 'sqlExpression', value: 'SELECT COUNT(*) FROM customers' },
      ],
      versionParameterDiff: <span>parameter-diff</span>,
    });

    expect(screen.getByTestId('configuration-version-diff')).toHaveTextContent(
      'parameter-diff'
    );
    expect(
      screen.queryByTestId('sql-expression-container')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('configuration-empty-state')
    ).not.toBeInTheDocument();
  });

  it('falls back to a start-cased definition name when no display name is set', () => {
    renderCard({
      testDefinition: { name: 'tableRowCountToEqual' } as TestDefinition,
    });

    expect(screen.getByTestId('configuration-test-name')).toHaveTextContent(
      'Table Row Count To Equal'
    );
  });
});
