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
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { DataAssetsHeaderProps } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { EntityType } from '../../enums/entity.enum';
import { Persona } from '../../generated/entity/teams/persona';
import { Page, PageType } from '../../generated/system/ui/page';
import { useCustomizeStore } from '../CustomizablePage/CustomizeStore';
import { CustomizeDetailsPage } from './CustomizeDetailsPage';

const savedPage = {
  pageType: PageType.Table,
  tabs: [],
  entityHeader: { properties: ['owners', 'tier'] },
} as unknown as Page;
const mockUpdateCurrentPage = jest.fn();
const mockOnSaveLayout = jest.fn().mockResolvedValue(undefined);

jest.mock('../CustomizablePage/CustomizeStore', () => ({
  useCustomizeStore: jest.fn(),
}));

jest.mock(
  '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component',
  () => ({
    DataAssetsHeader: jest
      .fn()
      .mockImplementation(({ onEntityHeaderChange }: DataAssetsHeaderProps) => (
        <>
          <button
            data-testid="apply-header"
            onClick={() => onEntityHeaderChange?.({ properties: ['tier'] })}>
            header
          </button>
          <button
            data-testid="reset-header"
            onClick={() => onEntityHeaderChange?.(undefined)}>
            reset
          </button>
        </>
      )),
  })
);

jest.mock(
  '../../components/MyData/CustomizableComponents/CustomizablePageHeader/CustomizablePageHeader',
  () => ({
    CustomizablePageHeader: ({
      disableSave,
      onSave,
    }: {
      disableSave?: boolean;
      onSave: () => Promise<void>;
    }) => (
      <button data-testid="save-page" disabled={disableSave} onClick={onSave}>
        save
      </button>
    ),
  })
);

jest.mock(
  '../../components/Customization/CustomizeTabWidget/CustomizeTabWidget',
  () => ({ CustomizeTabWidget: () => null })
);

jest.mock(
  '../../components/common/NavigationBlocker/NavigationBlocker',
  () => ({
    NavigationBlocker: ({ children }: { children: ReactNode }) => children,
  })
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => children)
);

jest.mock('../../hooks/useGridLayoutDirection', () => ({
  useGridLayoutDirection: jest.fn(),
}));

jest.mock('../../utils/CustomizePage/CustomizePageDispatchUtils', () => ({
  getDummyDataByPage: jest.fn().mockReturnValue({}),
}));

const mockStore = (currentPage: Page) =>
  (useCustomizeStore as unknown as jest.Mock).mockReturnValue({
    currentPage,
    currentPageType: PageType.Table,
    getPage: () => savedPage,
    updateCurrentPage: mockUpdateCurrentPage,
  });

const renderPage = () =>
  render(
    <CustomizeDetailsPage
      initialPageData={savedPage}
      personaDetails={{ name: 'analyst', displayName: 'Analyst' } as Persona}
      onSaveLayout={mockOnSaveLayout}
    />
  );

describe('CustomizeDetailsPage entity header', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore(savedPage);
  });

  it('edits the draft header of the persona on the Table preview', () => {
    renderPage();

    expect(DataAssetsHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        isCustomizedView: true,
        entityType: EntityType.TABLE,
        entityHeader: savedPage.entityHeader,
        personaName: 'Analyst',
      }),
      expect.anything()
    );
  });

  it('writes an applied header into the draft page and keeps its tabs', () => {
    renderPage();

    fireEvent.click(screen.getByTestId('apply-header'));

    expect(mockUpdateCurrentPage).toHaveBeenCalledWith({
      ...savedPage,
      entityHeader: { properties: ['tier'] },
    });
  });

  it('drops the header from the draft page when it is reset to the default', () => {
    renderPage();

    fireEvent.click(screen.getByTestId('reset-header'));

    expect(mockUpdateCurrentPage).toHaveBeenCalledWith({
      pageType: PageType.Table,
      tabs: [],
    });
  });

  it('saves a page whose only change is its header', () => {
    const editedPage = { ...savedPage, entityHeader: { properties: ['tier'] } };
    mockStore(editedPage);
    renderPage();

    const save = screen.getByTestId('save-page');

    expect(save).toBeEnabled();

    fireEvent.click(save);

    expect(mockOnSaveLayout).toHaveBeenCalledWith(editedPage);
  });

  it('keeps Save off while the header is unchanged', () => {
    renderPage();

    expect(screen.getByTestId('save-page')).toBeDisabled();
  });
});
