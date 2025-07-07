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
import {
  FieldErrorProps,
  RJSFSchema,
  TemplatesType,
  WidgetProps,
} from '@rjsf/utils';
import { render, screen } from '@testing-library/react';
import CodeWidget from './CodeWidget';

jest.mock('../../../../../Database/SchemaEditor/SchemaEditor', () =>
  jest.fn().mockImplementation(() => <div>SchemaEditor</div>)
);

describe('CodeWidget', () => {
  const mockProps: WidgetProps = {
    id: 'test-id',
    value: 'test value',
    onChange: jest.fn(),
    onFocus: jest.fn(),
    schema: { mode: 'sql' },
    disabled: false,
    name: '',
    options: {} as Partial<
      Omit<TemplatesType<any, RJSFSchema, any>, 'ButtonTemplates'>
    >,
    onBlur: jest.fn(),
    label: '',
    registry: {} as FieldErrorProps['registry'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render SchemaEditor with correct props', () => {
    render(<CodeWidget {...mockProps} />);

    expect(screen.getByText('SchemaEditor')).toBeInTheDocument();
  });
});
