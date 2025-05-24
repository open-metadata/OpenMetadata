/*
 *  Copyright 2024 Collate.
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
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { userPermissions } from '../../utils/PermissionsUtils';
import ServicesPage from './ServicesPage';

jest.mock(
  '../../components/Settings/Services/Ingestion/IngestionPipelineList/IngestionPipelineList.component',
  () => ({
    IngestionPipelineList: jest
      .fn()
      .mockReturnValue(<>mockIngestionPipelineList</>),
  })
);

jest.mock('../../components/Settings/Services/Services', () => {
  return jest.fn().mockReturnValue(<>mockServices</>);
});

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <>{children}</>);
});

jest.mock(
  '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => {
    return jest.fn().mockReturnValue(<>mockErrorPlaceHolder</>);
  }
);

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    return jest.fn().mockReturnValue(<>mockTitleBreadcrumb</>);
  }
);

const mockEntityPermissions = {
  Create: true,
  Delete: true,
  ViewAll: true,
  ViewBasic: true,
  EditAll: true,
  EditTags: true,
  EditDescription: true,
  EditDisplayName: true,
  EditCustomFields: true,
};

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest
    .fn()
    .mockImplementation(() => ({ permissions: mockEntityPermissions })),
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({
    isAdminUser: true,
  }),
}));

jest.mock('../../utils/GlobalSettingsUtils', () => ({
  getSettingPageEntityBreadCrumb: jest.fn().mockReturnValue({
    getSettingPageEntityBreadCrumb: jest.fn().mockReturnValue([]),
  }),
}));

jest.mock('../../utils/PermissionsUtils', () => ({
  userPermissions: {
    hasViewPermissions: jest.fn().mockReturnValue(true),
  },
}));

describe('ServicesPage', () => {
  it('should render Services tab', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/services/databases']}>
          <Routes>
            <Route element={<ServicesPage />} path="/services/:tab" />
          </Routes>
        </MemoryRouter>
      );
    });

    expect(await screen.findByText('mockServices')).toBeInTheDocument();
  });

  it('should render Pipelines tab', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/services/databases?tab=pipelines']}>
          <Routes>
            <Route element={<ServicesPage />} path="/services/:tab" />
          </Routes>
        </MemoryRouter>
      );
    });

    expect(
      await screen.findByText('mockIngestionPipelineList')
    ).toBeInTheDocument();
  });

  it('should render ErrorPlaceholder when user does not have permission', async () => {
    (userPermissions.hasViewPermissions as jest.Mock).mockImplementationOnce(
      jest.fn().mockReturnValue(false)
    );

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/services/services']}>
          <Routes>
            <Route element={<ServicesPage />} path="/services/:tab" />
          </Routes>
        </MemoryRouter>
      );
    });

    expect(await screen.findByText('mockErrorPlaceHolder')).toBeInTheDocument();
  });
});
