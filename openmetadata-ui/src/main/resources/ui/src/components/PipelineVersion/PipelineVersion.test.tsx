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

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  mockColumnDiffPipelineVersionMockProps,
  pipelineVersionMockProps,
} from '../../mocks/PipelineVersion.mock';
import PipelineVersion from './PipelineVersion.component';

const mockPush = jest.fn();

jest.mock(
  '../../components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader',
  () => jest.fn().mockImplementation(() => <div>DataAssetsVersionHeader</div>)
);

jest.mock('../../components/TabsLabel/TabsLabel.component', () =>
  jest.fn().mockImplementation(({ name }) => <div>{name}</div>)
);

jest.mock('../../components/Tag/TagsContainerV2/TagsContainerV2', () =>
  jest.fn().mockImplementation(() => <div>TagsContainerV2</div>)
);

jest.mock(
  '../../components/common/RichTextEditor/RichTextEditorPreviewer',
  () =>
    jest
      .fn()
      .mockImplementation(({ markdown }) => (
        <div data-testid="rich-text-editor-previewer">{markdown}</div>
      ))
);

jest.mock('../../components/Tag/TagsViewer/TagsViewer', () =>
  jest.fn().mockImplementation(() => <div>TagsViewer</div>)
);

jest.mock(
  '../../components/common/CustomPropertyTable/CustomPropertyTable',
  () => ({
    CustomPropertyTable: jest
      .fn()
      .mockImplementation(() => <div>CustomPropertyTable</div>),
  })
);

jest.mock('../../components/common/EntityDescription/DescriptionV1', () =>
  jest.fn().mockImplementation(() => <div>DescriptionV1</div>)
);

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>)
);

jest.mock(
  '../../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine',
  () => jest.fn().mockImplementation(() => <div>EntityVersionTimeLine</div>)
);

jest.mock('../../components/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
  })),
  useParams: jest.fn().mockReturnValue({
    tab: 'pipeline',
  }),
  Link: jest.fn().mockImplementation(() => <div>Link</div>),
}));

JSON.parse = jest.fn().mockReturnValue([]);

describe('PipelineVersion tests', () => {
  it('Should render component properly if not loading', async () => {
    await act(async () => {
      render(<PipelineVersion {...mockColumnDiffPipelineVersionMockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const dataAssetsVersionHeader = screen.getByText('DataAssetsVersionHeader');
    const description = screen.getByText('DescriptionV1');
    const schemaTabLabel = screen.getByText('label.task-plural');
    const customPropertyTabLabel = screen.getByText(
      'label.custom-property-plural'
    );
    const entityVersionTimeLine = screen.getByText('EntityVersionTimeLine');
    const schemaTable = screen.getByTestId('schema-table');

    expect(dataAssetsVersionHeader).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(schemaTabLabel).toBeInTheDocument();
    expect(customPropertyTabLabel).toBeInTheDocument();
    expect(entityVersionTimeLine).toBeInTheDocument();
    expect(schemaTable).toBeInTheDocument();
  });

  it('Should display Loader if isVersionLoading is true', async () => {
    await act(async () => {
      render(
        <PipelineVersion {...pipelineVersionMockProps} isVersionLoading />
      );
    });

    const loader = screen.getByText('Loader');
    const entityVersionTimeLine = screen.getByText('EntityVersionTimeLine');
    const dataAssetsVersionHeader = screen.queryByText(
      'DataAssetsVersionHeader'
    );
    const schemaTabLabel = screen.queryByText('label.schema');
    const customPropertyTabLabel = screen.queryByText(
      'label.custom-property-plural'
    );
    const schemaTable = screen.queryByTestId('schema-table');

    expect(loader).toBeInTheDocument();
    expect(entityVersionTimeLine).toBeInTheDocument();
    expect(dataAssetsVersionHeader).toBeNull();
    expect(schemaTabLabel).toBeNull();
    expect(customPropertyTabLabel).toBeNull();
    expect(schemaTable).toBeNull();
  });

  it('Should update url on click of tab', async () => {
    await act(async () => {
      render(<PipelineVersion {...pipelineVersionMockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const customPropertyTabLabel = screen.getByText(
      'label.custom-property-plural'
    );

    expect(customPropertyTabLabel).toBeInTheDocument();

    await act(async () => {
      userEvent.click(customPropertyTabLabel);
    });

    expect(mockPush).toHaveBeenCalledWith(
      '/pipeline/sample_airflow.snowflake_etl/versions/0.3/custom_properties'
    );
  });

  it('Should show task name if no displayName is present', async () => {
    await act(async () => {
      render(<PipelineVersion {...pipelineVersionMockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const taskWithoutDisplayName = screen.getByText('snowflake_task');

    expect(taskWithoutDisplayName).toBeInTheDocument();
  });
});
