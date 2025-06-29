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
import { useFqn } from '../../hooks/useFqn';
import { getIngestionPipelineByFqn } from '../../rest/ingestionPipelineAPI';
import { getTestSuiteByName } from '../../rest/testAPI';
import i18n from '../../utils/i18next/LocalUtil';
import TestSuiteIngestionPage from './TestSuiteIngestionPage';

const mockTestSuite = {
  id: '58e37b60-aa4f-4228-8cb7-89fe659fa14b',
  name: 'sample_data.ecommerce_db.shopify.dim_address.testSuite',
  fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address.testSuite',
  description: 'This is an basic test suite linked to an entity',
  serviceType: 'TestSuite',
  deleted: false,
  basic: true,
  basicEntityReference: {
    id: '8f7c814f-d6ca-4ce2-911e-d7f3586c955b',
    type: 'table',
    name: 'dim_address',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
  },
  testCaseResultSummary: [],
};

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock('../../hooks/useFqn', () => {
  return {
    useFqn: jest.fn().mockReturnValue({
      fqn: 'testSuiteFQN',
    }),
  };
});

jest.mock('../../rest/testAPI', () => {
  return {
    getTestSuiteByName: jest
      .fn()
      .mockImplementation(() => Promise.resolve(mockTestSuite)),
  };
});
jest.mock('../../rest/ingestionPipelineAPI', () => {
  return {
    getIngestionPipelineByFqn: jest
      .fn()
      .mockImplementation(() => Promise.resolve({})),
  };
});
jest.mock('../../components/common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </>
  ))
);
jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockReturnValue(<div>ErrorPlaceHolder.component</div>)
);
jest.mock('../../components/common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div>Loader.component</div>)
);
jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn().mockReturnValue(<div>TitleBreadcrumb.component</div>)
);
jest.mock(
  '../../components/DataQuality/AddDataQualityTest/TestSuiteIngestion',
  () =>
    jest.fn().mockImplementation(({ onCancel }) => (
      <div>
        <p>TestSuiteIngestion.component</p>
        <button data-testid="back-btn" onClick={onCancel}>
          Back
        </button>
      </div>
    ))
);
jest.mock(
  '../../components/DataQuality/AddDataQualityTest/components/RightPanel',
  () => jest.fn().mockReturnValue(<div>RightPanel.component</div>)
);

describe('TestSuiteIngestionPage', () => {
  it('should render component', async () => {
    await act(async () => {
      render(
        <TestSuiteIngestionPage
          pageTitle={i18n.t('label.add-entity', {
            entity: i18n.t('label.test-suite'),
          })}
        />
      );
    });

    expect(
      await screen.findByText('TitleBreadcrumb.component')
    ).toBeInTheDocument();
    expect(await screen.findByText('RightPanel.component')).toBeInTheDocument();
  });

  it('should render loading state', async () => {
    (getTestSuiteByName as jest.Mock).mockResolvedValueOnce(mockTestSuite);
    render(
      <TestSuiteIngestionPage
        pageTitle={i18n.t('label.add-entity', {
          entity: i18n.t('label.test-suite'),
        })}
      />
    );

    expect(screen.getByText('Loader.component')).toBeInTheDocument();
  });

  it('should render error placeholder', async () => {
    (getTestSuiteByName as jest.Mock).mockImplementationOnce(() =>
      Promise.reject(new Error('Error'))
    );

    await act(async () => {
      render(
        <TestSuiteIngestionPage
          pageTitle={i18n.t('label.add-entity', {
            entity: i18n.t('label.test-suite'),
          })}
        />
      );
    });

    expect(
      await screen.findByText('ErrorPlaceHolder.component')
    ).toBeInTheDocument();
  });

  it("should fetch ingestion details if ingestionFQN is present in URL's query params", async () => {
    (useFqn as jest.Mock).mockImplementationOnce(() => ({
      fqn: 'testSuiteFQN',
      ingestionFQN: 'ingestionFQN',
    }));
    getIngestionPipelineByFqn as jest.Mock;

    await act(async () => {
      render(
        <TestSuiteIngestionPage
          pageTitle={i18n.t('label.add-entity', {
            entity: i18n.t('label.test-suite'),
          })}
        />
      );
    });

    expect(getIngestionPipelineByFqn).toHaveBeenCalledWith('ingestionFQN');
  });
});
