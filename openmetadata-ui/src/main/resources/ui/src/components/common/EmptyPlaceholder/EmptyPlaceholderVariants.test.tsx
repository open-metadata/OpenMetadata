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
import CreatePlaceholder from './CreatePlaceholder';
import FeaturesPlaceholder from './FeaturesPlaceholder';
import NoDataPlaceholder from './NoDataPlaceholder';
import NoFilteredResultsPlaceholder from './NoFilteredResultsPlaceholder';
import NoSearchResultsPlaceholder from './NoSearchResultsPlaceholder';
import PermissionPlaceholder from './PermissionPlaceholder';
import SomethingWentWrongPlaceholder from './SomethingWentWrongPlaceholder';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../utils/i18next/LocalUtil', () => ({
  Transi18next: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
}));

describe('NoSearchResultsPlaceholder', () => {
  it('should render the default title and description', () => {
    render(<NoSearchResultsPlaceholder />);

    expect(
      screen.getByText('label.no-matching-result-plural')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.check-spelling-or-try-shorter-term')
    ).toBeInTheDocument();
  });

  it('should not render any action button by default', () => {
    render(<NoSearchResultsPlaceholder />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should allow overriding the title and description', () => {
    render(
      <NoSearchResultsPlaceholder
        description="custom description"
        title="custom title"
      />
    );

    expect(screen.getByText('custom title')).toBeInTheDocument();
    expect(screen.getByText('custom description')).toBeInTheDocument();
    expect(
      screen.queryByText('label.no-matching-result-plural')
    ).not.toBeInTheDocument();
  });
});

describe('NoFilteredResultsPlaceholder', () => {
  it('should render the default title and description', () => {
    render(<NoFilteredResultsPlaceholder />);

    expect(
      screen.getByText('label.no-result-for-these-filter-plural')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.nothing-matches-current-filter')
    ).toBeInTheDocument();
  });

  it('should not render the clear filters action without a handler', () => {
    render(<NoFilteredResultsPlaceholder />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should render the clear filters action and fire the handler', () => {
    const onClearFilters = jest.fn();
    render(<NoFilteredResultsPlaceholder onClearFilters={onClearFilters} />);

    const button = screen.getByRole('button', {
      name: 'label.clear-filter-plural',
    });

    fireEvent.click(button);

    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('should let custom actions replace the default clear filters action', () => {
    const onClearFilters = jest.fn();
    render(
      <NoFilteredResultsPlaceholder
        actions={[{ key: 'custom', label: 'Custom Action' }]}
        onClearFilters={onClearFilters}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Custom Action' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'label.clear-filter-plural' })
    ).not.toBeInTheDocument();
  });
});

describe('SomethingWentWrongPlaceholder', () => {
  it('should render the default title and description', () => {
    render(<SomethingWentWrongPlaceholder />);

    expect(
      screen.getByText('message.something-went-wrong')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.temporary-error-try-reloading')
    ).toBeInTheDocument();
  });

  it('should render the reload action and fire the handler', () => {
    const onReload = jest.fn();
    render(<SomethingWentWrongPlaceholder onReload={onReload} />);

    const button = screen.getByRole('button', { name: 'label.reload' });

    fireEvent.click(button);

    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('should not render the reload action without a handler', () => {
    render(<SomethingWentWrongPlaceholder />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('NoDataPlaceholder', () => {
  it('should render the default description', () => {
    render(<NoDataPlaceholder />);

    expect(screen.getByText('message.no-data-available')).toBeInTheDocument();
  });

  it('should not render any action button by default', () => {
    render(<NoDataPlaceholder />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should allow overriding the title and description', () => {
    render(
      <NoDataPlaceholder
        description="custom description"
        title="custom title"
      />
    );

    expect(screen.getByText('custom title')).toBeInTheDocument();
    expect(screen.getByText('custom description')).toBeInTheDocument();
    expect(
      screen.queryByText('message.no-data-available')
    ).not.toBeInTheDocument();
  });
});

describe('PermissionPlaceholder', () => {
  it('should render the default title and no-access description', () => {
    render(<PermissionPlaceholder permissionValue="view" />);

    expect(screen.getByText('label.access-denied')).toBeInTheDocument();
    expect(
      screen.getByText('message.no-access-placeholder')
    ).toBeInTheDocument();
  });

  it('should not render any action button', () => {
    render(<PermissionPlaceholder permissionValue="view" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should allow overriding the description', () => {
    render(<PermissionPlaceholder description="custom description" />);

    expect(screen.getByText('custom description')).toBeInTheDocument();
    expect(
      screen.queryByText('message.no-access-placeholder')
    ).not.toBeInTheDocument();
  });
});

describe('CreatePlaceholder', () => {
  it('should render the default create description', () => {
    render(<CreatePlaceholder heading="label.template" />);

    expect(
      screen.getByText('message.adding-new-entity-is-easy-just-give-it-a-spin')
    ).toBeInTheDocument();
  });

  it('should render the add action and fire the handler', () => {
    const onCreate = jest.fn();
    render(<CreatePlaceholder onCreate={onCreate} />);

    const button = screen.getByRole('button', { name: 'label.add' });

    fireEvent.click(button);

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('should not render the add action without a handler', () => {
    render(<CreatePlaceholder />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should apply buttonId as the add action id', () => {
    render(<CreatePlaceholder buttonId="create-btn" onCreate={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'label.add' })).toHaveAttribute(
      'id',
      'create-btn'
    );
  });

  it('should fall back to the permission placeholder when permission is false', () => {
    render(<CreatePlaceholder permission={false} permissionValue="view" />);

    expect(
      screen.getByText('message.no-access-placeholder')
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'message.adding-new-entity-is-easy-just-give-it-a-spin'
      )
    ).not.toBeInTheDocument();
  });

  it('should not render create controls in the denied state', () => {
    render(
      <CreatePlaceholder
        description="message.adding-a-role"
        footer={<button type="button">label.add-role</button>}
        permission={false}
        onCreate={jest.fn()}
      />
    );

    expect(
      screen.getByTestId('permission-error-placeholder')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('message.adding-a-role')).not.toBeInTheDocument();
    expect(
      screen.getByText('message.no-access-placeholder')
    ).toBeInTheDocument();
  });
});

describe('Caller copy replaces wrapper defaults', () => {
  it('does not stack the default no-data title above a caller footer', () => {
    render(<NoDataPlaceholder footer={<span>own footer copy</span>} />);

    expect(screen.getByText('own footer copy')).toBeInTheDocument();
    expect(
      screen.queryByText('message.no-data-available')
    ).not.toBeInTheDocument();
  });

  it('keeps a caller description as body copy without inventing a title', () => {
    render(
      <NoDataPlaceholder description="Enable the profiler to see data." />
    );

    const description = screen.getByText('Enable the profiler to see data.');

    expect(description).toHaveClass('tw:text-secondary');
    expect(description).not.toHaveClass('tw:font-semibold');
    expect(
      screen.queryByText('message.no-data-available')
    ).not.toBeInTheDocument();
  });

  it('renders a caller title with its own text colour', () => {
    render(<NoDataPlaceholder title="No test cases yet" />);

    expect(screen.getByText('No test cases yet')).toHaveClass(
      'tw:font-semibold',
      'tw:text-primary'
    );
  });

  it('adds no title above a description that has a footer', () => {
    render(
      <NoDataPlaceholder
        description="Adding a new insight is easy."
        footer={<span>doc link</span>}
      />
    );

    expect(
      screen.getByText('Adding a new insight is easy.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('message.no-data-available')
    ).not.toBeInTheDocument();
  });

  it.each([
    [
      'NoSearchResultsPlaceholder',
      NoSearchResultsPlaceholder,
      'message.check-spelling-or-try-shorter-term',
    ],
    [
      'NoFilteredResultsPlaceholder',
      NoFilteredResultsPlaceholder,
      'message.nothing-matches-current-filter',
    ],
    [
      'SomethingWentWrongPlaceholder',
      SomethingWentWrongPlaceholder,
      'message.temporary-error-try-reloading',
    ],
    [
      'PermissionPlaceholder',
      PermissionPlaceholder,
      'message.no-access-placeholder',
    ],
  ])(
    '%s skips its default description when the caller sets a title',
    (_, Placeholder, defaultDescription) => {
      render(<Placeholder title="Caller title" />);

      expect(screen.getByText('Caller title')).toBeInTheDocument();
      expect(screen.queryByText(defaultDescription)).not.toBeInTheDocument();
    }
  );
});

describe('FeaturesPlaceholder', () => {
  it('renders the title, description and feature columns', () => {
    render(
      <FeaturesPlaceholder
        description="Set it up in three steps"
        features={[
          {
            key: 'one',
            icon: <span />,
            title: 'Define it',
            description: 'Step one',
          },
          {
            key: 'two',
            icon: <span />,
            title: 'Own it',
            description: 'Step two',
          },
        ]}
        title="Get started"
      />
    );

    expect(screen.getByText('Get started')).toBeInTheDocument();
    expect(screen.getByText('Set it up in three steps')).toBeInTheDocument();
    expect(screen.getByText('Define it')).toBeInTheDocument();
    expect(screen.getByText('Own it')).toBeInTheDocument();
  });
});
