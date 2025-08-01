/*
 *  Copyright 2025 Collate.
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
import { render } from '@testing-library/react';
import { PipelineType } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { renderNameField, renderTypeField } from './IngestionListTableUtils';

jest.mock('./EntityUtils', () => ({
  ...jest.requireActual('./EntityUtils'),
  highlightSearchText: jest.fn((text, searchText) => {
    if (searchText) {
      return text.replace(
        new RegExp(searchText, 'gi'),
        (match: string) =>
          `<span data-highlight="true" class="text-highlighter">${match}</span>`
      );
    }

    return text;
  }),
}));

jest.mock('./StringsUtils', () => ({
  ...jest.requireActual('./StringsUtils'),
  stringToHTML: jest.fn((text) => text),
}));

const mockRecord = {
  name: 'Test Pipeline',
  pipelineType: PipelineType.Metadata,
  airflowConfig: {},
  sourceConfig: {},
};

describe('renderNameField', () => {
  it('should render the pipeline name with highlighted search text', () => {
    const searchText = 'Test';
    const { getByTestId } = render(renderNameField(searchText)('', mockRecord));

    const pipelineNameElement = getByTestId('pipeline-name');

    expect(pipelineNameElement.innerHTML).toBe(
      '&lt;span data-highlight="true" class="text-highlighter"&gt;Test&lt;/span&gt; Pipeline'
    );
  });

  it('should render the pipeline name without highlighting if searchText is not provided', () => {
    const { getByTestId } = render(renderNameField()('', mockRecord));

    const pipelineNameElement = getByTestId('pipeline-name');

    expect(pipelineNameElement.innerHTML).toBe('Test Pipeline');
  });
});

describe('renderTypeField', () => {
  it('should render the pipeline type with highlighted search text', () => {
    const searchText = 'metadata';
    const { getByTestId } = render(renderTypeField(searchText)('', mockRecord));

    const pipelineTypeElement = getByTestId('pipeline-type');

    expect(pipelineTypeElement.innerHTML).toBe(
      '&lt;span data-highlight="true" class="text-highlighter"&gt;Metadata&lt;/span&gt;'
    );
  });

  it('should render the pipeline type without highlighting if searchText is not provided', () => {
    const { getByTestId } = render(renderTypeField()('', mockRecord));

    const pipelineTypeElement = getByTestId('pipeline-type');

    expect(pipelineTypeElement.innerHTML).toBe('Metadata');
  });
});
