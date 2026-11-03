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
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { getTestSuiteByName } from '../../rest/testAPI';
import TestSuiteIngestionRedirect from './TestSuiteIngestionRedirect';

jest.mock('../../rest/testAPI', () => ({
  getTestSuiteByName: jest.fn(),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: () => ({ fqn: 'requested.suite' }),
}));

jest.mock('../../components/common/Loader/Loader', () =>
  jest.fn(() => <div data-testid="loader" />)
);

jest.mock('../../utils/ObservabilityRouterClassBase', () => ({
  __esModule: true,
  default: { getDataQualityPagePath: () => '/data-quality' },
}));

const Landing = () => {
  const { pathname, search } = useLocation();

  return <div data-testid="landing">{`${pathname}${search}`}</div>;
};

const renderRedirect = () =>
  render(
    <MemoryRouter
      initialEntries={['/test-suites/requested.suite/add-ingestion']}>
      <Routes>
        <Route
          element={<TestSuiteIngestionRedirect />}
          path="/test-suites/:fqn/add-ingestion"
        />
        <Route element={<Landing />} path="*" />
      </Routes>
    </MemoryRouter>
  );

describe('TestSuiteIngestionRedirect', () => {
  it("sends a table's suite to that table's Pipelines tab", async () => {
    (getTestSuiteByName as jest.Mock).mockResolvedValue({
      basic: true,
      fullyQualifiedName: 'svc.db.schema.orders.testSuite',
      basicEntityReference: {
        id: 't',
        type: 'table',
        fullyQualifiedName: 'svc.db.schema.orders',
      },
    });

    renderRedirect();

    expect(await screen.findByTestId('landing')).toHaveTextContent(
      /\/table\/svc\.db\.schema\.orders\/profiler\/data-quality\?qualityTab=pipeline$/
    );
    expect(getTestSuiteByName).toHaveBeenCalledWith('requested.suite');
  });

  it('sends a bundle suite to its own page', async () => {
    (getTestSuiteByName as jest.Mock).mockResolvedValue({
      basic: false,
      fullyQualifiedName: 'nightly_bundle',
    });

    renderRedirect();

    expect(await screen.findByTestId('landing')).toHaveTextContent(
      /^\/test-suites\/nightly_bundle$/
    );
  });

  it('falls back to the Data Quality page when the suite cannot be loaded', async () => {
    (getTestSuiteByName as jest.Mock).mockRejectedValue(new Error('404'));

    renderRedirect();

    expect(await screen.findByTestId('landing')).toHaveTextContent(
      /^\/data-quality$/
    );
  });
});
