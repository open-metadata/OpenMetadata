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
import { Classification } from '../../../generated/entity/classification/classification';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import { getTags } from '../../../rest/tagAPI';
import {
  cursorPage,
  CursorRequest,
  expectCursorPaging,
} from '../../../test/unit/pagingScenarios';
import ClassificationDetails from './ClassificationDetails';

jest.mock(
  '../../common/Table/TableV2',
  () => jest.requireActual('../../../test/unit/pagingScenarios').TableV2Stub
);

jest.mock('../../../rest/tagAPI', () => ({
  getTags: jest.fn(),
  exportClassificationInCSVFormat: jest.fn(),
}));

jest.mock('./useTagUsageCounts', () => ({
  useTagUsageCounts: jest
    .fn()
    .mockReturnValue({ usageCounts: {}, isUsageCountsLoading: false }),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'PaginationClassification' }),
}));

jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn().mockReturnValue({ entityRules: {} }),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({ permissions: {} }),
}));

jest.mock(
  '../../Entity/EntityExportModalProvider/EntityExportModalProvider.component',
  () => ({
    useEntityExportModalProvider: jest
      .fn()
      .mockReturnValue({ showModal: jest.fn() }),
  })
);

jest.mock('../../common/DomainLabel/useGenericDomainLabel', () => ({
  useGenericDomainLabel: jest.fn().mockReturnValue({}),
}));

jest.mock('../../common/DomainLabel/DomainLabel.component', () => ({
  DomainLabel: jest.fn().mockReturnValue(null),
}));

jest.mock('../../common/EntityDescription/Description', () =>
  jest.fn().mockReturnValue(null)
);

jest.mock('../../common/EntityPageInfos/ManageButton/ManageButton', () =>
  jest.fn().mockReturnValue(null)
);

jest.mock('../../common/WidgetCard/WidgetCard', () =>
  jest.fn().mockReturnValue(null)
);

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  GenericProvider: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
}));

jest.mock('../../../utils/ClassificationUtils', () => ({
  getClassificationExtraDropdownContent: jest.fn().mockReturnValue([]),
  getTagsTableColumn: jest.fn().mockReturnValue([]),
}));

const classification: Classification = {
  id: 'classification-id',
  name: 'PaginationClassification',
  fullyQualifiedName: 'PaginationClassification',
  description: '',
};

const mockGetTags = getTags as jest.Mock;

const lastListRequest = () =>
  mockGetTags.mock.calls.at(-1)?.[0] as CursorRequest | undefined;

describe('ClassificationDetails tags pagination', () => {
  beforeEach(() => {
    mockGetTags.mockImplementation(async (req: CursorRequest) =>
      cursorPage(req)
    );
  });

  it('pages tags by cursor and keeps the page across a reload', async () => {
    await expectCursorPaging({
      url: '/tags/PaginationClassification',
      ui: (
        <ClassificationDetails
          classificationPermissions={ENTITY_PERMISSIONS}
          currentClassification={classification}
          handleAfterDeleteAction={jest.fn()}
        />
      ),
      lastListRequest,
    });
  });
});
