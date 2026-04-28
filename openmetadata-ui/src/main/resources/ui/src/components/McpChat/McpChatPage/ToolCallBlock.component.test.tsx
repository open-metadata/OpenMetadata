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
import { ToolCallBlock } from './ToolCallBlock.component';
import { McpToolCall } from '../../../rest/mcpClientAPI';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const toolCallWithResult: McpToolCall = {
  id: 'tc-1',
  name: 'search_metadata',
  input: { query: 'find tables' },
  result: { count: 10, items: [] },
};

const toolCallWithoutResult: McpToolCall = {
  id: 'tc-2',
  name: 'get_entity_details',
  input: { fqn: 'service.db.schema.table' },
};

describe('ToolCallBlock', () => {
  it('renders tool name in the component', () => {
    render(<ToolCallBlock toolCall={toolCallWithResult} />);

    expect(screen.getByTestId('tool-call-name')).toHaveTextContent(
      'search_metadata'
    );
  });

  it('renders input JSON in the body', () => {
    render(<ToolCallBlock toolCall={toolCallWithResult} />);

    expect(screen.getByTestId('tool-call-input')).toHaveTextContent(
      'find tables'
    );
  });

  it('renders result section when result is present', () => {
    render(<ToolCallBlock toolCall={toolCallWithResult} />);

    expect(screen.getByTestId('tool-call-result')).toBeInTheDocument();
  });

  it('does not render result section when result is absent', () => {
    render(<ToolCallBlock toolCall={toolCallWithoutResult} />);

    expect(screen.queryByTestId('tool-call-result')).not.toBeInTheDocument();
  });
});
