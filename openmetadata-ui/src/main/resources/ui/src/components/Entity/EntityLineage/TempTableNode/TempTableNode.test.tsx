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
import { ReactFlowProvider } from 'reactflow';
import TempTableNode from './TempTableNode';

const baseProps = {
  id: 'temp_table_1',
  type: 'temp-table',
  zIndex: 0,
  isConnectable: false,
  selected: false,
  xPos: 0,
  yPos: 0,
  dragging: false,
};

describe('TempTableNode', () => {
  it('renders displayName when provided', () => {
    render(
      <ReactFlowProvider>
        <TempTableNode
          {...baseProps}
          data={{
            node: { id: 'temp_table_1', displayName: 'tmp_order_staging', name: 'tmp_order_staging_raw' },
          }}
        />
      </ReactFlowProvider>
    );

    expect(screen.getByText('tmp_order_staging')).toBeInTheDocument();
  });

  it('falls back to name when displayName is absent', () => {
    render(
      <ReactFlowProvider>
        <TempTableNode
          {...baseProps}
          data={{
            node: { id: 'temp_table_1', name: 'tmp_order_raw' },
          }}
        />
      </ReactFlowProvider>
    );

    expect(screen.getByText('tmp_order_raw')).toBeInTheDocument();
  });

  it('renders the temp-table-node container', () => {
    render(
      <ReactFlowProvider>
        <TempTableNode
          {...baseProps}
          data={{
            node: { id: 'temp_table_1', name: 'tmp_node' },
          }}
        />
      </ReactFlowProvider>
    );

    expect(screen.getByTestId('temp-table-node-label')).toBeInTheDocument();
  });

  it('renders left (target) and right (source) handles', () => {
    const { container } = render(
      <ReactFlowProvider>
        <TempTableNode
          {...baseProps}
          data={{
            node: { id: 'temp_table_1', name: 'tmp_node' },
          }}
        />
      </ReactFlowProvider>
    );

    const handles = container.querySelectorAll('.react-flow__handle');

    expect(handles).toHaveLength(2);
    expect(handles[0]).toHaveClass('react-flow__handle-left');
    expect(handles[1]).toHaveClass('react-flow__handle-right');
  });

  it('does not render a gear icon or any button', () => {
    const { container } = render(
      <ReactFlowProvider>
        <TempTableNode
          {...baseProps}
          data={{
            node: { id: 'temp_table_1', name: 'tmp_node' },
          }}
        />
      </ReactFlowProvider>
    );

    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('[data-icon="setting"]')).toBeNull();
  });
});
