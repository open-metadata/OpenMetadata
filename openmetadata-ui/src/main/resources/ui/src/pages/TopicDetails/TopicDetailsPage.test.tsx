import { findByText, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import TopicDetailsPageComponent from './TopicDetailsPage.component';

jest.mock('../../components/TopicDetails/TopicDetails.component', () => {
  return jest.fn().mockReturnValue(<div>TopicDetails.component</div>);
});

jest.mock('../../axiosAPIs/topicsAPI', () => ({
  addFollower: jest.fn(),
  getTopicByFqn: jest.fn().mockImplementation(() => Promise.resolve()),
  patchTopicDetails: jest.fn(),
  removeFollower: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  useParams: jest
    .fn()
    .mockReturnValue({ topicFQN: 'sample_kafka.sales', tab: 'schema' }),
  useHistory: jest.fn(),
}));

describe('Test TopicDetailsPage component', () => {
  it('TopicDetailsPage component should render properly', async () => {
    const { container } = render(<TopicDetailsPageComponent />, {
      wrapper: MemoryRouter,
    });

    const topicDetailComponent = await findByText(
      container,
      /TopicDetails.component/i
    );

    expect(topicDetailComponent).toBeInTheDocument();
  });
});
