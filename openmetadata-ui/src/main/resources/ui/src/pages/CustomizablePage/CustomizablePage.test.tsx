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
import { useParams } from 'react-router-dom';
import { Page, PageType } from '../../generated/system/ui/page';
import {
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
  '../../components/MyData/CustomizableComponents/CustomizeMyData/CustomizeMyData',
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

jest.mock('../../components/common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader</div>);
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
  useNavigate: jest.fn(),
}));

jest.mock('./CustomizeStore', () => ({
  useCustomizeStore: jest.fn().mockImplementation(() => ({
    document: mockDocumentData,
    setDocument: jest.fn(),
    getNavigation: jest.fn(),
    currentPage: {} as Page,
    getPage: jest.fn(),
    setCurrentPageType: jest.fn(),
  })),
}));

jest.mock(
  '../../components/MyData/CustomizableComponents/CustomizeMyData/CustomizeMyData',
  () => {
    return jest.fn().mockImplementation(() => <div>CustomizeMyData</div>);
  }
);

jest.mock(
  '../../components/MyData/CustomizableComponents/CustomiseGlossaryTermDetailPage/CustomiseGlossaryTermDetailPage',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>CustomizeGlossaryTermDetailPage</div>);
  }
);

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
    render(<CustomizablePage />);

    expect(await screen.findByText('Loader')).toBeInTheDocument();
    expect(screen.queryByText('ErrorPlaceHolder')).toBeNull();
    expect(screen.queryByTestId('CustomizeMyData')).toBeNull();
  });

  it('CustomizablePage should pass the correct page layout data for the persona', async () => {
    await act(async () => {
      render(<CustomizablePage />);
    });

    expect(screen.getByText('CustomizeMyData')).toBeInTheDocument();
    expect(screen.queryByText('ErrorPlaceHolder')).toBeNull();
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

    expect(screen.queryByText('CustomizeMyData')).toBeInTheDocument();
    expect(screen.queryByText('ErrorPlaceHolder')).toBeNull();
  });

  it('CustomizablePage should return ErrorPlaceHolder for invalid page FQN', async () => {
    (useParams as jest.Mock).mockImplementation(() => ({
      fqn: mockPersonaName,
      pageFqn: 'invalidName',
    }));

    await act(async () => {
      render(<CustomizablePage />);
    });

    expect(screen.queryByText('ErrorPlaceHolder')).toBeInTheDocument();
    expect(screen.queryByText('Loader')).toBeNull();
    expect(screen.queryByTestId('customize-my-data')).toBeNull();
  });
});
