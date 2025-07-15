/*
 *  Copyright 2022 Collate.
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

jest.mock('../../rest/miscAPI', () => ({
  addLineage: jest.fn(),
  deleteLineageEdge: jest.fn(),
}));

jest.mock('../../rest/pipelineAPI', () => ({
  addFollower: jest.fn(),
  patchPipelineDetails: jest.fn(),
  removeFollower: jest.fn(),
  getPipelineByFqn: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock(
  '../../components/Pipeline/PipelineDetails/PipelineDetails.component',
  () => {
    return jest.fn().mockReturnValue(<div>PipelineDetails.component</div>);
  }
);

jest.mock(
  '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => {
    return jest.fn().mockReturnValue(<div>ErrorPlaceHolder.component</div>);
  }
);

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: {},
    getEntityPermission: jest.fn().mockResolvedValue({
      Create: true,
      Delete: true,
      EditAll: true,
      EditCustomFields: true,
      EditDataProfile: true,
      EditDescription: true,
      EditDisplayName: true,
      EditLineage: true,
      EditOwners: true,
      EditQueries: true,
      EditSampleData: true,
      EditTags: true,
      EditTests: true,
      EditTier: true,
      ViewAll: true,
      ViewDataProfile: true,
      ViewQueries: true,
      ViewSampleData: true,
      ViewTests: true,
      ViewUsage: true,
    }),
  })),
}));

jest.mock('../../utils/PermissionsUtils', () => ({
  DEFAULT_ENTITY_PERMISSION: {
    Create: true,
    Delete: true,
    EditAll: true,
    EditCustomFields: true,
    EditDataProfile: true,
    EditDescription: true,
    EditDisplayName: true,
    EditLineage: true,
    EditOwners: true,
    EditQueries: true,
    EditSampleData: true,
    EditTags: true,
    EditTests: true,
    EditTier: true,
    ViewAll: true,
    ViewDataProfile: true,
    ViewQueries: true,
    ViewSampleData: true,
    ViewTests: true,
    ViewUsage: true,
  },
  getPrioritizedEditPermission: jest.fn().mockReturnValue(true),
  getPrioritizedViewPermission: jest.fn().mockReturnValue(true),
}));

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
