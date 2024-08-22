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
import React, { useEffect } from 'react';
import { Edge } from 'reactflow';
import { EdgeTypeEnum } from '../../components/Entity/EntityLineage/EntityLineage.interface';
import { EntityType } from '../../enums/entity.enum';
import { getLineageDataByFQN } from '../../rest/lineageAPI';
import LineageProvider, { useLineageProvider } from './LineageProvider';

const mockLocation = {
  search: '',
  pathname: '/lineage',
};

const DummyChildrenComponent = () => {
  const {
    loadChildNodesHandler,
    onEdgeClick,
    updateEntityType,
    onLineageEditClick,
  } = useLineageProvider();

  const nodeData = {
    name: 'table1',
    type: 'table',
    fullyQualifiedName: 'table1',
    id: 'table1',
  };

  const MOCK_EDGE = {
    id: 'test',
    source: 'test',
    target: 'test',
    type: 'test',
    data: {
      edge: {
        fromEntity: {
          id: 'test',
          type: 'test',
        },
        toEntity: {
          id: 'test',
          type: 'test',
        },
      },
    },
  };
  const handleButtonClick = () => {
    // Trigger the loadChildNodesHandler method when the button is clicked
    loadChildNodesHandler(nodeData, EdgeTypeEnum.DOWN_STREAM);
  };

  useEffect(() => {
    updateEntityType(EntityType.TABLE);
  }, []);

  return (
    <div>
      <button data-testid="load-nodes" onClick={handleButtonClick}>
        Load Nodes
      </button>
      <button
        data-testid="edge-click"
        onClick={() => onEdgeClick(MOCK_EDGE as Edge)}>
        On Edge Click
      </button>
      <button data-testid="openConfirmationModal">
        Close Confirmation Modal
      </button>
      <button data-testid="editLineage" onClick={onLineageEditClick}>
        Edit Lineage
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

jest.mock(
  '../../components/Entity/EntityInfoDrawer/EdgeInfoDrawer.component',
  () => {
    return jest.fn().mockImplementation(() => {
      return <p>Edge Info Drawer</p>;
    });
  }
);

jest.mock(
  '../../components/Entity/EntityLineage/EntityLineageSidebar.component',
  () => {
    return jest.fn().mockImplementation(() => {
      return <p>Entity Lineage Sidebar</p>;
    });
  }
);

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
          <DummyChildrenComponent />
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

  it('should show sidebar when edit is clicked', async () => {
    await act(async () => {
      render(
        <LineageProvider>
          <DummyChildrenComponent />
        </LineageProvider>
      );
    });

    const loadButton = await screen.getByTestId('editLineage');
    fireEvent.click(loadButton);

    const edgeDrawer = screen.getByText('Entity Lineage Sidebar');

    expect(edgeDrawer).toBeInTheDocument();
  });

  it('should show delete modal', async () => {
    await act(async () => {
      render(
        <LineageProvider>
          <DummyChildrenComponent />
        </LineageProvider>
      );
    });

    const edgeClick = await screen.getByTestId('edge-click');
    fireEvent.click(edgeClick);

    const edgeDrawer = screen.getByText('Edge Info Drawer');

    expect(edgeDrawer).toBeInTheDocument();
  });
});
