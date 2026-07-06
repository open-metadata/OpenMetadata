/*
 *  Copyright 2025 Collate.
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
import { HookForm } from '@openmetadata/ui-core-components';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { Table } from '../../../../generated/entity/data/table';
import {
  Rule,
  TestDataType,
  TestDefinition,
} from '../../../../generated/tests/testDefinition';
import ParameterFields from './ParameterFields';
import { FormValues } from './TestCaseFormV1.interface';

jest.mock('@untitledui/icons', () => ({
  Trash01: () => <span data-testid="trash-icon" />,
}));

const renderWithForm = (
  definition: TestDefinition,
  table?: Table,
  onSubmit?: (values: FormValues) => void
) => {
  const Wrapper = () => {
    const form = useForm<FormValues>();
    const handleSubmit = onSubmit ?? jest.fn();

    return (
      <HookForm form={form} onSubmit={form.handleSubmit(handleSubmit)}>
        <ParameterFields definition={definition} form={form} table={table} />
        <button type="submit">submit</button>
      </HookForm>
    );
  };

  return render(<Wrapper />);
};

describe('ParameterFields', () => {
  it('renders a text input for a String parameter with its label', () => {
    const definition = {
      name: 'columnValuesToBeNotNull',
      parameterDefinition: [
        {
          name: 'minValue',
          displayName: 'Min Value',
          dataType: TestDataType.String,
        },
      ],
    } as TestDefinition;

    renderWithForm(definition);

    expect(screen.getByText('Min Value')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('message.enter-a-field')
    ).toBeInTheDocument();
  });

  it('renders a select offering the option values for an option parameter', () => {
    const definition = {
      name: 'columnValueLengthsToBeBetween',
      parameterDefinition: [
        {
          name: 'matchEnum',
          displayName: 'Match Enum',
          dataType: TestDataType.String,
          optionValues: ['ANY', 'ALL'],
        },
      ],
    } as TestDefinition;

    renderWithForm(definition);

    expect(screen.getByText('Match Enum')).toBeInTheDocument();

    const options = screen
      .getAllByRole('option', { hidden: true })
      .map((option) => option.textContent);

    expect(options).toContain('ANY');
    expect(options).toContain('ALL');
  });

  it('renders a switch with the label for a Boolean parameter', () => {
    const definition = {
      name: 'tableColumnCountToEqual',
      parameterDefinition: [
        {
          name: 'caseSensitive',
          displayName: 'Case Sensitive',
          dataType: TestDataType.Boolean,
        },
      ],
    } as TestDefinition;

    renderWithForm(definition);

    expect(screen.getByText('Case Sensitive')).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: 'Case Sensitive' })
    ).toBeInTheDocument();
  });

  it('surfaces the validation message when a value violates a GreaterThanOrEquals rule', async () => {
    const definition = {
      name: 'columnValuesToBeBetween',
      parameterDefinition: [
        {
          name: 'minValue',
          displayName: 'Min Value',
          dataType: TestDataType.Number,
        },
        {
          name: 'maxValue',
          displayName: 'Max Value',
          dataType: TestDataType.Number,
          validationRule: {
            parameterField: 'minValue',
            rule: Rule.GreaterThanOrEquals,
          },
        },
      ],
    } as TestDefinition;

    renderWithForm(definition);

    const minInput = screen.getByRole('spinbutton', { name: 'Min Value' });
    const maxInput = screen.getByRole('spinbutton', { name: 'Max Value' });

    await act(async () => {
      fireEvent.change(minInput, { target: { value: '10' } });
      fireEvent.change(maxInput, { target: { value: '5' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('submit'));
    });

    await waitFor(() => {
      expect(
        screen.getByText('message.maximum-value-error')
      ).toBeInTheDocument();
    });
  });

  it('renders one row by default for an Array parameter', () => {
    const definition = {
      name: 'columnValuesToBeInSet',
      parameterDefinition: [
        {
          name: 'allowedValues',
          displayName: 'Allowed Values',
          dataType: TestDataType.Array,
        },
      ],
    } as TestDefinition;

    renderWithForm(definition);

    expect(screen.getByText('Allowed Values')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('appends a new row when the add button is clicked for an Array parameter', async () => {
    const definition = {
      name: 'columnValuesToBeInSet',
      parameterDefinition: [
        {
          name: 'allowedValues',
          displayName: 'Allowed Values',
          dataType: TestDataType.Array,
        },
      ],
    } as TestDefinition;

    renderWithForm(definition);

    expect(screen.getAllByRole('textbox')).toHaveLength(1);

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-allowedValues'));
    });

    expect(screen.getAllByRole('textbox')).toHaveLength(2);
  });

  it('removes a row when its remove button is clicked for an Array parameter', async () => {
    const definition = {
      name: 'columnValuesToBeInSet',
      parameterDefinition: [
        {
          name: 'allowedValues',
          displayName: 'Allowed Values',
          dataType: TestDataType.Array,
        },
      ],
    } as TestDefinition;

    renderWithForm(definition);

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-allowedValues'));
    });

    expect(screen.getAllByRole('textbox')).toHaveLength(2);

    await act(async () => {
      fireEvent.click(screen.getByTestId('remove-allowedValues-0'));
    });

    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('serializes Array param values as array of {value} objects on submit', async () => {
    const capturedValues: FormValues[] = [];

    const definition = {
      name: 'columnValuesToBeInSet',
      parameterDefinition: [
        {
          name: 'allowedValues',
          displayName: 'Allowed Values',
          dataType: TestDataType.Array,
        },
      ],
    } as TestDefinition;

    renderWithForm(definition, undefined, (values) =>
      capturedValues.push(values)
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-allowedValues'));
    });

    const inputs = screen.getAllByRole('textbox');

    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: 'x' } });
      fireEvent.change(inputs[1], { target: { value: 'y' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('submit'));
    });

    await waitFor(() => {
      expect(capturedValues).toHaveLength(1);
    });

    expect(capturedValues[0].params?.allowedValues).toEqual([
      { value: 'x' },
      { value: 'y' },
    ]);
  });

  it('renders one row by default for a Set parameter', () => {
    const definition = {
      name: 'columnValuesToBeInSet',
      parameterDefinition: [
        {
          name: 'forbiddenValues',
          displayName: 'Forbidden Values',
          dataType: TestDataType.Set,
        },
      ],
    } as TestDefinition;

    renderWithForm(definition);

    expect(screen.getByText('Forbidden Values')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });
});
