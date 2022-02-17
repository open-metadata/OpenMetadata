import { act, findByText, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import PipelineDetailsPage from './PipelineDetailsPage.component';

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useParams: jest.fn().mockReturnValue({
    pipelineFQN: 'sample_airflow.snowflake_etl',
    tab: 'details',
  }),
}));

jest.mock('../../axiosAPIs/lineageAPI', () => ({
  getLineageByFQN: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../axiosAPIs/miscAPI', () => ({
  addLineage: jest.fn(),
  deleteLineageEdge: jest.fn(),
}));

jest.mock('../../axiosAPIs/pipelineAPI', () => ({
  addFollower: jest.fn(),
  patchPipelineDetails: jest.fn(),
  removeFollower: jest.fn(),
  getPipelineByFqn: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../components/PipelineDetails/PipelineDetails.component', () => {
  return jest.fn().mockReturnValue(<div>PipelineDetails.component</div>);
});

jest.mock(
  '../../components/common/error-with-placeholder/ErrorPlaceHolder',
  () => {
    return jest.fn().mockReturnValue(<div>ErrorPlaceHolder.component</div>);
  }
);

describe('Test PipelineDetailsPage component', () => {
  it('PipelineDetailsPage component should render properly', async () => {
    const { container } = render(<PipelineDetailsPage />, {
      wrapper: MemoryRouter,
    });

    await act(async () => {
      const PipelineDetails = await findByText(
        container,
        /PipelineDetails.component/i
      );

      expect(PipelineDetails).toBeInTheDocument();
    });
  });
});
