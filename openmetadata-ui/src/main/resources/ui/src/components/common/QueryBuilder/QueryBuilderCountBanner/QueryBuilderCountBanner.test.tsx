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
import { render, screen } from '@testing-library/react';
import QueryBuilderCountBanner from './QueryBuilderCountBanner';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}-${options.count}`,
  }),
}));

const LINK_TESTID = 'view-assets-banner-button';
const BANNER_TESTID = 'view-assets-banner-count';

describe('QueryBuilderCountBanner', () => {
  it('should render the count', () => {
    render(<QueryBuilderCountBanner count={42} />);

    expect(screen.getByTestId(BANNER_TESTID)).toBeInTheDocument();
    expect(
      screen.getByText('message.search-entity-count-42')
    ).toBeInTheDocument();
  });

  // A count of nothing is still a meaningful answer — it must not be mistaken
  // for "not loaded yet" and hidden.
  it('should render a zero count', () => {
    render(<QueryBuilderCountBanner count={0} />);

    expect(screen.getByTestId(BANNER_TESTID)).toBeInTheDocument();
  });

  it('should render nothing until a count is known', () => {
    const { container } = render(<QueryBuilderCountBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it('should render a placeholder instead of a stale count while loading', () => {
    render(<QueryBuilderCountBanner isLoading count={42} />);

    expect(screen.queryByTestId(BANNER_TESTID)).not.toBeInTheDocument();
  });

  it('should offer the click-through when there is somewhere to go', () => {
    render(<QueryBuilderCountBanner count={3} exploreUrl="/explore?x=1" />);

    expect(screen.getByTestId(LINK_TESTID)).toHaveAttribute(
      'href',
      '/explore?x=1'
    );
  });

  // Without a URL the banner must be a plain count, not a dead click target.
  it('should omit the link when there is no url', () => {
    render(<QueryBuilderCountBanner count={3} />);

    expect(screen.queryByTestId(LINK_TESTID)).not.toBeInTheDocument();
  });

  // An anchor wrapping the whole Alert would put the close button inside a
  // link, so dismissing the banner would navigate instead of closing it.
  it('should not make the banner itself a link', () => {
    render(<QueryBuilderCountBanner count={3} exploreUrl="/explore" />);

    expect(screen.getByTestId(BANNER_TESTID)).not.toHaveAttribute('href');
  });

  it('should let each screen keep its own testid and link wording', () => {
    render(
      <QueryBuilderCountBanner
        count={3}
        data-testid="scope-count-banner"
        exploreUrl="/explore"
        linkLabelKey="label.view-in-explore-page"
      />
    );

    expect(screen.getByTestId('scope-count-banner')).toBeInTheDocument();
    expect(screen.getByText('label.view-in-explore-page')).toBeInTheDocument();
  });
});
