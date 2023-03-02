/*
 *  Copyright 2023 Collate.
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
import { render, screen, waitForElement } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter, Route } from 'react-router-dom';
import GlobalSettingLeftPanel from './GlobalSettingLeftPanel';

jest.mock('../PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: {
      alert: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditDescription: true,
      },
      alertAction: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditDescription: true,
      },
      all: {
        All: true,
        Create: true,
        Delete: true,
        ViewAll: true,
        ViewUsage: true,
        ViewTests: true,
        ViewQueries: true,
        ViewDataProfile: true,
        ViewSampleData: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditTags: true,
        EditOwner: true,
        EditTier: true,
        EditCustomFields: true,
        EditLineage: true,
        EditStatus: true,
        EditReviewers: true,
        EditTests: true,
        EditQueries: true,
        EditDataProfile: true,
        EditSampleData: true,
        EditUsers: true,
      },
      bot: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      chart: {
        Create: true,
        Delete: true,
        ViewAll: true,
        ViewUsage: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditTags: true,
        EditOwner: true,
        EditTier: true,
        EditCustomFields: true,
        EditLineage: true,
      },
      classification: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      container: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      dashboard: {
        Create: true,
        Delete: true,
        ViewAll: true,
        ViewUsage: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditTags: true,
        EditOwner: true,
        EditTier: true,
        EditCustomFields: true,
        EditLineage: true,
      },
      dashboardService: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      dataInsightChart: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditDescription: true,
      },
      database: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      databaseSchema: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      databaseService: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      events: {
        ViewAll: true,
      },
      feed: {
        Create: true,
        Delete: true,
        ViewAll: true,
      },
      glossary: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      glossaryTerm: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      ingestionPipeline: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      kpi: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditDescription: true,
      },
      location: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      messagingService: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      metadataService: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      metrics: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      mlmodel: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      mlmodelService: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      objectStoreService: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      pipeline: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
        EditLineage: true,
        EditStatus: true,
      },
      pipelineService: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      policy: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      report: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      role: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      storageService: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      table: {
        Create: true,
        Delete: true,
        ViewAll: true,
        ViewBasic: true,
        ViewUsage: true,
        ViewTests: true,
        ViewQueries: true,
        ViewDataProfile: true,
        ViewSampleData: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditTags: true,
        EditOwner: true,
        EditTier: true,
        EditCustomFields: true,
        EditTests: true,
        EditQueries: true,
        EditDataProfile: true,
        EditSampleData: true,
        EditLineage: true,
      },
      tag: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      team: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
        EditUsers: true,
      },
      testCase: {
        Create: true,
        Delete: true,
        ViewAll: true,
      },
      testDefinition: {
        Create: true,
        Delete: true,
        ViewAll: true,
      },
      testSuite: {
        Create: true,
        Delete: true,
        ViewAll: true,
      },
      topic: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      type: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
      },
      user: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      webAnalyticEvent: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
      },
      webhook: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
    },
    getEntityPermission: jest.fn().mockResolvedValue({
      Create: true,
      Delete: true,
      EditAll: true,
      EditCustomFields: true,
      EditDataProfile: true,
      EditDescription: true,
      EditDisplayName: true,
      EditLineage: true,
      EditOwner: true,
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

const selectedCategory = 'services';
const selectedOption = 'objectStores';
const url = `/settings/${selectedCategory}/${selectedOption}`;

describe('GlobalSettingLeftPanel', () => {
  it('Should render global settings menu with correct selected item', () => {
    render(
      <MemoryRouter initialEntries={[url]}>
        <Route path="/settings/:settingCategory/:tab">
          <GlobalSettingLeftPanel />
        </Route>
      </MemoryRouter>
    );

    expect(screen.getByText('label.service-plural')).toBeInTheDocument();
    expect(screen.getByText('label.object-store-plural')).toBeInTheDocument();

    userEvent.click(screen.getByText('label.team-plural'));

    waitForElement(() =>
      expect(window.location.pathname).toEqual('/teams/organizations')
    );
  });

  it('Should change the location path on user click', () => {
    render(
      <MemoryRouter initialEntries={[url]}>
        <Route path="/settings/:settingCategory/:tab">
          <GlobalSettingLeftPanel />
        </Route>
      </MemoryRouter>
    );

    userEvent.click(screen.getByText('label.team-plural'));

    waitForElement(() =>
      expect(window.location.pathname).toEqual('/teams/organizations')
    );
  });
});
