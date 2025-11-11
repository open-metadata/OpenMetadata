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
import { render, screen } from '@testing-library/react';
import { PipelineType } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getScheduleDescriptionTexts } from './date-time/DateTimeUtils';
import {
  renderNameField,
  renderScheduleField,
  renderTypeField,
} from './IngestionListTableUtils';

jest.mock('./EntityUtils', () => ({
  getEntityName: jest.fn((entity) => entity?.name || ''),
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
  stringToHTML: jest.fn((text) => text),
}));

jest.mock('./date-time/DateTimeUtils', () => ({
  getScheduleDescriptionTexts: jest.fn().mockReturnValue({
    descriptionFirstPart: 'Every day',
    descriptionSecondPart: 'at 12:00 AM',
  }),
}));

const mockRecord = {
  name: 'Test Pipeline',
  pipelineType: PipelineType.Metadata,
  airflowConfig: {
    scheduleInterval: '0 0 * * *',
  },
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

describe('renderScheduleField', () => {
  it('should render schedule with formatted description texts', () => {
    render(renderScheduleField('', mockRecord));

    expect(screen.getByText('Every day')).toBeInTheDocument();
    expect(screen.getByText('at 12:00 AM')).toBeInTheDocument();
  });

  it('should call getScheduleDescriptionTexts with correct schedule interval', () => {
    render(renderScheduleField('', mockRecord));

    expect(getScheduleDescriptionTexts).toHaveBeenCalledWith('0 0 * * *');
  });

  it('should render no data placeholder when schedule interval is not available', () => {
    const recordWithoutSchedule = {
      ...mockRecord,
      airflowConfig: {},
    };

    render(renderScheduleField('', recordWithoutSchedule));

    const noDataElement = screen.getByTestId('scheduler-no-data');

    expect(noDataElement).toBeInTheDocument();
    expect(noDataElement).toHaveTextContent('--');
  });
});
