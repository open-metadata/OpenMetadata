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
import type { SelectWidgetProps } from '@react-awesome-query-builder/ui';
import { render, screen } from '@testing-library/react';

import OMSelectWidget from './OMSelectWidget';

const baseProps = {
  placeholder: 'Select option',
  value: null,
  setValue: jest.fn(),
  readonly: false,
  listValues: [
    { value: 'opt1', title: 'Option 1' },
    { value: 'opt2', title: 'Option 2' },
  ],
  useAsyncSearch: false,
  showSearch: false,
  field: {} as any,
  fieldDefinition: {} as any,
  fieldSrc: 'value' as const,
  operator: 'select_equals',
  config: {} as any,
  widgetId: 'test',
} as unknown as SelectWidgetProps;

describe('OMSelectWidget', () => {
  it('renders without crashing', () => {
    render(<OMSelectWidget {...baseProps} />);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('is disabled when readonly', () => {
    render(<OMSelectWidget {...baseProps} readonly />);

    expect(screen.getByRole('button')).toBeDisabled();
  });
});
