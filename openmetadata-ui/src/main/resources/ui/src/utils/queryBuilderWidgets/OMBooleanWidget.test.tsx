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
import type {
  BooleanWidgetProps,
  FieldSource,
} from '@react-awesome-query-builder/ui';
import { render, screen } from '@testing-library/react';
import OMBooleanWidget from './OMBooleanWidget';

const baseProps: Partial<BooleanWidgetProps> = {
  value: false,
  setValue: jest.fn(),
  readonly: false,
  field: {} as any,
  fieldDefinition: {} as any,
  fieldSrc: 'value' as FieldSource,
  operator: 'equal',
  config: {} as any,
  placeholder: '',
  widgetId: 'test',
};

describe('OMBooleanWidget', () => {
  it('renders a toggle', () => {
    render(<OMBooleanWidget {...(baseProps as BooleanWidgetProps)} />);

    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('reflects the value prop', () => {
    render(<OMBooleanWidget {...(baseProps as BooleanWidgetProps)} value />);

    expect(screen.getByRole('switch')).toBeChecked();
  });
});
