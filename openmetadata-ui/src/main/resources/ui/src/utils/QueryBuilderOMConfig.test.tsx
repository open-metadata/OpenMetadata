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
import { render, screen } from '@testing-library/react';
import { OMConfig } from './QueryBuilderOMConfig';
import { GLOSSARY_TERM_FIELD_MARKER } from './queryBuilderWidgets/glossaryTermQueryField';

jest.mock('./queryBuilderWidgets/GlossaryTermQueryWidget', () => ({
  __esModule: true,
  default: () => <div data-testid="glossary-term-query-widget" />,
}));

jest.mock('./queryBuilderWidgets/OMSelectWidget', () => ({
  __esModule: true,
  default: () => <div data-testid="om-select-widget" />,
}));

jest.mock('./queryBuilderWidgets/OMMultiSelectWidget', () => ({
  __esModule: true,
  default: () => <div data-testid="om-multi-select-widget" />,
}));

const props = (marked: boolean) =>
  ({
    value: null,
    setValue: jest.fn(),
    placeholder: '',
    readonly: false,
    fieldDefinition: marked
      ? { fieldSettings: { [GLOSSARY_TERM_FIELD_MARKER]: true } }
      : {},
    // A glossary field carries these too, so they must not decide the control.
    asyncFetch: jest.fn(),
    useAsyncSearch: true,
  } as never);

describe('OMConfig glossary-term widgets', () => {
  it.each([
    ['select', 'om-select-widget'],
    ['multiselect', 'om-multi-select-widget'],
  ])('renders the tree for a marked %s field', (type, defaultTestId) => {
    const { factory } = OMConfig.widgets[type as 'select'];

    const { unmount } = render(<>{factory?.(props(true))}</>);

    expect(screen.getByTestId('glossary-term-query-widget')).toBeInTheDocument();
    unmount();

    render(<>{factory?.(props(false))}</>);

    expect(screen.getByTestId(defaultTestId)).toBeInTheDocument();
  });
});
