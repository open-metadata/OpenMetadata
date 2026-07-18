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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RelationCategory } from '../../generated/configuration/glossaryTermRelationSettings';
import { getGlossaryTermRelationTypes } from '../../rest/glossaryAPI';
import GlossaryTermRelationSettingsPage from './GlossaryTermRelationSettings';

jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  PaginationCardWithControls: ({
    onPageChange,
  }: {
    onPageChange: (page: number) => void;
  }) => (
    <button data-testid="next-page" onClick={() => onPageChange(2)}>
      Next page
    </button>
  ),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn().mockImplementation(() => <div>TitleBreadcrumb</div>)
);

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock('../../rest/glossaryAPI', () => ({
  createGlossaryTermRelationType: jest.fn(),
  deleteGlossaryTermRelationType: jest.fn(),
  getGlossaryTermRelationTypes: jest.fn(),
  updateGlossaryTermRelationType: jest.fn(),
}));

jest.mock('../../utils/GlobalSettingsUtils', () => ({
  getSettingPageEntityBreadCrumb: jest.fn().mockReturnValue([]),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockGetGlossaryTermRelationTypes =
  getGlossaryTermRelationTypes as jest.MockedFunction<
    typeof getGlossaryTermRelationTypes
  >;

describe('GlossaryTermRelationSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGlossaryTermRelationTypes.mockImplementation(async ({ offset }) => ({
      data: [
        {
          name: `relation${offset ?? 0}`,
          displayName: 'Relation',
          category: RelationCategory.Associative,
        },
      ],
      paging: { limit: 15, offset: offset ?? 0, total: 31 },
    }));
  });

  it('requests only the selected page of relation types', async () => {
    render(<GlossaryTermRelationSettingsPage />);

    expect(await screen.findByText('relation0')).toBeInTheDocument();
    expect(mockGetGlossaryTermRelationTypes).toHaveBeenCalledWith({
      limit: 15,
      offset: 0,
    });

    fireEvent.click(screen.getByTestId('next-page'));

    await waitFor(() =>
      expect(mockGetGlossaryTermRelationTypes).toHaveBeenLastCalledWith({
        limit: 15,
        offset: 15,
      })
    );

    expect(await screen.findByText('relation15')).toBeInTheDocument();
  });
});
