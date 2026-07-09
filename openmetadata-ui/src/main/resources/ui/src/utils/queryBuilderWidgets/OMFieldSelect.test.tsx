/*
 *  Copyright 2024 Collate.
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
import { render, screen } from '@testing-library/react';
import OMConjs from './OMConjs';
import OMFieldSelect from './OMFieldSelect';

const fieldProps = {
  items: [
    {
      key: 'name',
      path: 'name',
      label: 'Name',
      fullLabel: 'Name',
      groupkey: undefined,
      grouplabel: undefined,
    },
    {
      key: 'owner',
      path: 'owner',
      label: 'Owner',
      fullLabel: 'Owner',
      groupkey: undefined,
      grouplabel: undefined,
    },
  ],
  selectedKey: 'name',
  setField: jest.fn(),
  readonly: false,
  placeholder: 'Select field',
  errorText: '',
  config: {} as any,
};

const conjsProps = {
  id: 'group-1',
  selectedConjunction: 'AND',
  setConjunction: jest.fn(),
  conjunctionOptions: {
    AND: {
      id: 'AND',
      label: 'AND',
      checked: true,
      key: 'AND',
      path: '',
      conjunction: 'AND',
    },
    OR: {
      id: 'OR',
      label: 'OR',
      checked: false,
      key: 'OR',
      path: '',
      conjunction: 'OR',
    },
  },
  not: false,
  setNot: jest.fn(),
  showNot: false,
  readonly: false,
};

describe('OMFieldSelect', () => {
  it('renders a combobox input', () => {
    render(<OMFieldSelect {...fieldProps} />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});

describe('OMConjs', () => {
  it('renders AND and OR buttons', () => {
    render(<OMConjs {...conjsProps} />);

    expect(screen.getByText('AND')).toBeInTheDocument();
    expect(screen.getByText('OR')).toBeInTheDocument();
  });
});
