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
import type {
  Actions,
  Config,
  FieldProps,
} from '@react-awesome-query-builder/ui';
import { QUERY_BUILDER_SURFACE } from '../../../../utils/queryBuilder/types';
import { EXPLORE_BUTTON_PRESET } from '../QueryBuilderButton/QueryBuilderButton.constants';
import QueryBuilderRuleRow from './QueryBuilderRuleRow';

// The row asks RAQB which operators and widget a field/operator pair takes.
// Answering here keeps the test about the row rather than about RAQB's config
// resolution, which `config.test.ts` already covers.
jest.mock('./QueryBuilderCanvas.utils', () => ({
  ...jest.requireActual('./QueryBuilderCanvas.utils'),
  configUtils: {
    getFieldConfig: () => ({ fieldSettings: { placeholder: 'Search' } }),
    getOperatorsForField: () => ['==', 'between', 'unwidgeted'],
    getWidgetForFieldOp: (_config: unknown, _field: string, operator: string) =>
      operator === 'unwidgeted' ? undefined : 'text',
  },
}));

const actions = {
  removeRule: jest.fn(),
  setField: jest.fn(),
  setOperator: jest.fn(),
  setValue: jest.fn(),
} as unknown as Actions;

/**
 * Reports the moment it is asked to change, so no combobox is involved. The
 * testid defaults per renderer exactly as `QueryBuilderOMConfig` does, since
 * that is where a row's field and operator controls get theirs.
 */
const renderSelectStub = (defaultTestId: string) => (props: FieldProps) =>
  (
    <button
      data-testid={
        (props as unknown as { dataTestId?: string }).dataTestId ??
        defaultTestId
      }
      type="button"
      onClick={() => props.setField('picked')}>
      {String(props.selectedKey ?? '')}
    </button>
  );

const config = {
  fields: { name: { label: 'Name' } },
  operators: {
    '==': { label: '==' },
    between: { cardinality: 2, label: 'Between' },
    unwidgeted: { label: 'Is Set' },
  },
  settings: {
    renderField: renderSelectStub('advanced-search-field-select'),
    renderOperator: renderSelectStub('advanced-search-operator-select'),
  },
  widgets: {
    text: {
      factory: (props: { value?: unknown; setValue: (v: string) => void }) => (
        <input
          aria-label="value"
          data-testid="value-widget"
          value={String(props.value ?? '')}
          onChange={(event) => props.setValue(event.target.value)}
        />
      ),
    },
  },
} as unknown as Config;

const context = {
  actions,
  allowGroups: false,
  canRemoveRule: true,
  config,
  preset: EXPLORE_BUTTON_PRESET,
  readonly: false,
  ruleIndexById: {},
  showConjunction: true,
  surface: QUERY_BUILDER_SURFACE.SUBTLE,
};

const utils = jest.requireMock('./QueryBuilderCanvas.utils');
const realConfigUtils = { ...utils.configUtils };

afterEach(() => {
  Object.assign(utils.configUtils, realConfigUtils);
});

const renderRow = (rule = {}, overrides = {}) =>
  render(
    <QueryBuilderRuleRow
      context={{ ...context, ...overrides }}
      path={['root', 'r1']}
      rule={rule}
    />
  );

describe('QueryBuilderRuleRow', () => {
  it('should label its three columns and address them by testid', () => {
    renderRow();

    expect(screen.getByText('label.field')).toBeInTheDocument();
    expect(screen.getByText('label.operator')).toBeInTheDocument();
    expect(screen.getByText('label.value')).toBeInTheDocument();
    expect(screen.getByTestId('advanced-search-value')).toBeInTheDocument();
  });

  it('should set the field it is asked for', () => {
    renderRow();

    fireEvent.click(screen.getByTestId('advanced-search-field-select'));

    expect(actions.setField).toHaveBeenCalledWith(['root', 'r1'], 'picked');
  });

  it('should set the operator it is asked for', () => {
    renderRow({ properties: { field: 'name' } });

    fireEvent.click(screen.getByTestId('advanced-search-operator-select'));

    expect(actions.setOperator).toHaveBeenCalledWith(['root', 'r1'], 'picked');
  });

  it('should leave the value column empty until a field and operator are set', () => {
    renderRow({ properties: { field: 'name' } });

    expect(screen.queryByTestId('value-widget')).not.toBeInTheDocument();
  });

  it('should render the widget the config names, seeded with the stored value', () => {
    renderRow({
      properties: { field: 'name', operator: '==', value: ['stored'] },
    });

    expect(screen.getByTestId('value-widget')).toHaveValue('stored');
  });

  it('should report an edited value against the slot it came from', () => {
    renderRow({
      properties: {
        field: 'name',
        operator: '==',
        value: ['stored'],
        valueType: ['text'],
      },
    });

    fireEvent.change(screen.getByTestId('value-widget'), {
      target: { value: 'typed' },
    });

    expect(actions.setValue).toHaveBeenCalledWith(
      ['root', 'r1'],
      0,
      'typed',
      'text'
    );
  });

  it('should give a two-valued operator a widget per value', () => {
    renderRow({
      properties: { field: 'name', operator: 'between', value: [1, 9] },
    });

    expect(screen.getAllByTestId('value-widget')).toHaveLength(2);
  });

  it('should fall back to a text value type when the rule records none', () => {
    renderRow({ properties: { field: 'name', operator: '==', value: [''] } });

    fireEvent.change(screen.getByTestId('value-widget'), {
      target: { value: 'x' },
    });

    expect(actions.setValue).toHaveBeenCalledWith(
      ['root', 'r1'],
      0,
      'x',
      'text'
    );
  });

  it('should render no value cell for an operator that takes none', () => {
    renderRow({ properties: { field: 'name', operator: 'unwidgeted' } });

    expect(screen.queryByTestId('value-widget')).not.toBeInTheDocument();
  });

  it('should remove the rule it belongs to', () => {
    renderRow();

    fireEvent.click(screen.getByTestId('advanced-search-delete-rule'));

    expect(actions.removeRule).toHaveBeenCalledWith(['root', 'r1']);
  });

  it('should withhold the delete control from the last remaining rule', () => {
    renderRow({}, { canRemoveRule: false });

    expect(
      screen.queryByTestId('advanced-search-delete-rule')
    ).not.toBeInTheDocument();
  });

  it('should offer no operators when the field admits none', () => {
    utils.configUtils.getOperatorsForField = () => null;
    renderRow({ properties: { field: 'name' } });

    expect(
      screen.getByTestId('advanced-search-operator-select')
    ).toBeInTheDocument();
  });

  it('should name an operator by its key when the config gives no label', () => {
    renderRow(
      { properties: { field: 'name' } },
      { config: { ...config, operators: {} } as unknown as Config }
    );

    expect(
      screen.getByTestId('advanced-search-operator-select')
    ).toBeInTheDocument();
  });

  it('should render no widget for an operator that declares no value slot', () => {
    renderRow(
      { properties: { field: 'name', operator: '==' } },
      {
        config: {
          ...config,
          operators: { '==': { cardinality: 0, label: '==' } },
        } as unknown as Config,
      }
    );

    expect(screen.queryByTestId('value-widget')).not.toBeInTheDocument();
  });

  it('should render no widget when the named one is not registered', () => {
    renderRow(
      { properties: { field: 'name', operator: '==' } },
      { config: { ...config, widgets: {} } as unknown as Config }
    );

    expect(screen.queryByTestId('value-widget')).not.toBeInTheDocument();
  });

  it('should render a widget for a field that carries no settings', () => {
    utils.configUtils.getFieldConfig = () => null;
    renderRow({ properties: { field: 'name', operator: '==' } });

    expect(screen.getByTestId('value-widget')).toBeInTheDocument();
  });

  it('should render an empty widget for a rule with no value yet', () => {
    renderRow({ properties: { field: 'name', operator: '==' } });

    expect(screen.getByTestId('value-widget')).toHaveValue('');
  });

  it('should withhold the delete control when readonly', () => {
    renderRow({}, { readonly: true });

    expect(
      screen.queryByTestId('advanced-search-delete-rule')
    ).not.toBeInTheDocument();
  });
});
