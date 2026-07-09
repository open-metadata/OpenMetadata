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

import { BreadcrumbItemType } from '@openmetadata/ui-core-components';
import { render, screen } from '@testing-library/react';
import Breadcrumb from './HeaderBreadcrumb.component';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(() => mockNavigate),
}));

jest.mock('../../../constants/constants', () => ({
  ROUTES: { HOME: '/' },
}));

let capturedItems: BreadcrumbItemType[] = [];
let capturedOnAction: ((id: string) => void) | undefined;

jest.mock('@openmetadata/ui-core-components', () => ({
  Breadcrumbs: jest.fn(
    ({
      items,
      onAction,
      className,
    }: {
      items: BreadcrumbItemType[];
      onAction?: (id: string) => void;
      className?: string;
    }) => {
      capturedItems = items;
      capturedOnAction = onAction;

      return (
        <nav className={className} data-testid="breadcrumbs">
          {items.map((item) => (
            <span data-testid={`crumb-${item.id}`} key={item.id}>
              {item.label}
            </span>
          ))}
        </nav>
      );
    }
  ),
}));

describe('Breadcrumb', () => {
  beforeEach(() => {
    capturedItems = [];
    capturedOnAction = undefined;
    mockNavigate.mockClear();
  });

  it('renders without crashing', () => {
    render(<Breadcrumb items={[]} />);

    expect(screen.getByTestId('breadcrumbs')).toBeInTheDocument();
  });

  it('renders provided items with a home crumb by default', () => {
    render(
      <Breadcrumb
        items={[{ label: 'Section', href: '/section' }, { label: 'Current' }]}
      />
    );

    expect(capturedItems).toHaveLength(3);
    expect(capturedItems[0].id).toBe('__breadcrumb_home__');
    expect(capturedItems[1].label).toBe('Section');
    expect(capturedItems[2].label).toBe('Current');
  });

  it('assigns sequential string ids to items', () => {
    render(
      <Breadcrumb
        items={[{ label: 'First', href: '/first' }, { label: 'Second' }]}
      />
    );

    expect(capturedItems[0].id).toBe('__breadcrumb_home__');
    expect(capturedItems[1].id).toBe('0');
    expect(capturedItems[2].id).toBe('1');
  });

  it('prepends a home crumb when showHome is true', () => {
    render(
      <Breadcrumb showHome items={[{ label: 'Section', href: '/section' }]} />
    );

    expect(capturedItems).toHaveLength(2);

    const homeItem = capturedItems[0];

    expect(homeItem.id).toBe('__breadcrumb_home__');
    expect(homeItem.label).toBeNull();
    expect(homeItem.ariaLabel).toBe('label.home');

    const { HomeLine } = jest.requireActual('@untitledui/icons');

    expect(homeItem.icon).toBe(HomeLine);
    expect(homeItem.href).toBe('/');
  });

  it('does not prepend a home crumb when showHome is false', () => {
    render(<Breadcrumb items={[{ label: 'Page' }]} showHome={false} />);

    expect(capturedItems).toHaveLength(1);
    expect(capturedItems[0].id).not.toBe('__breadcrumb_home__');
  });

  it('navigates when a crumb with href is activated', () => {
    render(
      <Breadcrumb
        items={[{ label: 'Section', href: '/section' }, { label: 'Current' }]}
      />
    );

    capturedOnAction?.('0');

    expect(mockNavigate).toHaveBeenCalledWith('/section');
  });

  it('navigates to home when the home crumb is activated', () => {
    render(<Breadcrumb showHome items={[{ label: 'Page' }]} />);

    capturedOnAction?.('__breadcrumb_home__');

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('does not navigate when a crumb without href is activated', () => {
    render(<Breadcrumb items={[{ label: 'Current Page' }]} />);

    capturedOnAction?.('0');

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not navigate for an unknown id', () => {
    render(<Breadcrumb items={[]} />);

    capturedOnAction?.('unknown-id');

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('passes className to the underlying Breadcrumbs', () => {
    render(<Breadcrumb className="my-class" items={[]} />);

    expect(screen.getByTestId('breadcrumbs')).toHaveClass('my-class');
  });
});
