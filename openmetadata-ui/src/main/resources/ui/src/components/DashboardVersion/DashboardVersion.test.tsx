/*
 *  Copyright 2021 Collate
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

import { findByTestId, findByText, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import DashboardVersion from './DashboardVersion.component';
import { DashboardVersionProp } from './DashboardVersion.interface';
import {
  dashboardVersionProp,
  mockNoChartData,
  mockTagChangeVersion,
} from './dashboardVersion.mock';

jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>RichTextEditorPreviewer.component</div>);
});

jest.mock('../common/description/Description', () => {
  return jest.fn().mockImplementation(() => <div>Description.component</div>);
});

jest.mock('../common/TabsPane/TabsPane', () => {
  return jest.fn().mockImplementation(() => <div>TabsPane.component</div>);
});

jest.mock('../EntityVersionTimeLine/EntityVersionTimeLine', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>EntityVersionTimeLine.component</div>);
});

jest.mock('../common/entityPageInfo/EntityPageInfo', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>EntityPageInfo.component</div>);
});

jest.mock('../Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader.component</div>);
});

jest.mock('../../utils/EntityVersionUtils', () => ({
  getDescriptionDiff: jest.fn(),
  getDiffByFieldName: jest.fn().mockImplementation(() => ({
    updated: {
      name: 'description',
      oldValue: '',
      newValue: 'test description',
    },
  })),
  getDiffValue: jest.fn(),
  getTagsDiff: jest.fn(),
}));

JSON.parse = jest.fn().mockReturnValue([]);

describe('Test DashboardVersion page', () => {
  it('Checks if the page has all the proper components rendered', async () => {
    const { container } = render(
      <DashboardVersion
        {...(dashboardVersionProp as unknown as DashboardVersionProp)}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const dashboardVersionContainer = await findByTestId(
      container,
      'dashboard-version-container'
    );
    const versionData = await findByTestId(container, 'version-data');
    const schemaTable = await findByTestId(container, 'schema-table');
    const entityPageInfo = await findByText(
      container,
      'EntityPageInfo.component'
    );
    const entityVersionTimeLine = await findByText(
      container,
      'EntityVersionTimeLine.component'
    );
    const tabs = await findByText(container, 'TabsPane.component');
    const description = await findByText(container, 'Description.component');
    const richTextEditorPreviewer = await findByText(
      container,
      'RichTextEditorPreviewer.component'
    );

    expect(dashboardVersionContainer).toBeInTheDocument();
    expect(versionData).toBeInTheDocument();
    expect(schemaTable).toBeInTheDocument();
    expect(entityPageInfo).toBeInTheDocument();
    expect(entityVersionTimeLine).toBeInTheDocument();
    expect(tabs).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(richTextEditorPreviewer).toBeInTheDocument();
  });

  it('Checks if the page has all the proper components rendered, if change version is related to tags', async () => {
    const { container } = render(
      <DashboardVersion
        {...(dashboardVersionProp as unknown as DashboardVersionProp)}
        currentVersionData={
          mockTagChangeVersion as DashboardVersionProp['currentVersionData']
        }
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const dashboardVersionContainer = await findByTestId(
      container,
      'dashboard-version-container'
    );
    const versionData = await findByTestId(container, 'version-data');
    const schemaTable = await findByTestId(container, 'schema-table');
    const entityPageInfo = await findByText(
      container,
      'EntityPageInfo.component'
    );
    const entityVersionTimeLine = await findByText(
      container,
      'EntityVersionTimeLine.component'
    );
    const tabs = await findByText(container, 'TabsPane.component');
    const description = await findByText(container, 'Description.component');
    const richTextEditorPreviewer = await findByText(
      container,
      'RichTextEditorPreviewer.component'
    );

    expect(dashboardVersionContainer).toBeInTheDocument();
    expect(versionData).toBeInTheDocument();
    expect(schemaTable).toBeInTheDocument();
    expect(entityPageInfo).toBeInTheDocument();
    expect(entityVersionTimeLine).toBeInTheDocument();
    expect(tabs).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(richTextEditorPreviewer).toBeInTheDocument();
  });

  it('Checks if the page has all the proper components rendered, if the dashboard deleted is undefined', async () => {
    const { container } = render(
      <DashboardVersion
        {...(dashboardVersionProp as unknown as DashboardVersionProp)}
        currentVersionData={
          mockNoChartData as DashboardVersionProp['currentVersionData']
        }
        deleted={undefined}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const dashboardVersionContainer = await findByTestId(
      container,
      'dashboard-version-container'
    );
    const versionData = await findByTestId(container, 'version-data');
    const entityPageInfo = await findByText(
      container,
      'EntityPageInfo.component'
    );
    const entityVersionTimeLine = await findByText(
      container,
      'EntityVersionTimeLine.component'
    );
    const tabs = await findByText(container, 'TabsPane.component');
    const description = await findByText(container, 'Description.component');

    expect(dashboardVersionContainer).toBeInTheDocument();
    expect(versionData).toBeInTheDocument();
    expect(entityPageInfo).toBeInTheDocument();
    expect(entityVersionTimeLine).toBeInTheDocument();
    expect(tabs).toBeInTheDocument();
    expect(description).toBeInTheDocument();
  });

  it('If version is loading it should show loading component', async () => {
    const { container } = render(
      <DashboardVersion
        {...(dashboardVersionProp as unknown as DashboardVersionProp)}
        isVersionLoading
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const dashboardVersionContainer = await findByTestId(
      container,
      'dashboard-version-container'
    );
    const loader = await findByText(container, 'Loader.component');

    expect(dashboardVersionContainer).toBeInTheDocument();
    expect(loader).toBeInTheDocument();
  });
});
