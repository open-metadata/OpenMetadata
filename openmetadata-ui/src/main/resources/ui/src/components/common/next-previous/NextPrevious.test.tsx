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

const computeTotalPages = jest
  .fn()
  .mockImplementation((pSize: number, total: number) => {
    return Math.ceil(total / pSize);
  });

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

  it('Component should be disabled if paging is empty', () => {
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
    const pageIndicator = getByTestId('page-indicator');

    expect(previous).toBeDisabled();

    expect(next).toBeDisabled();

    expect(pageIndicator).toBeInTheDocument();
  });

  it('Left button should be disabled if paging.before is empty', () => {
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
    const pageIndicator = getByTestId('page-indicator');

    expect(previous).toBeDisabled();
    expect(pageIndicator).toBeInTheDocument();
  });

  it('Next button should be disabled if paging.after is empty', () => {
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
    const pageIndicator = getByTestId('page-indicator');

    expect(next).toBeDisabled();

    expect(pageIndicator).toBeInTheDocument();
  });

  it('Next and Previous should be disable if total is equal to pagesize with isNumberBased as true', () => {
    const paging = {
      before: 'test',
      after: '',
      total: PAGE_SIZE,
    };

    const { getByTestId } = render(
      <NextPrevious
        isNumberBased
        currentPage={1}
        pageSize={PAGE_SIZE}
        paging={paging}
        pagingHandler={mockCallback}
        totalCount={paging.total}
      />
    );
    const next = getByTestId('next');
    const previous = getByTestId('previous');

    expect(next).toBeDisabled();
    expect(previous).toBeDisabled();
  });

  it('Previous should be disable if currentPage is equal to 1 with isNumberBased as true', () => {
    const paging = {
      before: 'test',
      after: '',
      total: PAGE_SIZE * 2,
    };

    const { getByTestId } = render(
      <NextPrevious
        isNumberBased
        currentPage={1}
        pageSize={PAGE_SIZE}
        paging={paging}
        pagingHandler={mockCallback}
        totalCount={paging.total}
      />
    );
    const next = getByTestId('next');
    const previous = getByTestId('previous');

    expect(next).not.toBeDisabled();
    expect(previous).toBeDisabled();
  });

  it('Next should be disable if currentPage is equal to lastpage with isNumberBased as true', () => {
    const paging = {
      before: 'test',
      after: '',
      total: PAGE_SIZE * 2,
    };

    const lastPage = computeTotalPages(PAGE_SIZE, PAGE_SIZE * 2);

    const { getByTestId } = render(
      <NextPrevious
        isNumberBased
        currentPage={lastPage}
        pageSize={PAGE_SIZE}
        paging={paging}
        pagingHandler={mockCallback}
        totalCount={paging.total}
      />
    );
    const next = getByTestId('next');
    const previous = getByTestId('previous');

    expect(next).toBeDisabled();
    expect(previous).not.toBeDisabled();
  });

  it('should render proper page indicator', () => {
    const paging = {
      before: 'test',
      after: '',
      total: PAGE_SIZE * 2,
    };

    const totalPage = computeTotalPages(PAGE_SIZE, PAGE_SIZE * 2);

    const { getByTestId } = render(
      <NextPrevious
        isNumberBased
        currentPage={totalPage}
        pageSize={PAGE_SIZE}
        paging={paging}
        pagingHandler={mockCallback}
        totalCount={paging.total}
      />
    );
    const next = getByTestId('next');
    const previous = getByTestId('previous');
    const pageIndicator = getByTestId('page-indicator');

    expect(next).toBeDisabled();
    expect(previous).not.toBeDisabled();

    expect(pageIndicator).toBeInTheDocument();

    expect(pageIndicator).toHaveTextContent(`${totalPage}/${totalPage} Page`);
  });
});
