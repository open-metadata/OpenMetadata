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
import { getContract } from '../../rest/contractAPI';
import DataContractRedirectPage from './DataContractRedirectPage';

const CONTRACT_FQN = 'svc.db.schema.dataContract_Schema Contract';

jest.mock('../../hooks/useFqn', () => ({
  useFqn: () => ({ fqn: CONTRACT_FQN }),
}));

jest.mock('../../rest/contractAPI', () => ({
  getContract: jest.fn(),
}));

jest.mock('../../components/common/Loader/Loader', () => () => (
  <div>Loader</div>
));

const Location = () => <div>{useLocation().pathname}</div>;

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/dataContract/contract']}>
      <Routes>
        <Route element={<DataContractRedirectPage />} path="/dataContract/*" />
        <Route element={<Location />} path="*" />
      </Routes>
    </MemoryRouter>
  );

describe('DataContractRedirectPage', () => {
  it("redirects to the contract's asset Contract tab", async () => {
    (getContract as jest.Mock).mockResolvedValue({
      name: 'Schema Contract',
      entity: { type: 'databaseSchema', fullyQualifiedName: 'svc.db.schema' },
    });

    renderPage();

    expect(
      await screen.findByText('/databaseSchema/svc.db.schema/contract')
    ).toBeInTheDocument();
    expect(getContract).toHaveBeenCalledWith(CONTRACT_FQN);
  });

  it('finds the asset from the contract FQN when its reference has no FQN', async () => {
    (getContract as jest.Mock).mockResolvedValue({
      name: 'Schema Contract',
      entity: { id: 'schema-id', type: 'databaseSchema' },
    });

    renderPage();

    expect(
      await screen.findByText('/databaseSchema/svc.db.schema/contract')
    ).toBeInTheDocument();
  });

  it('redirects to the not-found page when the contract cannot be loaded', async () => {
    (getContract as jest.Mock).mockRejectedValue(new Error('not found'));

    renderPage();

    expect(await screen.findByText('/404')).toBeInTheDocument();
  });
});
