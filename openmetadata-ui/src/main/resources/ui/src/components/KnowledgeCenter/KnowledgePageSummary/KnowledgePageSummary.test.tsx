import { render, screen } from '@testing-library/react';
import { KnowledgePage, PageType } from 'interface/knowledge-center.interface';
import { MOCK_KNOWLEDGE_PAGE_DATA } from 'pages/KnowledgePage/KnowledgePage.mock';
import { MemoryRouter } from 'react-router-dom';
import KnowledgePageSummary from './KnowledgePageSummary';

jest.mock(
  'components/common/OwnerLabel/OwnerLabel.component',
  () => ({
    OwnerLabel: jest.fn().mockImplementation(() => {
      return <div>OwnerLabel</div>;
    }),
  })
);
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

jest.mock('utils/EntityUtils', () => ({
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

    expect(screen.getByText('CommonEntitySummaryInfo')).toBeInTheDocument();
    expect(screen.getByText('SummaryTagsDescription')).toBeInTheDocument();
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

    expect(screen.getByText('CommonEntitySummaryInfo')).toBeInTheDocument();
    expect(screen.getByText('SummaryTagsDescription')).toBeInTheDocument();
    expect(screen.getByTestId('quick-link-data')).toBeInTheDocument();
  });
});
