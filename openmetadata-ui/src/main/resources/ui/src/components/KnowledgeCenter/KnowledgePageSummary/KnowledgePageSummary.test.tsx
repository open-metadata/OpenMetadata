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
import { MemoryRouter } from 'react-router-dom';
import {
  KnowledgePage,
  PageType,
} from '../../../interface/knowledge-center.interface';
import { MOCK_KNOWLEDGE_PAGE_DATA } from '../../../pages/KnowledgePage/KnowledgePage.mock';
import KnowledgePageSummary from './KnowledgePageSummary';

jest.mock('components/common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn().mockImplementation(() => {
    return <div>OwnerLabel</div>;
  }),
}));
jest.mock(
  'components/common/SummaryTagsDescription/SummaryTagsDescription.component',
  () =>
    jest.fn().mockImplementation(() => {
      return <div>SummaryTagsDescription</div>;
    })
);
jest.mock(
  'components/Explore/EntitySummaryPanel/CommonEntitySummaryInfo/CommonEntitySummaryInfo',
  () =>
    jest.fn().mockImplementation(() => {
      return <div>CommonEntitySummaryInfo</div>;
    })
);
jest.mock(
  'components/common/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component',
  () =>
    jest.fn().mockImplementation(({ children }) => {
      return <div>{children}</div>;
    })
);

jest.mock('utils/EntityPureUtils', () => ({
  DRAWER_NAVIGATION_OPTIONS: {
    explore: 'Explore',
    lineage: 'Lineage',
  },
}));

const mockData = { ...MOCK_KNOWLEDGE_PAGE_DATA } as unknown as KnowledgePage;

describe('KnowledgePageSummary', () => {
  it('should render correctly', async () => {
    render(<KnowledgePageSummary entityDetails={mockData} />, {
      wrapper: MemoryRouter,
    });

    expect(
      await screen.findByText('CommonEntitySummaryInfo')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('SummaryTagsDescription')
    ).toBeInTheDocument();
  });

  it('should render correctly with quick link', async () => {
    render(
      <KnowledgePageSummary
        entityDetails={{
          ...mockData,
          page: {
            url: 'https://www.google.com',
          },
          pageType: PageType.QUICK_LINK,
        }}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(
      await screen.findByText('CommonEntitySummaryInfo')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('SummaryTagsDescription')
    ).toBeInTheDocument();
    expect(screen.getByTestId('quick-link-data')).toBeInTheDocument();
  });
});
