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

import { act, fireEvent, render, screen } from '@testing-library/react';
import * as useGlossaryStoreModule from '../../../components/Glossary/useGlossary.store';
import { MOCK_GLOSSARY } from '../../../mocks/Glossary.mock';
import { patchGlossaryTerm } from '../../../rest/glossaryAPI';
import GlossaryPage from './GlossaryPage.component';

const mockNavigate = jest.fn();
const mockLocationPathname = '/mock-path';

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'Business Glossary' }),
}));

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    glossaryName: 'GlossaryName',
  }),
  useLocation: jest.fn().mockImplementation(() => ({
    pathname: mockLocationPathname,
  })),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn(() => ({
    paging: {},
    pageSize: 15,
    handlePagingChange: jest.fn(),
  })),
}));

jest.mock('../../../hooks/useElementInView', () => ({
  useElementInView: jest.fn(() => [jest.fn(), false]),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn(() => ({ action: '' })),
}));

jest.mock('../../../components/MyData/LeftSidebar/LeftSidebar.component', () =>
  jest.fn().mockReturnValue(<p>Sidebar</p>)
);

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => {
  return {
    usePermissionProvider: jest.fn(() => ({
      permissions: {
        glossary: { ViewAll: true, ViewBasic: true },
        glossaryTerm: { ViewAll: true, ViewBasic: true },
      },
    })),
  };
});

jest.mock('../../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock('../../../context/AsyncDeleteProvider/AsyncDeleteProvider', () => ({
  useAsyncDeleteProvider: jest.fn(() => ({
    handleOnAsyncEntityDeleteConfirm: jest.fn().mockResolvedValue(undefined),
  })),
}));

const mockSetGlossaries = jest.fn();
const mockSetActiveGlossary = jest.fn();
const mockUpdateActiveGlossary = jest.fn();

jest.mock('../../../components/Glossary/useGlossary.store', () => ({
  useGlossaryStore: jest.fn(() => ({
    glossaries: [MOCK_GLOSSARY],
    setGlossaries: mockSetGlossaries,
    activeGlossary: MOCK_GLOSSARY,
    setActiveGlossary: mockSetActiveGlossary,
    updateActiveGlossary: mockUpdateActiveGlossary,
  })),
}));

jest.mock('../../../components/Glossary/GlossaryV1.component', () => {
  return jest.fn().mockImplementation((props) => (
    <div>
      <p> Glossary.component</p>
      <button
        data-testid="handleGlossaryTermUpdate"
        onClick={() => props.onGlossaryTermUpdate(MOCK_GLOSSARY)}>
        handleGlossaryTermUpdate
      </button>
      <button
        data-testid="handleGlossaryDelete"
        onClick={() => props.onGlossaryDelete(MOCK_GLOSSARY.id)}>
        handleGlossaryDelete
      </button>
      <button
        data-testid="handleGlossaryTermDelete"
        onClick={() => props.onGlossaryTermDelete(MOCK_GLOSSARY.id)}>
        handleGlossaryTermDelete
      </button>
      <button
        data-testid="updateGlossary"
        onClick={() => props.updateGlossary(MOCK_GLOSSARY)}>
        updateGlossary
      </button>
    </div>
  ));
});

jest.mock('../GlossaryLeftPanel/GlossaryLeftPanel.component', () => {
  return jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="glossary-left-panel-container">Left Panel</div>
    ));
});

jest.mock('../../../rest/glossaryAPI', () => ({
  deleteGlossary: jest.fn().mockImplementation(() => Promise.resolve()),
  deleteGlossaryTerm: jest.fn().mockImplementation(() => Promise.resolve()),
  getGlossaryTermByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: MOCK_GLOSSARY })),
  getGlossariesList: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: [MOCK_GLOSSARY],
      paging: { total: 1 },
    })
  ),
  patchGlossaryTerm: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: MOCK_GLOSSARY })),
  patchGlossaries: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: MOCK_GLOSSARY })),
}));

jest.mock(
  '../../../components/common/ResizablePanels/ResizableLeftPanels',
  () =>
    jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
      <div>
        {firstPanel.children}
        {secondPanel.children}
      </div>
    ))
);

jest.mock('../../../components/common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <div>
      {firstPanel.children}
      {secondPanel.children}
    </div>
  ))
);

const mockProps = {
  pageTitle: 'glossary',
};

describe('Test GlossaryComponent page', () => {
  it('GlossaryComponent Page Should render', async () => {
    render(<GlossaryPage {...mockProps} />);

    const glossaryComponent = await screen.findByText(/Glossary.component/i);

    expect(glossaryComponent).toBeInTheDocument();
  });

  it('All Function call should work properly - part 1', async () => {
    render(<GlossaryPage {...mockProps} />);

    const glossaryComponent = await screen.findByText(/Glossary.component/i);

    const updateGlossary = await screen.findByTestId('updateGlossary');

    expect(glossaryComponent).toBeInTheDocument();

    fireEvent.click(updateGlossary);
  });

  it('All Function call should work properly - part 2', async () => {
    render(<GlossaryPage {...mockProps} />);

    const glossaryComponent = await screen.findByText(/Glossary.component/i);

    const handleGlossaryTermUpdate = await screen.findByTestId(
      'handleGlossaryTermUpdate'
    );
    const handleGlossaryTermDelete = await screen.findByTestId(
      'handleGlossaryTermDelete'
    );

    expect(glossaryComponent).toBeInTheDocument();

    fireEvent.click(handleGlossaryTermUpdate);
    fireEvent.click(handleGlossaryTermDelete);
  });

  describe('Render Sad Paths', () => {
    it('show error if patchGlossaryTerm API resolves without data', async () => {
      (patchGlossaryTerm as jest.Mock).mockImplementation(() =>
        Promise.resolve({ data: '' })
      );
      render(<GlossaryPage {...mockProps} />);
      const handleGlossaryTermUpdate = await screen.findByTestId(
        'handleGlossaryTermUpdate'
      );

      expect(handleGlossaryTermUpdate).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(handleGlossaryTermUpdate);
      });
    });
  });

  describe('handleGlossaryDelete', () => {
    it('should update glossaries list and navigate to first remaining glossary after deletion', async () => {
      const secondGlossary = {
        ...MOCK_GLOSSARY,
        id: 'second-glossary-id',
        name: 'Second Glossary',
        fullyQualifiedName: 'Second Glossary',
      };
      (
        useGlossaryStoreModule.useGlossaryStore as unknown as jest.Mock
      ).mockImplementation(() => ({
        glossaries: [MOCK_GLOSSARY, secondGlossary],
        setGlossaries: mockSetGlossaries,
        activeGlossary: MOCK_GLOSSARY,
        setActiveGlossary: mockSetActiveGlossary,
        updateActiveGlossary: mockUpdateActiveGlossary,
      }));

      render(<GlossaryPage {...mockProps} />);

      const handleGlossaryDelete = await screen.findByTestId(
        'handleGlossaryDelete'
      );

      await act(async () => {
        fireEvent.click(handleGlossaryDelete);
      });

      expect(mockSetGlossaries).toHaveBeenLastCalledWith([secondGlossary]);
      expect(mockNavigate).toHaveBeenCalledWith('/glossary/Second%20Glossary');
    });

    it('should navigate to empty glossary path when no glossaries remain after deletion', async () => {
      (
        useGlossaryStoreModule.useGlossaryStore as unknown as jest.Mock
      ).mockImplementation(() => ({
        glossaries: [MOCK_GLOSSARY],
        setGlossaries: mockSetGlossaries,
        activeGlossary: MOCK_GLOSSARY,
        setActiveGlossary: mockSetActiveGlossary,
        updateActiveGlossary: mockUpdateActiveGlossary,
      }));

      render(<GlossaryPage {...mockProps} />);

      const handleGlossaryDelete = await screen.findByTestId(
        'handleGlossaryDelete'
      );

      await act(async () => {
        fireEvent.click(handleGlossaryDelete);
      });

      expect(mockSetGlossaries).toHaveBeenLastCalledWith([]);
      expect(mockNavigate).toHaveBeenCalledWith('/glossary');
    });

    it('should filter out deleted glossary from list', async () => {
      const glossary1 = {
        ...MOCK_GLOSSARY,
        id: 'glossary-1',
        name: 'Glossary 1',
        fullyQualifiedName: 'Glossary 1',
      };
      const glossary2 = {
        ...MOCK_GLOSSARY,
        name: 'Glossary 2',
        fullyQualifiedName: 'Glossary 2',
      };
      const glossary3 = {
        ...MOCK_GLOSSARY,
        id: 'glossary-3',
        name: 'Glossary 3',
        fullyQualifiedName: 'Glossary 3',
      };

      (
        useGlossaryStoreModule.useGlossaryStore as unknown as jest.Mock
      ).mockImplementation(() => ({
        glossaries: [glossary1, glossary2, glossary3],
        setGlossaries: mockSetGlossaries,
        activeGlossary: glossary2,
        setActiveGlossary: mockSetActiveGlossary,
        updateActiveGlossary: mockUpdateActiveGlossary,
      }));

      render(<GlossaryPage {...mockProps} />);

      const handleGlossaryDelete = await screen.findByTestId(
        'handleGlossaryDelete'
      );

      await act(async () => {
        fireEvent.click(handleGlossaryDelete);
      });

      expect(mockSetGlossaries).toHaveBeenLastCalledWith([
        glossary1,
        glossary3,
      ]);
      expect(mockNavigate).toHaveBeenCalledWith('/glossary/Glossary%201');
    });
  });
});
