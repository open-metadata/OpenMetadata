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
import { getListTestCase } from 'rest/testAPI';
import { Column } from '../../../generated/entity/data/table';
import {
  COLUMN_PROFILER_RESULT,
  MOCK_TABLE,
  TEST_CASE,
} from '../../../mocks/TableData.mock';
import { ProfilerTabProps } from '../profilerDashboard.interface';
import ProfilerTab from './ProfilerTab';

const profilerTabProps: ProfilerTabProps = {
  profilerData: COLUMN_PROFILER_RESULT,
  activeColumnDetails: MOCK_TABLE.columns[0],
  tableProfile: MOCK_TABLE.profile,
};

jest.mock('rest/testAPI', () => {
  return {
    getListTestCase: jest
      .fn()
      .mockImplementation(() => Promise.resolve(TEST_CASE)),
  };
});

jest.mock('./ProfilerSummaryCard', () => {
  return jest.fn().mockImplementation(() => <div>ProfilerSummaryCard</div>);
});

jest.mock('./ProfilerDetailsCard', () => {
  return jest.fn().mockImplementation(() => <div>ProfilerDetailsCard</div>);
});
jest.mock('components/Chart/DataDistributionHistogram.component', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>DataDistributionHistogram</div>);
});

jest.mock('react-i18next', () => ({
  // this mock makes sure any components using the translate hook can use it without a warning being shown
  useTranslation: () => {
    return {
      t: (str: string) => str,
    };
  },
}));

describe('Test ProfilerTab component', () => {
  it('ProfilerTab component should render properly', async () => {
    await act(async () => {
      render(<ProfilerTab {...profilerTabProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const pageContainer = await screen.findByTestId('profiler-tab-container');
    const description = await screen.findByTestId('description');
    const histogram = await screen.findByTestId('histogram-metrics');
    const dataTypeContainer = await screen.findByTestId('data-type-container');
    const ProfilerSummaryCards = await screen.findAllByText(
      'ProfilerSummaryCard'
    );
    const ProfilerDetailsCards = await screen.findAllByText(
      'ProfilerDetailsCard'
    );

    expect(pageContainer).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(dataTypeContainer).toBeInTheDocument();
    expect(histogram).toBeInTheDocument();
    expect(ProfilerSummaryCards).toHaveLength(2);
    expect(ProfilerDetailsCards).toHaveLength(5);
  });

  it('ProfilerTab component should render properly with empty data', async () => {
    await act(async () => {
      render(
        <ProfilerTab
          activeColumnDetails={{} as Column}
          profilerData={[]}
          tableProfile={undefined}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const pageContainer = await screen.findByTestId('profiler-tab-container');
    const description = await screen.findByTestId('description');
    const dataTypeContainer = await screen.findByTestId('data-type-container');
    const histogram = await screen.findByTestId('histogram-metrics');
    const ProfilerSummaryCards = await screen.findAllByText(
      'ProfilerSummaryCard'
    );
    const ProfilerDetailsCards = await screen.findAllByText(
      'ProfilerDetailsCard'
    );

    expect(pageContainer).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(dataTypeContainer).toBeInTheDocument();
    expect(histogram).toBeInTheDocument();
    expect(ProfilerSummaryCards).toHaveLength(2);
    expect(ProfilerDetailsCards).toHaveLength(5);
  });

  it('ProfilerTab component should render properly even if getListTestCase API fails', async () => {
    (getListTestCase as jest.Mock).mockImplementationOnce(() =>
      Promise.reject()
    );
    await act(async () => {
      render(<ProfilerTab {...profilerTabProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const pageContainer = await screen.findByTestId('profiler-tab-container');
    const description = await screen.findByTestId('description');
    const histogram = await screen.findByTestId('histogram-metrics');
    const dataTypeContainer = await screen.findByTestId('data-type-container');
    const ProfilerSummaryCards = await screen.findAllByText(
      'ProfilerSummaryCard'
    );
    const ProfilerDetailsCards = await screen.findAllByText(
      'ProfilerDetailsCard'
    );

    expect(pageContainer).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(dataTypeContainer).toBeInTheDocument();
    expect(histogram).toBeInTheDocument();
    expect(ProfilerSummaryCards).toHaveLength(2);
    expect(ProfilerDetailsCards).toHaveLength(5);
  });
});
