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
import { ReactFlowProvider } from 'reactflow';
import { useWorkflowStore } from '../../useWorkflowStore';
import GatewayNode from './GatewayNode';

jest.mock('../../useWorkflowStore');
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockData = {
  id: '1',
  position: { x: 0, y: 0 },
  data: { name: 'Test Gateway' },
};

jest.mock('../../../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockImplementation((entity) => entity.name),
}));

describe('GatewayNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useWorkflowStore as unknown as jest.Mock).mockReturnValue({
      setDrawerVisible: jest.fn(),
      setSelectedNode: jest.fn(),
      selectedNode: null,
    });
  });

  it('renders gateway node with correct content', () => {
    render(
      <ReactFlowProvider>
        <GatewayNode {...mockData} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('label.gateway')).toBeInTheDocument();
    expect(screen.getByText('Test Gateway')).toBeInTheDocument();
  });

  it('handles node click correctly', () => {
    const mockSetDrawerVisible = jest.fn();
    const mockSetSelectedNode = jest.fn();

    (useWorkflowStore as unknown as jest.Mock).mockReturnValue({
      setDrawerVisible: mockSetDrawerVisible,
      setSelectedNode: mockSetSelectedNode,
      selectedNode: null,
    });

    render(
      <ReactFlowProvider>
        <GatewayNode {...mockData} />
      </ReactFlowProvider>
    );

    fireEvent.click(
      screen.getByText('Test Gateway').parentElement!.parentElement!
    );

    expect(mockSetSelectedNode).toHaveBeenCalled();
    expect(mockSetDrawerVisible).toHaveBeenCalled();
  });
});
