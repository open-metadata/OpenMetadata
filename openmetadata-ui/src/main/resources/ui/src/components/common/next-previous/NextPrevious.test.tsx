import { render } from '@testing-library/react';
import React from 'react';
import NextPrevious from './NextPrevious';

const mockCallback = jest.fn();

describe('Test Pagination Component', () => {
  it('Component should render', () => {
    const paging = {
      after: 'afterString',
      before: 'BeforString',
    };
    const { getByTestId } = render(
      <NextPrevious paging={paging} pagingHandler={mockCallback} />
    );
    const pagination = getByTestId('pagination');

    expect(pagination).toBeInTheDocument();
  });

  it('Component should be disabled if pagin is empty', () => {
    const paging = {
      after: '',
      before: '',
    };

    const { getByTestId } = render(
      <NextPrevious paging={paging} pagingHandler={mockCallback} />
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
    };

    const { getByTestId } = render(
      <NextPrevious paging={paging} pagingHandler={mockCallback} />
    );
    const previous = getByTestId('previous');

    expect(previous).toBeDisabled();
  });

  it('Next button should be disabled if pagin.after is empty', () => {
    const paging = {
      before: 'test',
      after: '',
    };

    const { getByTestId } = render(
      <NextPrevious paging={paging} pagingHandler={mockCallback} />
    );
    const next = getByTestId('next');

    expect(next).toBeDisabled();
  });
});
