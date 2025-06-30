/*
 *  Copyright 2024 Collate.
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
import { MemoryRouter } from 'react-router-dom';
import {
  AlertType,
  Destination,
  Effect,
} from '../../../../generated/events/eventSubscription';
import { TitleBreadcrumbProps } from '../../../common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { HeaderProps } from '../../../PageHeader/PageHeader.interface';
import { AlertDetailsComponent } from './AlertDetails.component';

jest.mock('../../../../utils/Alerts/AlertsUtil', () => ({
  EDIT_LINK_PATH: 'Edit Alert Link',
  getDisplayNameForEntities: jest.fn().mockImplementation((entity) => entity),
  getFunctionDisplayName: jest
    .fn()
    .mockImplementation((filterFQN) => filterFQN),
}));

jest.mock('../../../common/TitleBreadcrumb/TitleBreadcrumb.component', () =>
  jest.fn().mockReturnValue(<span>TitleBreadcrumb</span>)
);

jest.mock('../../../PageHeader/PageHeader.component', () =>
  jest.fn().mockReturnValue(<span>PageHeader</span>)
);

const mockDelete = jest.fn();

const mockProps1 = {
  alerts: {
    id: 'alertId',
    name: 'alertName',
    alertType: AlertType.ActivityFeed,
    destinations: [] as Destination[],
    filteringRules: {
      resources: ['resource1', 'resource2', 'resource3'],
      rules: [
        {
          fullyQualifiedName: 'conditionName',
          condition: 'condition',
          effect: Effect.Include,
          name: 'ruleName',
        },
      ],
    },
  },
  onDelete: mockDelete,
};

const mockProps2 = {
  ...mockProps1,
  pageHeaderData: {} as HeaderProps['data'],
  allowDelete: false,
  breadcrumb: {} as TitleBreadcrumbProps['titleLinks'],
  allowEdit: false,
};

describe('AlertDetailsComponent', () => {
  it('should render all necessary elements based on mockProps1', () => {
    render(<AlertDetailsComponent {...mockProps1} />, {
      wrapper: MemoryRouter,
    });

    expect(screen.queryByText('TitleBreadcrumb')).not.toBeInTheDocument();
    expect(screen.queryByText('PageHeader')).not.toBeInTheDocument();

    const editButton = screen.getByRole('button', { name: 'label.edit' });
    const deleteButton = screen.getByRole('button', { name: 'label.delete' });

    expect(editButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();

    expect(screen.getByText('label.trigger')).toBeInTheDocument();
    expect(
      screen.getByText('resource1, resource2, resource3')
    ).toBeInTheDocument();

    expect(screen.getByText('label.filter-plural')).toBeInTheDocument();

    expect(screen.getByText('conditionName === condition')).toBeInTheDocument();

    expect(screen.getByText('label.destination')).toBeInTheDocument();
  });

  it('should render breadcrumb and pageHeader if data passed in props', () => {
    render(<AlertDetailsComponent {...mockProps2} />, {
      wrapper: MemoryRouter,
    });

    expect(screen.getByText('TitleBreadcrumb')).toBeInTheDocument();
    expect(screen.getByText('PageHeader')).toBeInTheDocument();

    const editButton = screen.queryByRole('button', { name: 'label.edit' });
    const deleteButton = screen.queryByRole('button', { name: 'label.delete' });

    expect(editButton).not.toBeInTheDocument();
    expect(deleteButton).not.toBeInTheDocument();
  });

  it('should call action handlers on click of buttons', () => {
    render(<AlertDetailsComponent {...mockProps1} />, {
      wrapper: MemoryRouter,
    });

    const editButton = screen.getByRole('button', { name: 'label.edit' });
    const deleteButton = screen.getByRole('button', { name: 'label.delete' });

    fireEvent.click(deleteButton);

    expect(mockDelete).toHaveBeenCalled();

    const editLink = editButton.closest('a');

    expect(editLink).toHaveAttribute('href', '/Edit Alert Link/alertId');
  });
});
