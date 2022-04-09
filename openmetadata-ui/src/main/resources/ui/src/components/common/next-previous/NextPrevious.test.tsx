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

import { render } from '@testing-library/react';
import React from 'react';
import { PAGE_SIZE } from '../../../constants/constants';
import NextPrevious from './NextPrevious';

const mockCallback = jest.fn();

describe('Test Pagination Component', () => {
  it('Component should render', () => {
    const paging = {
      after: 'afterString',
      before: 'BeforString',
      total: 0,
    };
    const { getByTestId } = render(
      <NextPrevious
        currentPage={1}
        pageSize={PAGE_SIZE}
        paging={paging}
        pagingHandler={mockCallback}
        totalCount={paging.total}
      />
    );
    const pagination = getByTestId('pagination');

    expect(pagination).toBeInTheDocument();
  });

  it('Component should be disabled if pagin is empty', () => {
    const paging = {
      after: '',
      before: '',
      total: 0,
    };

    const { getByTestId } = render(
      <NextPrevious
        currentPage={1}
        pageSize={PAGE_SIZE}
        paging={paging}
        pagingHandler={mockCallback}
        totalCount={paging.total}
      />
    );
    const previous = getByTestId('previous');
    const next = getByTestId('next');

    expect(previous).toBeDisabled();

    expect(next).toBeDisabled();
  });

  it('Left button should be disabled if pagin.before is empty', () => {
    const paging = {
      after: 'testString',
      before: '',
      total: 0,
    };

    const { getByTestId } = render(
      <NextPrevious
        currentPage={1}
        pageSize={PAGE_SIZE}
        paging={paging}
        pagingHandler={mockCallback}
        totalCount={paging.total}
      />
    );
    const previous = getByTestId('previous');

    expect(previous).toBeDisabled();
  });

  it('Next button should be disabled if pagin.after is empty', () => {
    const paging = {
      before: 'test',
      after: '',
      total: 0,
    };

    const { getByTestId } = render(
      <NextPrevious
        currentPage={1}
        pageSize={PAGE_SIZE}
        paging={paging}
        pagingHandler={mockCallback}
        totalCount={paging.total}
      />
    );
    const next = getByTestId('next');

    expect(next).toBeDisabled();
  });
});
