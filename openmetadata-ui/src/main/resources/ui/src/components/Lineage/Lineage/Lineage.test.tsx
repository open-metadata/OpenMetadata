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
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { Lineage } from './Lineage';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../rest/lineageAPI', () => ({
  getDataQualityLineage: jest.fn(),
  getLineageDataByFQN: jest.fn(),
  getPlatformLineage: jest.fn(),
  updateLineageEdge: jest.fn(),
  exportLineageAsync: jest.fn(),
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

jest.mock('../../Entity/EntityLineage/EntityLineageSidebar.component', () => ({
  __esModule: true,
  default: () => <div data-testid="entity-lineage-sidebar" />,
}));

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
      'data-testid': dataTestId,
    }: ChildrenProps & { 'data-testid'?: string }) => (
      <button data-testid={dataTestId} type="button">
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

describe('Lineage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLineageStore.getState().reset();
  });

  it('sets entity context on mount and renders overlays', () => {
    render(
      <MemoryRouter>
        <Lineage entityFqn="svc.db.s.t" isPlatformLineage={false} />
      </MemoryRouter>
    );

    expect(useLineageStore.getState().entityFqn).toBe('svc.db.s.t');
    expect(screen.getByTestId('entity-lineage-sidebar')).toBeInTheDocument();
  });
});
