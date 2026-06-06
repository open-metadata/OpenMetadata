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
import React from 'react';
import { useWorkflowModeContext } from '../../../contexts/WorkflowModeContext';
import { EmptyCanvasMessage } from './EmptyCanvasMessage';

jest.mock('../../../contexts/WorkflowModeContext', () => ({
  useWorkflowModeContext: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Card: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="empty-canvas-card">{children}</div>
  ),
  Typography: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

jest.mock('../../../assets/svg/ic_click.svg', () => ({
  ReactComponent: () => <span data-testid="empty-canvas-click-icon" />,
}));

const mockUseWorkflowModeContext =
  useWorkflowModeContext as jest.MockedFunction<typeof useWorkflowModeContext>;

describe('EmptyCanvasMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when the workflow node palette is hidden (OSS)', () => {
    mockUseWorkflowModeContext.mockReturnValue({
      isViewMode: false,
      showWorkflowNodePalette: false,
    } as ReturnType<typeof useWorkflowModeContext>);

    const { container } = render(
      <EmptyCanvasMessage hasNodes={false} isDragging={false} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders the drag-and-drop hint when the palette is visible in edit mode', () => {
    mockUseWorkflowModeContext.mockReturnValue({
      isViewMode: false,
      showWorkflowNodePalette: true,
    } as ReturnType<typeof useWorkflowModeContext>);

    render(<EmptyCanvasMessage hasNodes={false} isDragging={false} />);

    expect(
      screen.getByText('label.drag-and-drop-the-nodes-here')
    ).toBeInTheDocument();
    expect(screen.getByTestId('empty-canvas-card')).toBeInTheDocument();
  });
});
