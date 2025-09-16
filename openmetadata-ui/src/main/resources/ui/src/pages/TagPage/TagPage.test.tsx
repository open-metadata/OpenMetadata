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

import { render, waitFor } from '@testing-library/react';
import { useFqn } from '../../hooks/useFqn';
import { searchData } from '../../rest/miscAPI';
import { getTagByFqn } from '../../rest/tagAPI';
import TagPage from './TagPage';

jest.mock('../../rest/tagAPI', () => ({
  getTagByFqn: jest.fn().mockResolvedValue({
    name: 'NonSensitive',
    fullyQualifiedName: 'PII.NonSensitive',
  }),
}));

jest.mock('../../rest/miscAPI', () => ({
  searchData: jest.fn().mockResolvedValue({
    data: {
      hits: {
        total: { value: 0 },
      },
    },
  }),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn(),
}));

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
  useParams: jest.fn().mockReturnValue({ fqn: 'PII.NonSensitive' }),
  useLocation: jest
    .fn()
    .mockReturnValue({ pathname: '/tags/PII.NonSensitive' }),
}));

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermission: jest.fn().mockResolvedValue({
      Create: true,
      Delete: true,
      ViewAll: true,
      EditAll: true,
      EditDescription: true,
      EditDisplayName: true,
      EditCustomFields: true,
    }),
  }),
}));

jest.mock(
  '../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => ({
    useActivityFeedProvider: jest.fn().mockReturnValue({
      postFeed: jest.fn(),
      deleteFeed: jest.fn(),
      updateFeed: jest.fn(),
    }),
    __esModule: true,
    default: 'ActivityFeedProvider',
  })
);

jest.mock(
  '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component',
  () => ({
    ActivityFeedTab: jest.fn().mockImplementation(() => <>ActivityFeedTab</>),
  })
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    return jest.fn().mockImplementation(() => <div>TitleBreadcrumb</div>);
  }
);

jest.mock('../../components/common/EntityDescription/DescriptionV1', () => {
  return jest.fn().mockImplementation(() => <div>DescriptionV1</div>);
});

jest.mock('../../components/common/DomainLabel/DomainLabel.component', () => ({
  DomainLabel: jest.fn().mockImplementation(() => <div>DomainLabel</div>),
}));

jest.mock('../../components/common/ResizablePanels/ResizablePanels', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock(
  '../../components/Entity/EntityHeader/EntityHeader.component',
  () => ({
    EntityHeader: jest.fn().mockImplementation(() => <div>EntityHeader</div>),
  })
);

jest.mock(
  '../../components/Explore/EntitySummaryPanel/EntitySummaryPanel.component',
  () => {
    return jest.fn().mockImplementation(() => <div>EntitySummaryPanel</div>);
  }
);

jest.mock(
  '../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.component',
  () => {
    return jest.fn().mockImplementation(() => <div>AssetsTabs</div>);
  }
);

jest.mock('../../components/Modals/EntityDeleteModal/EntityDeleteModal', () => {
  return jest.fn().mockImplementation(() => <div>EntityDeleteModal</div>);
});

jest.mock(
  '../../components/Modals/EntityNameModal/EntityNameModal.component',
  () => {
    return jest.fn().mockImplementation(() => <div>EntityNameModal</div>);
  }
);

jest.mock('../../components/Modals/StyleModal/StyleModal.component', () => {
  return jest.fn().mockImplementation(() => <div>StyleModal</div>);
});

jest.mock(
  '../../components/DataAssets/AssetsSelectionModal/AssetSelectionModal',
  () => ({
    AssetSelectionModal: jest
      .fn()
      .mockImplementation(() => <div>AssetSelectionModal</div>),
  })
);

describe('TagPage', () => {
  it('should call getTagData and fetchClassificationTagAssets when tagFqn changes', async () => {
    (useFqn as jest.Mock).mockReturnValue({ fqn: 'PII.NonSensitive' });

    const { rerender } = render(<TagPage />);

    // Verify initial API calls
    await waitFor(() => {
      expect(getTagByFqn).toHaveBeenCalledWith('PII.NonSensitive', {
        fields: ['domains', 'owners'],
      });
      expect(searchData).toHaveBeenCalled();
    });

    jest.clearAllMocks();

    // Change FQN
    (useFqn as jest.Mock).mockReturnValue({ fqn: 'Certification.Gold' });

    (getTagByFqn as jest.Mock).mockResolvedValueOnce({
      name: 'Gold',
      fullyQualifiedName: 'Certification.Gold',
    });

    rerender(<TagPage />);

    await waitFor(() => {
      expect(getTagByFqn).toHaveBeenCalledWith('Certification.Gold', {
        fields: ['domains', 'owners'],
      });
      expect(searchData).toHaveBeenCalled();
    });
  });
});
