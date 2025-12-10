/*
 *  Copyright 2022 Collate.
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

import { createTheme, Theme, ThemeProvider } from '@mui/material/styles';
import { ThemeColors } from '@openmetadata/ui-core-components';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EdgeProps, Position } from 'reactflow';
import { useLineageProvider } from '../../../context/LineageProvider/LineageProvider';
import { EntityType } from '../../../enums/entity.enum';
import { LineageLayer } from '../../../generated/settings/settings';
import { CustomEdge } from './CustomEdge.component';

jest.mock('../../../constants/Lineage.constants', () => ({
  foreignObjectSize: 40,
}));

const mockCustomEdgeProp = {
  id: 'id1',
  sourceX: 20,
  sourceY: 20,
  targetX: 20,
  targetY: 20,
  sourcePosition: Position.Left,
  targetPosition: Position.Right,
  style: {},
  markerEnd: '',
  data: {
    source: 'node1',
    target: 'node2',
    sourceType: EntityType.TABLE,
    targetType: EntityType.DASHBOARD,
    onEdgeClick: jest.fn(),
    isColumnLineage: false,
    selectedNode: {
      id: 'node1',
    },
    edge: {
      fromEntity: {
        id: '1',
        fullyQualifiedName: 'table1',
        type: 'table',
      },
      toEntity: {
        id: '2',
        fullyQualifiedName: 'table2',
        type: 'table',
      },
      pipeline: {
        id: 'pipeline1',
        fullyQualifiedName: 'pipeline1',
        type: 'pipeline',
        name: 'pipeline1',
      },
    },
    isEditMode: true,
    dataTestId: 'edge-id1',
  },
  selected: true,
} as EdgeProps;

jest.mock('../../../context/LineageProvider/LineageProvider', () => ({
  useLineageProvider: jest.fn().mockImplementation(() => ({
    tracedNodes: [],
    tracedColumns: [],
    pipelineStatus: {},
    activeLayer: [LineageLayer.ColumnLevelLineage],
    fetchPipelineStatus: jest.fn(),
    columnsInCurrentPages: [],
  })),
}));

const mockThemeColors: ThemeColors = {
  indigo: {
    600: '#4F46E5',
  },
  error: {
    600: '#D92D20',
  },
} as ThemeColors;

const theme: Theme = createTheme({
  palette: {
    primary: {
      main: '#0958D9',
    },
    allShades: mockThemeColors,
  },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>
    <MemoryRouter>{children}</MemoryRouter>
  </ThemeProvider>
);

const mockLineageProvider = (overrides = {}) => {
  (useLineageProvider as jest.Mock).mockImplementation(() => ({
    tracedNodes: [],
    tracedColumns: [],
    pipelineStatus: {},
    activeLayer: [LineageLayer.ColumnLevelLineage],
    fetchPipelineStatus: jest.fn(),
    columnsInCurrentPages: [],
    ...overrides,
  }));
};

describe('Test CustomEdge Component', () => {
  it('Check if CustomEdge has selected as false', async () => {
    render(<CustomEdge {...mockCustomEdgeProp} selected={false} />, {
      wrapper: Wrapper,
    });

    const deleteButton = screen.queryByTestId('delete-button');

    expect(deleteButton).not.toBeInTheDocument();
  });

  it('Pipeline as edge should be visible', async () => {
    render(
      <CustomEdge
        {...mockCustomEdgeProp}
        data={{
          ...mockCustomEdgeProp.data,
          targetType: EntityType.TABLE,
          label: 'Pipeline',
          pipeline: {
            id: 'pipeline1',
            type: 'pipeline-id',
          },
        }}
      />,
      {
        wrapper: Wrapper,
      }
    );

    const pipelineLabelAsEdge = await screen.findByTestId(
      'pipeline-label-table1-table2'
    );

    expect(pipelineLabelAsEdge).toBeInTheDocument();
  });

  it('should display edge when no nodes or columns are traced', () => {
    render(<CustomEdge {...mockCustomEdgeProp} />, {
      wrapper: Wrapper,
    });

    const edgePath = screen.getByTestId('edge-id1');

    expect(edgePath).toBeInTheDocument();
    expect(edgePath).toHaveStyle({ display: 'block' });
  });

  it('should hide edge when nodes are traced but current edge nodes are not in traced list', () => {
    mockLineageProvider({ tracedNodes: ['other-node-1', 'other-node-2'] });

    render(<CustomEdge {...mockCustomEdgeProp} />, {
      wrapper: Wrapper,
    });

    const edgePath = screen.getByTestId('edge-id1');

    expect(edgePath).toBeInTheDocument();
    expect(edgePath).toHaveStyle({ display: 'none' });
  });

  it('should display edge when both edge nodes are in traced nodes list', () => {
    mockLineageProvider({ tracedNodes: ['1', '2'] });

    render(<CustomEdge {...mockCustomEdgeProp} />, {
      wrapper: Wrapper,
    });

    const edgePath = screen.getByTestId('edge-id1');

    expect(edgePath).toBeInTheDocument();
    expect(edgePath).toHaveStyle({ display: 'block' });
  });

  it('should display column lineage edge when columns are highlighted', () => {
    const encodedSourceHandle = btoa(encodeURIComponent('column1'));
    const encodedTargetHandle = btoa(encodeURIComponent('column2'));

    mockLineageProvider({ tracedColumns: ['column1', 'column2'] });

    render(
      <CustomEdge
        {...mockCustomEdgeProp}
        data={{
          ...mockCustomEdgeProp.data,
          isColumnLineage: true,
          sourceHandle: encodedSourceHandle,
          targetHandle: encodedTargetHandle,
        }}
      />,
      {
        wrapper: Wrapper,
      }
    );

    const edgePath = screen.getByTestId('edge-id1');

    expect(edgePath).toBeInTheDocument();
    expect(edgePath).toHaveStyle({ display: 'block' });
  });

  it('should hide column lineage edge when columns are traced but not highlighted', () => {
    mockLineageProvider({ tracedColumns: ['other-column'] });

    render(
      <CustomEdge
        {...mockCustomEdgeProp}
        data={{
          ...mockCustomEdgeProp.data,
          isColumnLineage: true,
          sourceHandle: 'column1',
          targetHandle: 'column2',
        }}
      />,
      {
        wrapper: Wrapper,
      }
    );

    const edgePath = screen.getByTestId('edge-id1');

    expect(edgePath).toBeInTheDocument();
    expect(edgePath).toHaveStyle({ display: 'none' });
  });

  it('should hide column lineage edge when columns are not in current page', () => {
    mockLineageProvider({ columnsInCurrentPages: ['other-column'] });

    render(
      <CustomEdge
        {...mockCustomEdgeProp}
        data={{
          ...mockCustomEdgeProp.data,
          isColumnLineage: true,
          sourceHandle: 'column1',
          targetHandle: 'column2',
        }}
      />,
      {
        wrapper: Wrapper,
      }
    );

    const edgePath = screen.getByTestId('edge-id1');

    expect(edgePath).toBeInTheDocument();
    expect(edgePath).toHaveStyle({ display: 'none' });
  });

  it('should display column lineage edge when both columns are in current page', () => {
    const encodedSourceHandle = btoa(encodeURIComponent('column1'));
    const encodedTargetHandle = btoa(encodeURIComponent('column2'));

    mockLineageProvider({ columnsInCurrentPages: ['column1', 'column2'] });

    render(
      <CustomEdge
        {...mockCustomEdgeProp}
        data={{
          ...mockCustomEdgeProp.data,
          isColumnLineage: true,
          sourceHandle: encodedSourceHandle,
          targetHandle: encodedTargetHandle,
        }}
      />,
      {
        wrapper: Wrapper,
      }
    );

    const edgePath = screen.getByTestId('edge-id1');

    expect(edgePath).toBeInTheDocument();
    expect(edgePath).toHaveStyle({ display: 'block' });
  });
});
