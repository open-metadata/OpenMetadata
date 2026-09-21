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
import { ReactNode } from 'react';
import { Edge } from 'reactflow';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { LineageOverlays, LineageOverlaysHandlers } from './LineageOverlays';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () => ({
  __esModule: true,
  default: () => ({ search: '' }),
}));

jest.mock('../../Entity/EntityInfoDrawer/EdgeInfoDrawer.component', () => ({
  __esModule: true,
  default: () => <div data-testid="edge-info-drawer" />,
}));

jest.mock(
  '../../Entity/EntityLineage/AppPipelineModel/AddPipeLineModal',
  () => ({
    __esModule: true,
    default: () => <div data-testid="add-pipeline-modal" />,
  })
);

jest.mock('@openmetadata/ui-core-components', () => {
  type ChildrenProps = { children?: ReactNode };

  const DialogComponent = ({
    children,
    'data-testid': dataTestId,
  }: ChildrenProps & { 'data-testid'?: string }) => (
    <div data-testid={dataTestId} role="dialog">
      {children}
    </div>
  );
  DialogComponent.Header = ({ title }: { title?: ReactNode }) => (
    <div>{title}</div>
  );
  DialogComponent.Content = ({ children }: ChildrenProps) => (
    <div>{children}</div>
  );
  DialogComponent.Footer = ({ children }: ChildrenProps) => (
    <div>{children}</div>
  );

  return {
    Button: ({
      children,
      onPress,
      'data-testid': dataTestId,
    }: ChildrenProps & {
      onPress?: () => void;
      'data-testid'?: string;
    }) => (
      <button data-testid={dataTestId} type="button" onClick={onPress}>
        {children}
      </button>
    ),
    Dialog: DialogComponent,
    Modal: ({ children }: ChildrenProps) => <>{children}</>,
    ModalOverlay: ({
      isOpen,
      children,
    }: ChildrenProps & { isOpen?: boolean }) =>
      isOpen ? <>{children}</> : null,
    SlideoutMenu: ({ children }: ChildrenProps) => <>{children}</>,
  };
});

const mockEdge = {
  id: 'edge-1',
  source: 'source-node',
  target: 'target-node',
  data: {
    edge: {
      fromEntity: {
        id: 'source-entity',
        type: 'table',
        fullyQualifiedName: 'service.db.schema.source_table',
      },
      toEntity: {
        id: 'target-entity',
        type: 'table',
        fullyQualifiedName: 'service.db.schema.target_table',
      },
    },
  },
} as unknown as Edge;

const mockHandlers: LineageOverlaysHandlers = {
  onConfirmDelete: jest.fn(),
  onConfirmAddEdge: jest.fn(),
  onEntityUpdate: jest.fn(),
  onCloseDrawer: jest.fn(),
};

describe('LineageOverlays', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLineageStore.getState().reset();
  });

  it('renders the delete modal when showDeleteModal is true', () => {
    useLineageStore.setState({ showDeleteModal: true, selectedEdge: mockEdge });

    render(<LineageOverlays handlers={mockHandlers} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls handlers.onConfirmDelete when the delete-confirm button is clicked', () => {
    useLineageStore.setState({ showDeleteModal: true, selectedEdge: mockEdge });

    render(<LineageOverlays handlers={mockHandlers} />);

    fireEvent.click(screen.getByTestId('confirm-button'));

    expect(mockHandlers.onConfirmDelete).toHaveBeenCalledTimes(1);
  });
});
