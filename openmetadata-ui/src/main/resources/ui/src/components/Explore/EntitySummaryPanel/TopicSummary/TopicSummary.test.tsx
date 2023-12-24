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
import React from 'react';
import { getTopicByFqn } from '../../../../rest/topicsAPI';
import {
  mockTopicByFqnResponse,
  mockTopicEntityDetails,
} from '../mocks/TopicSummary.mock';
import TopicSummary from './TopicSummary.component';

jest.mock('../SummaryList/SummaryList.component', () =>
  jest
    .fn()
    .mockImplementation(() => <div data-testid="SummaryList">SummaryList</div>)
);

jest.mock('../../../../rest/topicsAPI', () => ({
  getTopicByFqn: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockTopicByFqnResponse)),
}));

jest.mock(
  '../../../../components/common/SummaryTagsDescription/SummaryTagsDescription.component',
  () => jest.fn().mockImplementation(() => <p>SummaryTagDescription</p>)
);

jest.mock(
  '../../../../components/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component',
  () => jest.fn().mockImplementation(({ children }) => <>{children}</>)
);

describe('TopicSummary component tests', () => {
  it('Component should render properly', async () => {
    await act(async () => {
      render(<TopicSummary entityDetails={mockTopicEntityDetails} />);
    });

    const partitionsLabel = await screen.findByTestId('Partitions-label');
    const replicationFactorLabel = await screen.findByTestId(
      'Replication Factor-label'
    );
    const retentionSizeLabel = await screen.findByTestId(
      'Retention Size-label'
    );
    const cleanUpPoliciesLabel = await screen.findByTestId(
      'CleanUp Policies-label'
    );
    const maxMessageSizeLabel = await screen.findByTestId(
      'Max Message Size-label'
    );
    const partitionsValue = await screen.findByTestId('Partitions-value');
    const replicationFactorValue = await screen.findByTestId(
      'Replication Factor-value'
    );
    const retentionSizeValue = await screen.findByTestId(
      'Retention Size-value'
    );
    const cleanUpPoliciesValue = await screen.findByTestId(
      'CleanUp Policies-value'
    );
    const maxMessageSizeValue = await screen.findByTestId(
      'Max Message Size-value'
    );
    const schemaHeader = await screen.findByTestId('schema-header');
    const summaryList = await screen.findByTestId('SummaryList');

    expect(partitionsLabel).toBeInTheDocument();
    expect(replicationFactorLabel).toBeInTheDocument();
    expect(retentionSizeLabel).toBeInTheDocument();
    expect(cleanUpPoliciesLabel).toBeInTheDocument();
    expect(maxMessageSizeLabel).toBeInTheDocument();
    expect(partitionsValue).toContainHTML('-');
    expect(replicationFactorValue).toContainHTML('4');
    expect(retentionSizeValue).toContainHTML('1018.83 MB');
    expect(cleanUpPoliciesValue).toContainHTML('delete');
    expect(maxMessageSizeValue).toContainHTML('208 Bytes');
    expect(schemaHeader).toBeInTheDocument();
    expect(summaryList).toBeInTheDocument();
  });

  it('No data message should be shown in case no schemaFields are available in topic details', async () => {
    (getTopicByFqn as jest.Mock).mockImplementation(() =>
      Promise.resolve({ ...mockTopicEntityDetails, messageSchema: {} })
    );

    await act(async () => {
      render(<TopicSummary entityDetails={mockTopicEntityDetails} />);
    });

    const summaryList = screen.queryByTestId('SummaryList');
    const noDataMessage = screen.queryByTestId('no-data-message');

    expect(summaryList).toBeNull();
    expect(noDataMessage).toBeInTheDocument();
  });

  it('In case any topic field is not present, "-" should be displayed in place of value', async () => {
    (getTopicByFqn as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({})
    );
    await act(async () => {
      render(<TopicSummary entityDetails={mockTopicEntityDetails} />);
    });

    const partitionsValue = screen.getByTestId('Partitions-value');

    expect(partitionsValue).toContainHTML('-');
  });
});
