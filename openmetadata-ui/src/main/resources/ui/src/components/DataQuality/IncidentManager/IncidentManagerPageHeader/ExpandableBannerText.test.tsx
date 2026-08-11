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

const FIRST_TEXT = 'A failure description that does not fit on one line.';
const SECOND_TEXT = 'Incident details that also overflow their available row.';
const FAILURE_TEXT_TEST_ID = 'failure-text';
const FAILURE_MORE_TEST_ID = `${FAILURE_TEXT_TEST_ID}-more-button`;
const PREFIX_TEST_ID = 'incident-id-prefix';
const PREFIX_TEXT = 'INC–17, ';
let scrollWidth = 200;

describe('ExpandableBannerText', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 100,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get: () => scrollWidth,
    });
  });

  beforeEach(() => {
    scrollWidth = 200;
  });

  afterAll(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollWidth');
  });

  it('keeps the collapsed text and more control in one clamped line', () => {
    render(
      <ExpandableBannerText
        dataTestId={FAILURE_TEXT_TEST_ID}
        text={FIRST_TEXT}
      />
    );

    const text = screen.getByTestId(FAILURE_TEXT_TEST_ID);
    const more = screen.getByTestId(FAILURE_MORE_TEST_ID);

    expect(text).toHaveClass('tw:flex');
    expect(text).toHaveClass('tw:break-all');
    expect(text).toContainElement(more);
    expect(more.tagName).toBe('BUTTON');
    expect(more).toHaveTextContent('label.more-lowercase');
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
    expect(text).toHaveClass('tw:block');
    expect(text).toContainElement(less);
  });

  it('keeps a prefix in the same text flow as the expanded content', () => {
    render(
      <ExpandableBannerText
        dataTestId={FAILURE_TEXT_TEST_ID}
        prefix={<span data-testid={PREFIX_TEST_ID}>{PREFIX_TEXT}</span>}
        text={FIRST_TEXT}
      />
    );

    fireEvent.click(screen.getByTestId(FAILURE_MORE_TEST_ID));

    const content = screen.getByTestId(`${FAILURE_TEXT_TEST_ID}-content`);

    expect(content).toContainElement(screen.getByTestId(PREFIX_TEST_ID));
    expect(content).toHaveTextContent(`${PREFIX_TEXT}${FIRST_TEXT}`);
  });

  it('does not show the more control when the text fits', () => {
    scrollWidth = 100;

    render(
      <ExpandableBannerText
        dataTestId={FAILURE_TEXT_TEST_ID}
        text={FIRST_TEXT}
      />
    );

    expect(screen.queryByTestId(FAILURE_MORE_TEST_ID)).not.toBeInTheDocument();
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
