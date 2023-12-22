/*
 *  Copyright 2023 Collate.
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
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { getLineageDataByFQN } from '../../rest/lineageAPI';
import { EdgeTypeEnum } from '../Entity/EntityLineage/EntityLineage.interface';
import LineageProvider, { useLineageProvider } from './LineageProvider';

const mockLocation = {
  search: '',
  pathname: '/lineage',
};

const DummyChildrenComponent = () => {
  const { loadChildNodesHandler, onNodeClick } = useLineageProvider();

  const nodeData = {
    name: 'table1',
    type: 'table',
    fullyQualifiedName: 'table1',
    id: 'table1',
  };
  const nodeObj = {
    id: 'dummyId',
    position: { x: 100, y: 100 },
    data: {
      ...nodeData,
    },
  };
  const handleButtonClick = () => {
    // Trigger the loadChildNodesHandler method when the button is clicked
    loadChildNodesHandler(nodeData, EdgeTypeEnum.DOWN_STREAM);
  };

  return (
    <div>
      <button data-testid="load-nodes" onClick={handleButtonClick}>
        Load Nodes
      </button>
      <button data-testid="node1" onClick={() => onNodeClick(nodeObj)}>
        Node
      </button>
    </div>
  );
};

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockReturnValue({ push: jest.fn(), listen: jest.fn() }),
  useLocation: jest.fn().mockImplementation(() => mockLocation),
  useParams: jest.fn().mockReturnValue({
    fqn: 'table1',
  }),
}));

jest.mock('../../rest/lineageAPI', () => ({
  getLineageDataByFQN: jest.fn(),
}));

describe('LineageProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Lineage component and fetches data', async () => {
    await act(async () => {
      render(
        <LineageProvider>
          <div data-testid="children">Children</div>
        </LineageProvider>
      );
    });

    expect(getLineageDataByFQN).toHaveBeenCalled();
  });

  it('should call loadChildNodesHandler', async () => {
    await act(async () => {
      render(
        <LineageProvider>
          <DummyChildrenComponent />
        </LineageProvider>
      );
    });

    const loadButton = await screen.getByTestId('load-nodes');
    fireEvent.click(loadButton);

    expect(getLineageDataByFQN).toHaveBeenCalled();
  });

  it.skip('should call onNodeClick', async () => {
    await act(async () => {
      render(
        <LineageProvider>
          <DummyChildrenComponent />
        </LineageProvider>
      );
    });

    const nodeClick = await screen.getByTestId('node1');
    fireEvent.click(nodeClick);
  });
});
