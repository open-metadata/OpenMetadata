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

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { useParams } from 'react-router-dom';
import { LandingPageWidgetKeys } from '../../enums/CustomizablePage.enum';
import { PageType } from '../../generated/system/ui/page';
import {
  mockCustomizePageClassBase,
  mockDocumentData,
  mockPersonaDetails,
  mockPersonaName,
  mockShowErrorToast,
  mockShowSuccessToast,
} from '../../mocks/CustomizablePage.mock';
import { getDocumentByFQN } from '../../rest/DocStoreAPI';
import { getPersonaByName } from '../../rest/PersonaAPI';
import { CustomizablePage } from './CustomizablePage';
import { WidgetConfig } from './CustomizablePage.interface';

jest.mock(
  '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => {
    return jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>);
  }
);

jest.mock(
  '../../components/CustomizableComponents/CustomizeMyData/CustomizeMyData',
  () =>
    jest
      .fn()
      .mockImplementation(
        ({ initialPageData, handleSaveCurrentPageLayout }) => (
          <div data-testid="customize-my-data">
            {initialPageData.data.page.layout.map((widget: WidgetConfig) => (
              <div key={widget.i}>{widget.i}</div>
            ))}
            <div onClick={handleSaveCurrentPageLayout}>
              handleSaveCurrentPageLayout
            </div>
          </div>
        )
      )
);

jest.mock('../../components/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader</div>);
});

jest.mock('../../utils/CustomizePageClassBase', () => {
  return mockCustomizePageClassBase;
});

jest.mock('../../rest/DocStoreAPI', () => ({
  createDocument: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockDocumentData)),
  getDocumentByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockDocumentData)),
  updateDocument: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockDocumentData)),
}));

jest.mock('../../rest/PersonaAPI', () => ({
  getPersonaByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockPersonaDetails)),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: mockShowErrorToast,
  showSuccessToast: mockShowSuccessToast,
}));

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => ({
    fqn: mockPersonaName,
    pageFqn: PageType.LandingPage,
  })),
  Link: jest.fn().mockImplementation(() => <div>Link</div>),
}));

describe('CustomizablePage component', () => {
  it('CustomizablePage should show ErrorPlaceholder if the API to fetch the persona details fails', async () => {
    (getPersonaByName as jest.Mock).mockImplementationOnce(() =>
      Promise.reject(new Error('API failure'))
    );
    await act(async () => {
      render(<CustomizablePage />);
    });

    expect(screen.getByText('ErrorPlaceHolder')).toBeInTheDocument();
    expect(screen.queryByTestId('customize-my-data')).toBeNull();
  });

  it('CustomizablePage should show Loader while the layout is being fetched', async () => {
    await act(async () => {
      render(<CustomizablePage />);

      expect(screen.getByText('Loader')).toBeInTheDocument();
      expect(screen.queryByText('ErrorPlaceHolder')).toBeNull();
      expect(screen.queryByTestId('customize-my-data')).toBeNull();
    });
  });

  it('CustomizablePage should pass the correct page layout data for the persona', async () => {
    await act(async () => {
      render(<CustomizablePage />);
    });

    expect(screen.getByTestId('customize-my-data')).toBeInTheDocument();
    expect(screen.queryByText('ErrorPlaceHolder')).toBeNull();
    expect(
      screen.getByText(LandingPageWidgetKeys.ACTIVITY_FEED)
    ).toBeInTheDocument();
    expect(
      screen.getByText(LandingPageWidgetKeys.FOLLOWING)
    ).toBeInTheDocument();
    expect(
      screen.getByText(LandingPageWidgetKeys.RECENTLY_VIEWED)
    ).toBeInTheDocument();
    expect(screen.queryByText(LandingPageWidgetKeys.MY_DATA)).toBeNull();
    expect(screen.queryByText(LandingPageWidgetKeys.KPI)).toBeNull();
    expect(
      screen.queryByText(LandingPageWidgetKeys.TOTAL_DATA_ASSETS)
    ).toBeNull();
  });

  it('CustomizablePage should pass the default layout data when no layout is present for the persona', async () => {
    (getDocumentByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({
        response: {
          status: 404,
        },
      })
    );
    await act(async () => {
      render(<CustomizablePage />);
    });

    expect(screen.getByTestId('customize-my-data')).toBeInTheDocument();
    expect(screen.queryByText('ErrorPlaceHolder')).toBeNull();
    expect(
      screen.getByText(LandingPageWidgetKeys.ACTIVITY_FEED)
    ).toBeInTheDocument();
    expect(
      screen.getByText(LandingPageWidgetKeys.FOLLOWING)
    ).toBeInTheDocument();
    expect(
      screen.getByText(LandingPageWidgetKeys.RECENTLY_VIEWED)
    ).toBeInTheDocument();
    expect(screen.getByText(LandingPageWidgetKeys.MY_DATA)).toBeInTheDocument();
    expect(screen.getByText(LandingPageWidgetKeys.KPI)).toBeInTheDocument();
    expect(
      screen.getByText(LandingPageWidgetKeys.TOTAL_DATA_ASSETS)
    ).toBeInTheDocument();
  });

  it('CustomizablePage should update the layout when layout data is present for persona', async () => {
    await act(async () => {
      render(<CustomizablePage />);
    });

    const saveCurrentPageLayoutBtn = screen.getByText(
      'handleSaveCurrentPageLayout'
    );

    await act(async () => {
      userEvent.click(saveCurrentPageLayoutBtn);
    });

    expect(mockShowSuccessToast).toHaveBeenCalledWith(
      'server.page-layout-operation-success'
    );
  });

  it('CustomizablePage should save the layout when no layout data present for persona', async () => {
    (getDocumentByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({
        response: {
          status: 404,
        },
      })
    );
    await act(async () => {
      render(<CustomizablePage />);
    });

    const saveCurrentPageLayoutBtn = screen.getByText(
      'handleSaveCurrentPageLayout'
    );

    await act(async () => {
      userEvent.click(saveCurrentPageLayoutBtn);
    });

    expect(mockShowSuccessToast).toHaveBeenCalledWith(
      'server.page-layout-operation-success'
    );
  });

  it('CustomizablePage should return null for invalid page FQN', async () => {
    (useParams as jest.Mock).mockImplementation(() => ({
      fqn: mockPersonaName,
      pageFqn: 'invalidName',
    }));

    await act(async () => {
      render(<CustomizablePage />);
    });

    expect(screen.queryByText('ErrorPlaceHolder')).toBeNull();
    expect(screen.queryByText('Loader')).toBeNull();
    expect(screen.queryByTestId('customize-my-data')).toBeNull();
  });
});
