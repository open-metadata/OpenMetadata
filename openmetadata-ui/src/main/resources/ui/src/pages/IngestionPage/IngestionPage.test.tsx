import { findByText, render } from '@testing-library/react';
import React from 'react';
import IngestionPage from './IngestionPage.component';
import { mockIngestionWorkFlow, mockService } from './IngestionPage.mock';

jest.mock('../../components/Ingestion/Ingestion.component', () => {
  return jest.fn().mockReturnValue(<p>Ingestion Component</p>);
});

jest.mock('../../axiosAPIs/serviceAPI', () => ({
  getServices: jest.fn().mockImplementation(() => Promise.resolve(mockService)),
}));

jest.mock('../../axiosAPIs/ingestionWorkflowAPI', () => ({
  addIngestionWorkflow: jest.fn(),
  deleteIngestionWorkflowsById: jest
    .fn()
    .mockImplementation(() => Promise.resolve()),
  getIngestionWorkflows: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockIngestionWorkFlow)),
  triggerIngestionWorkflowsById: jest
    .fn()
    .mockImplementation(() => Promise.resolve()),
  updateIngestionWorkflow: jest.fn(),
}));

describe('Test Ingestion page', () => {
  it('Page Should render', async () => {
    const { container } = render(<IngestionPage />);

    const ingestionPage = await findByText(container, /Ingestion Component/i);

    expect(ingestionPage).toBeInTheDocument();
  });
});
