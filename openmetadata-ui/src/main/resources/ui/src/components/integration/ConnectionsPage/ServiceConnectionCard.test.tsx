/*
 *  Copyright 2025 Collate.
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
import React from 'react';
// Type-only: erased at compile time, so it does not pull the real (unmocked) enum module into the
// test at runtime — only used below to type the local mock's literal as the real enum member.
import type { ServiceCategory as ServiceCategoryEnum } from '../../../enums/service.enum';
import ServiceConnectionCard from './ServiceConnectionCard';

const mockNavigate = jest.fn();
const mockGetServiceDetailsPath = jest.fn().mockReturnValue('/path/to/service');
const mockGetServiceLogo = jest.fn().mockReturnValue('/assets/mysql.svg');
const ServiceCategory = {
  DATABASE_SERVICES: 'databaseServices' as ServiceCategoryEnum,
} as const;

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../enums/service.enum', () => ({
  ServiceCategory: {
    DATABASE_SERVICES: 'databaseServices',
  },
}));

jest.mock('../../../utils/ConnectionsRouterClassBase', () => ({
  __esModule: true,
  default: {
    getServiceDetailsPath: (...args: unknown[]) =>
      mockGetServiceDetailsPath(...args),
  },
}));

jest.mock('../../../utils/ServiceUtilClassBase', () => ({
  __esModule: true,
  default: {
    getServiceLogo: (...args: unknown[]) => mockGetServiceLogo(...args),
  },
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  formatDate: () => 'Jul 18, 2026',
}));

jest.mock('../../common/OwnerLabel/OwnerLabel.component', () => ({
  // Mirrors the real shape: an avatar that is a link, plus inert placeholder text. A mock with
  // no interactive child cannot tell a targeted guard from a blanket one — the blanket version
  // passed against the old all-inert mock while the card was dead to the touch in a browser.
  OwnerLabel: () => (
    <span data-testid="owner-label">
      <a data-testid="owner-link" href="/users/alice">
        alice
      </a>
      <span data-testid="owner-placeholder">No Owners</span>
    </span>
  ),
}));

jest.mock('../../Tag/TagsContainerV2/TagsContainerV2', () => (
  <span>TagsContainerV2</span>
));

jest.mock('./ConnectionsPage.constants', () => ({
  CATEGORY_CONFIGS: [
    {
      key: 'databaseServices',
      titleKey: 'label.database-service',
    },
  ],
}));

jest.mock(
  '@openmetadata/ui-core-components',
  () => ({
    Badge: ({
      children,
      bordered: _bordered,
      color: _color,
      size: _size,
      ...rest
    }: {
      children: React.ReactNode;
      bordered?: boolean;
      color?: string;
      size?: string;
      [key: string]: unknown;
    }) => <span {...rest}>{children}</span>,
    Box: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Card: ({
      children,
      onClick,
      ...rest
    }: {
      children: React.ReactNode;
      onClick?: () => void;
      [key: string]: unknown;
    }) => (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={onClick}
        {...rest}>
        {children}
      </div>
    ),
    FeaturedIcon: ({ icon }: { icon?: React.ReactNode }) => (
      <span data-testid="service-logo">{icon}</span>
    ),
    // These forward the props the tests assert on. A mock that swallows `title`/`ellipsis` makes
    // any assertion about them pass regardless of what the component does.
    Tooltip: ({
      children,
      title,
    }: {
      children: React.ReactNode;
      title?: string;
    }) => (
      <div data-testid="name-tooltip" data-title={title}>
        {children}
      </div>
    ),
    TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Typography: ({
      children,
      ellipsis,
      weight,
    }: {
      children: React.ReactNode;
      ellipsis?: boolean;
      weight?: string;
    }) => (
      <span data-ellipsis={String(Boolean(ellipsis))} data-weight={weight}>
        {children}
      </span>
    ),
  }),
  { virtual: true }
);

const baseService = {
  id: 'svc-1',
  name: 'my-service',
  fullyQualifiedName: 'my-service-fqn',
  serviceType: 'Mysql',
  displayName: 'My Service Display',
  updatedAt: 1784404134906,
};

describe('ServiceConnectionCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServiceDetailsPath.mockReturnValue('/path/to/service');
  });

  it('renders displayName when present', () => {
    render(
      <ServiceConnectionCard
        categoryKey={ServiceCategory.DATABASE_SERVICES}
        service={
          baseService as Parameters<typeof ServiceConnectionCard>[0]['service']
        }
      />
    );

    expect(screen.getByText('My Service Display')).toBeInTheDocument();
  });

  it('falls back to name when displayName absent', () => {
    const service = { ...baseService, displayName: undefined };

    render(
      <ServiceConnectionCard
        categoryKey={ServiceCategory.DATABASE_SERVICES}
        service={
          service as Parameters<typeof ServiceConnectionCard>[0]['service']
        }
      />
    );

    expect(screen.getByText('my-service')).toBeInTheDocument();
  });

  it('renders serviceType', () => {
    render(
      <ServiceConnectionCard
        categoryKey={ServiceCategory.DATABASE_SERVICES}
        service={
          baseService as Parameters<typeof ServiceConnectionCard>[0]['service']
        }
      />
    );

    expect(screen.getByText('Mysql')).toBeInTheDocument();
  });

  it('renders the standalone card details with a semibold, truncating service name', () => {
    render(
      <ServiceConnectionCard
        categoryKey={ServiceCategory.DATABASE_SERVICES}
        service={
          baseService as Parameters<typeof ServiceConnectionCard>[0]['service']
        }
      />
    );

    const name = screen.getByText('My Service Display');

    expect(name).toHaveAttribute('data-weight', 'semibold');
    // The card is too narrow for most names, so it truncates — which is only acceptable because
    // the tooltip below carries the full one.
    expect(name).toHaveAttribute('data-ellipsis', 'true');
    expect(screen.getByText('label.database-service')).toBeInTheDocument();
    expect(screen.getByText(/Jul 18, 2026/)).toBeInTheDocument();
    expect(screen.getByTestId('owner-label')).toBeInTheDocument();
  });

  // The card used to carry a native `title` on its root, which meant hovering anywhere on the card
  // produced a browser tooltip covering the content. The name now owns its own.
  it('puts the full name in a tooltip on the name itself, not on the whole card', () => {
    const { container } = render(
      <ServiceConnectionCard
        categoryKey={ServiceCategory.DATABASE_SERVICES}
        service={
          baseService as Parameters<typeof ServiceConnectionCard>[0]['service']
        }
      />
    );

    expect(screen.getByTestId('name-tooltip')).toHaveAttribute(
      'data-title',
      'My Service Display'
    );
    expect(container.querySelector('[role="button"]')).not.toHaveAttribute(
      'title'
    );
  });

  const renderCard = () =>
    render(
      <ServiceConnectionCard
        categoryKey={ServiceCategory.DATABASE_SERVICES}
        service={
          baseService as Parameters<typeof ServiceConnectionCard>[0]['service']
        }
      />
    );

  // Clicking an owner avatar opens its own popover; without this the card's navigation fires too
  // and replaces the page the popover just opened on.
  it('keeps a click on an owner link from navigating the card', () => {
    renderCard();

    fireEvent.click(screen.getByTestId('owner-link'));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // The counterpart, and the case a blanket wrapper got wrong: the placeholder and the padding
  // around the avatars are not controls, so they belong to the card like the rest of it.
  it.each([
    ['the owner placeholder', 'owner-placeholder'],
    ['the owner region itself', 'owner-label'],
  ])('still navigates when %s is clicked', (_, testId) => {
    renderCard();

    fireEvent.click(screen.getByTestId(testId));

    expect(mockNavigate).toHaveBeenCalledWith('/path/to/service');
  });

  // TooltipTrigger is a react-aria button, whose usePress consumes the click instead of letting it
  // bubble — the name was a dead spot in the middle of a clickable card.
  it('navigates when the service name is clicked', () => {
    renderCard();

    fireEvent.click(screen.getByText('My Service Display'));

    expect(mockNavigate).toHaveBeenCalledWith('/path/to/service');
  });

  it('hides the category badge when showCategory is false', () => {
    render(
      <ServiceConnectionCard
        categoryKey={ServiceCategory.DATABASE_SERVICES}
        service={
          baseService as Parameters<typeof ServiceConnectionCard>[0]['service']
        }
        showCategory={false}
      />
    );

    // Category badge gone (redundant on a specific tab), but the rest still shows.
    expect(
      screen.queryByText('label.database-service')
    ).not.toBeInTheDocument();
    expect(screen.getByText('My Service Display')).toBeInTheDocument();
    expect(screen.getByText('Mysql')).toBeInTheDocument();
  });

  it('renders logo using the service utility resolver', () => {
    render(
      <ServiceConnectionCard
        categoryKey={ServiceCategory.DATABASE_SERVICES}
        service={
          baseService as Parameters<typeof ServiceConnectionCard>[0]['service']
        }
      />
    );

    expect(mockGetServiceLogo).toHaveBeenCalledWith('Mysql');
    expect(screen.getByAltText('Mysql')).toHaveAttribute(
      'src',
      '/assets/mysql.svg'
    );
  });

  it('navigates to service details path on card click', () => {
    render(
      <ServiceConnectionCard
        categoryKey={ServiceCategory.DATABASE_SERVICES}
        service={
          baseService as Parameters<typeof ServiceConnectionCard>[0]['service']
        }
      />
    );

    fireEvent.click(screen.getByTestId('service-card-my-service'));

    expect(mockGetServiceDetailsPath).toHaveBeenCalledWith(
      ServiceCategory.DATABASE_SERVICES,
      'my-service-fqn'
    );
    expect(mockNavigate).toHaveBeenCalledWith('/path/to/service');
  });

  it('uses fullyQualifiedName as fqn when present', () => {
    render(
      <ServiceConnectionCard
        categoryKey={ServiceCategory.DATABASE_SERVICES}
        service={
          baseService as Parameters<typeof ServiceConnectionCard>[0]['service']
        }
      />
    );

    fireEvent.click(screen.getByTestId('service-card-my-service'));

    expect(mockGetServiceDetailsPath).toHaveBeenCalledWith(
      expect.anything(),
      'my-service-fqn'
    );
  });

  it('falls back to name as fqn when fullyQualifiedName absent', () => {
    const service = { ...baseService, fullyQualifiedName: undefined };

    render(
      <ServiceConnectionCard
        categoryKey={ServiceCategory.DATABASE_SERVICES}
        service={
          service as Parameters<typeof ServiceConnectionCard>[0]['service']
        }
      />
    );

    fireEvent.click(screen.getByTestId('service-card-my-service'));

    expect(mockGetServiceDetailsPath).toHaveBeenCalledWith(
      expect.anything(),
      'my-service'
    );
  });

  it('renders data-testid as service-card-{name}', () => {
    render(
      <ServiceConnectionCard
        categoryKey={ServiceCategory.DATABASE_SERVICES}
        service={
          baseService as Parameters<typeof ServiceConnectionCard>[0]['service']
        }
      />
    );

    expect(screen.getByTestId('service-card-my-service')).toBeInTheDocument();
  });
});
