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
import { MemoryRouter } from 'react-router-dom';
import {
  LabelType,
  State,
  TagSource,
} from '../../../../generated/type/tagLabel';
import { DRAWER_NAVIGATION_OPTIONS } from '../../../../utils/EntityUtils';
import { mockSearchIndexEntityDetails } from '../mocks/SearchIndexSummary.mock';
import SearchIndexSummary from './SearchIndexSummary.component';

jest.mock('../SummaryList/SummaryList.component', () =>
  jest
    .fn()
    .mockImplementation(() => <div data-testid="SummaryList">SummaryList</div>)
);

describe('SearchIndexSummary component tests', () => {
  it('Component should render properly, when loaded in the Explore page.', async () => {
    await act(async () => {
      render(
        <SearchIndexSummary entityDetails={mockSearchIndexEntityDetails} />
      );
    });

    const fieldsHeader = screen.getByTestId('fields-header');
    const tagsHeader = screen.getByTestId('tags-header');
    const summaryList = screen.getByTestId('SummaryList');
    const tag1 = screen.getByText('PersonalData.Personal');
    const tag2 = screen.getByText('PII.Sensitive');

    expect(fieldsHeader).toBeInTheDocument();
    expect(tagsHeader).toBeInTheDocument();
    expect(summaryList).toBeInTheDocument();
    expect(tag1).toBeInTheDocument();
    expect(tag2).toBeInTheDocument();
  });

  it('Component should render properly, when loaded in the Lineage page.', async () => {
    await act(async () => {
      render(
        <SearchIndexSummary
          componentType={DRAWER_NAVIGATION_OPTIONS.lineage}
          entityDetails={mockSearchIndexEntityDetails}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const descriptionHeader = screen.getByTestId('description-header');
    const fieldsHeader = screen.getByTestId('fields-header');
    const ownerLabel = screen.queryByTestId('label.owner-label');
    const tierLabel = screen.getByText('label.tier');
    const serviceLabel = screen.getByText('label.service');
    const tierValue = screen.getByText('-');
    const serviceValue = screen.getByText('testES');
    const summaryList = screen.getByTestId('SummaryList');

    expect(ownerLabel).not.toBeInTheDocument();
    expect(descriptionHeader).toBeInTheDocument();
    expect(fieldsHeader).toBeInTheDocument();
    expect(tierLabel).toBeInTheDocument();
    expect(serviceLabel).toBeInTheDocument();
    expect(tierValue).toBeInTheDocument();
    expect(serviceValue).toBeInTheDocument();
    expect(summaryList).toBeInTheDocument();
  });

  it('No data placeholder should be displayed in case of no tags', async () => {
    await act(async () => {
      render(
        <SearchIndexSummary
          entityDetails={{ ...mockSearchIndexEntityDetails, tags: undefined }}
        />
      );
    });

    const tagsHeader = screen.getByTestId('tags-header');
    const noTagsPlaceholder = screen.getByText('label.no-tags-added');

    expect(tagsHeader).toBeInTheDocument();
    expect(noTagsPlaceholder).toBeInTheDocument();
  });

  it('Tier should be displayed in tags section on explore page', async () => {
    await act(async () => {
      render(
        <SearchIndexSummary
          entityDetails={{
            ...mockSearchIndexEntityDetails,
            tags: [
              {
                tagFQN: 'Tier.Tier1',
                labelType: LabelType.Manual,
                description: '',
                source: TagSource.Classification,
                state: State.Confirmed,
              },
            ],
          }}
        />
      );
    });

    const tagsHeader = screen.getByTestId('tags-header');
    const tier = screen.getByText('Tier1');
    const noTagsPlaceholder = screen.queryByText('label.no-tags-added');

    expect(tagsHeader).toBeInTheDocument();
    expect(tier).toBeInTheDocument();
    expect(noTagsPlaceholder).toBeNull();
  });

  it('Tier should not be displayed in tags section on Lineage page', async () => {
    await act(async () => {
      render(
        <SearchIndexSummary
          componentType={DRAWER_NAVIGATION_OPTIONS.lineage}
          entityDetails={{
            ...mockSearchIndexEntityDetails,
            tags: [
              {
                tagFQN: 'Tier.Tier1',
                labelType: LabelType.Manual,
                description: '',
                source: TagSource.Classification,
                state: State.Confirmed,
              },
            ],
          }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const tagsHeader = screen.getByText('label.tag-plural');
    const tierLabel = screen.getByText('label.tier');
    const tierValue = screen.getByText('Tier1');
    const noTagsPlaceholder = screen.getByText('label.no-tags-added');

    expect(tagsHeader).toBeInTheDocument();
    expect(tierLabel).toBeInTheDocument();
    expect(tierValue).toBeInTheDocument();
    expect(noTagsPlaceholder).toBeInTheDocument();
  });
});
