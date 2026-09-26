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
import { withGlossaryTermField } from './queryBuilderWidgets/glossaryTermQueryField';

// Boundary: the real picker mounts the glossary tree and fetches on open, which
// jsdom cannot drive. The widgets below are the real ones.
jest.mock('./queryBuilderWidgets/GlossaryTermQueryWidget', () => ({
  __esModule: true,
  default: () => <div data-testid="glossary-term-query-widget" />,
}));

// The settings a glossary field really carries, built by the production helper.
const glossaryFieldSettings = withGlossaryTermField({
  asyncFetch: jest.fn().mockResolvedValue({ values: [], hasMore: false }),
  useAsyncSearch: true,
});

const widgetProps = (fieldSettings: Record<string, unknown>) =>
  ({
    // RAQB flattens fieldSettings into the props and passes fieldDefinition
    // whole; both shapes are reproduced here.
    ...fieldSettings,
    fieldDefinition: { fieldSettings },
    value: null,
    setValue: jest.fn(),
    placeholder: '',
    readonly: false,
    listValues: [],
  } as never);

const plainFieldSettings = { useAsyncSearch: false };

describe('OMConfig glossary-term widgets', () => {
  it.each([
    ['select', 'advanced-search-value-select'],
    ['multiselect', 'advanced-search-value-multiselect'],
  ])(
    'renders the glossary tree for a marked %s field',
    (type, defaultTestId) => {
      const { factory } = OMConfig.widgets[type as 'select'];

      const { unmount } = render(
        <>{factory?.(widgetProps(glossaryFieldSettings))}</>
      );

      expect(
        screen.getByTestId('glossary-term-query-widget')
      ).toBeInTheDocument();
      expect(screen.queryByTestId(defaultTestId)).not.toBeInTheDocument();

      unmount();

      render(<>{factory?.(widgetProps(plainFieldSettings))}</>);

      expect(screen.getByTestId(defaultTestId)).toBeInTheDocument();
      expect(
        screen.queryByTestId('glossary-term-query-widget')
      ).not.toBeInTheDocument();
    }
  );
});
