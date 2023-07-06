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

import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import DashboardVersion from './DashboardVersion.component';
import { DashboardVersionProp } from './DashboardVersion.interface';
import {
  dashboardVersionProps,
  mockNoChartData,
  mockTagChangeVersion,
} from './dashboardVersion.mock';

jest.mock('components/common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>RichTextEditorPreviewer.component</div>);
});

jest.mock('components/common/description/DescriptionV1', () => {
  return jest.fn().mockImplementation(() => <div>Description.component</div>);
});

jest.mock('components/EntityVersionTimeLine/EntityVersionTimeLine', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>EntityVersionTimeLine.component</div>);
});

jest.mock('components/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader.component</div>);
});

jest.mock('components/common/error-with-placeholder/ErrorPlaceHolder', () => {
  return jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="ErrorPlaceHolder">ErrorPlaceHolder</div>
    ));
});

JSON.parse = jest.fn().mockReturnValue([]);

describe('Test DashboardVersion page', () => {
  it('Checks if the page has all the proper components rendered', async () => {
    await act(async () => {
      render(<DashboardVersion {...dashboardVersionProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const versionData = await screen.findByTestId('version-data');
    const schemaTable = await screen.findByTestId('schema-table');

    const entityVersionTimeLine = await screen.findByText(
      'EntityVersionTimeLine.component'
    );
    const tabs = await screen.findByTestId('tabs');
    const description = await screen.findByText('Description.component');
    const richTextEditorPreviewer = await screen.findByText(
      'RichTextEditorPreviewer.component'
    );

    expect(versionData).toBeInTheDocument();
    expect(schemaTable).toBeInTheDocument();
    expect(entityVersionTimeLine).toBeInTheDocument();
    expect(tabs).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(richTextEditorPreviewer).toBeInTheDocument();
  });

  it('Checks if the page has all the proper components rendered, if change version is related to tags', async () => {
    await act(async () => {
      render(
        <DashboardVersion
          {...dashboardVersionProps}
          currentVersionData={
            mockTagChangeVersion as DashboardVersionProp['currentVersionData']
          }
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const versionData = await screen.findByTestId('version-data');
    const schemaTable = await screen.findByTestId('schema-table');

    const entityVersionTimeLine = await screen.findByText(
      'EntityVersionTimeLine.component'
    );
    const tabs = await screen.findByTestId('tabs');
    const description = await screen.findByText('Description.component');
    const richTextEditorPreviewer = await screen.findByText(
      'RichTextEditorPreviewer.component'
    );

    expect(versionData).toBeInTheDocument();
    expect(schemaTable).toBeInTheDocument();
    expect(entityVersionTimeLine).toBeInTheDocument();
    expect(tabs).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(richTextEditorPreviewer).toBeInTheDocument();
  });

  it('Checks if the page has all the proper components rendered, if the dashboard deleted is undefined', async () => {
    await act(async () => {
      render(
        <DashboardVersion
          {...dashboardVersionProps}
          currentVersionData={mockNoChartData}
          deleted={undefined}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const versionData = await screen.findByTestId('version-data');
    const entityVersionTimeLine = await screen.findByText(
      'EntityVersionTimeLine.component'
    );
    const tabs = await screen.findByTestId('tabs');
    const description = await screen.findByText('Description.component');

    expect(versionData).toBeInTheDocument();
    expect(entityVersionTimeLine).toBeInTheDocument();
    expect(tabs).toBeInTheDocument();
    expect(description).toBeInTheDocument();
  });

  it('If version is loading it should show loading component', async () => {
    await act(async () => {
      render(<DashboardVersion {...dashboardVersionProps} isVersionLoading />, {
        wrapper: MemoryRouter,
      });
    });

    const entityVersionTimeLine = await screen.findByText(
      'EntityVersionTimeLine.component'
    );
    const loader = await screen.findByText('Loader.component');

    expect(entityVersionTimeLine).toBeInTheDocument();
    expect(loader).toBeInTheDocument();
  });

  it('ErrorPlaceholder should be displayed in case of no view permissions', async () => {
    await act(async () => {
      render(
        <DashboardVersion
          {...dashboardVersionProps}
          entityPermissions={DEFAULT_ENTITY_PERMISSION}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const versionData = screen.queryByTestId('version-data');
    const schemaTable = screen.queryByTestId('schema-table');

    const tabs = screen.queryByTestId('tabs');
    const description = screen.queryByText('Description.component');
    const richTextEditorPreviewer = screen.queryByText(
      'RichTextEditorPreviewer.component'
    );
    const entityVersionTimeLine = screen.queryByText(
      'EntityVersionTimeLine.component'
    );
    const errorPlaceHolder = screen.getByTestId('ErrorPlaceHolder');

    expect(entityVersionTimeLine).toBeNull();
    expect(versionData).toBeNull();
    expect(schemaTable).toBeNull();
    expect(tabs).toBeNull();
    expect(description).toBeNull();
    expect(richTextEditorPreviewer).toBeNull();
    expect(errorPlaceHolder).toBeInTheDocument();
  });
});
