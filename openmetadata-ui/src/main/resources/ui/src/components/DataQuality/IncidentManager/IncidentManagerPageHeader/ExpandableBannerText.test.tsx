/*
 *  Copyright 2026 Collate.
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

import { fireEvent, render, screen } from '@testing-library/react';
import ExpandableBannerText from './ExpandableBannerText';

jest.mock('antd', () => {
  const React = jest.requireActual('react');

  return {
    Typography: {
      Paragraph: ({ children, ellipsis, ...props }) => {
        React.useEffect(() => {
          if (ellipsis && typeof ellipsis === 'object') {
            ellipsis.onEllipsis?.(true);
          }
        }, [ellipsis]);

        return (
          <div
            {...props}
            data-ellipsis-rows={
              ellipsis && typeof ellipsis === 'object'
                ? ellipsis.rows
                : undefined
            }>
            {children}
            {ellipsis && typeof ellipsis === 'object' && (
              <button type="button" onClick={ellipsis.onExpand}>
                {ellipsis.symbol}
              </button>
            )}
          </div>
        );
      },
    },
  };
});

const FIRST_TEXT = 'A failure description that does not fit on one line.';
const SECOND_TEXT = 'Incident details that also overflow their available row.';
const FAILURE_TEXT_TEST_ID = 'failure-text';
const FAILURE_MORE_TEST_ID = `${FAILURE_TEXT_TEST_ID}-more-button`;

describe('ExpandableBannerText', () => {
  it('keeps the collapsed text and more control in one clamped line', () => {
    render(
      <ExpandableBannerText
        dataTestId={FAILURE_TEXT_TEST_ID}
        text={FIRST_TEXT}
      />
    );

    const text = screen.getByTestId(FAILURE_TEXT_TEST_ID);
    const more = screen.getByTestId(FAILURE_MORE_TEST_ID);

    expect(text).toHaveAttribute('data-ellipsis-rows', '1');
    expect(text).toContainElement(more);
  });

  it('shows the full text with an inline less control when expanded', () => {
    render(
      <ExpandableBannerText
        dataTestId={FAILURE_TEXT_TEST_ID}
        text={FIRST_TEXT}
      />
    );

    fireEvent.click(screen.getByTestId(FAILURE_MORE_TEST_ID));

    const text = screen.getByTestId(FAILURE_TEXT_TEST_ID);
    const less = screen.getByTestId('failure-text-less-button');

    expect(text).toHaveTextContent(FIRST_TEXT);
    expect(text).not.toHaveAttribute('data-ellipsis-rows');
    expect(text).toContainElement(less);
  });

  it('expands failure and incident details independently', () => {
    render(
      <>
        <ExpandableBannerText
          dataTestId={FAILURE_TEXT_TEST_ID}
          text={FIRST_TEXT}
        />
        <ExpandableBannerText dataTestId="incident-text" text={SECOND_TEXT} />
      </>
    );

    fireEvent.click(screen.getByTestId(FAILURE_MORE_TEST_ID));

    expect(screen.getByTestId('failure-text-less-button')).toBeInTheDocument();
    expect(screen.getByTestId('incident-text-more-button')).toBeInTheDocument();
    expect(
      screen.queryByTestId('incident-text-less-button')
    ).not.toBeInTheDocument();
  });
});
