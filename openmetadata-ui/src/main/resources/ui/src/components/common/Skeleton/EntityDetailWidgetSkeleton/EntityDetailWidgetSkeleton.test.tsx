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
import { DetailPageWidgetKeys } from '../../../../enums/CustomizeDetailPage.enum';
import { EntityDetailWidgetSkeleton } from './EntityDetailWidgetSkeleton.component';

const SKELETON_TEST_ID = 'entity-detail-widget-skeleton';
const matchMediaMock = window.matchMedia as jest.MockedFunction<
  typeof window.matchMedia
>;

const getMatchMediaResult = (matches: boolean, media = ''): MediaQueryList => ({
  matches,
  media,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
});

describe('EntityDetailWidgetSkeleton', () => {
  beforeEach(() => {
    matchMediaMock.mockImplementation((query) =>
      getMatchMediaResult(false, query)
    );
  });

  it('renders a text-shaped skeleton for the description widget', () => {
    render(
      <EntityDetailWidgetSkeleton
        widgetKey={DetailPageWidgetKeys.DESCRIPTION}
      />
    );

    expect(screen.getByTestId(SKELETON_TEST_ID)).toHaveAttribute(
      'data-variant',
      'text'
    );
    expect(screen.getAllByTestId('widget-skeleton-row')).toHaveLength(4);
  });

  it('renders a table-shaped skeleton for the table schema widget', () => {
    render(
      <EntityDetailWidgetSkeleton
        widgetKey={DetailPageWidgetKeys.TABLE_SCHEMA}
      />
    );

    expect(screen.getByTestId(SKELETON_TEST_ID)).toHaveAttribute(
      'data-variant',
      'table'
    );
    expect(screen.getAllByTestId('widget-skeleton-row')).toHaveLength(5);
  });

  it('fills the reserved widget container for compact metadata widgets', () => {
    render(
      <EntityDetailWidgetSkeleton widgetKey={DetailPageWidgetKeys.DOMAIN} />
    );

    expect(screen.getByTestId(SKELETON_TEST_ID)).toHaveClass(
      'tw:h-full',
      'tw:w-full'
    );
  });

  it('animates skeletons by default', () => {
    const { container } = render(
      <EntityDetailWidgetSkeleton widgetKey={DetailPageWidgetKeys.DOMAIN} />
    );

    expect(container.querySelector('.tw\\:animate-pulse')).toBeInTheDocument();
  });

  it('animates skeletons when reduced motion is preferred', () => {
    matchMediaMock.mockImplementation((query) =>
      getMatchMediaResult(true, query)
    );

    const { container } = render(
      <EntityDetailWidgetSkeleton widgetKey={DetailPageWidgetKeys.DOMAIN} />
    );

    expect(container.querySelector('.tw\\:animate-pulse')).toBeInTheDocument();
  });
});
