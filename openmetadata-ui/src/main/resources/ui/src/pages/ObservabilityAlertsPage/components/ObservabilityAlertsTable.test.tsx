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
import type { PropsWithChildren, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EventSubscription } from '../../../generated/events/eventSubscription';
import { AlertTableColumn } from '../ObservabilityAlertsPage.constants';
import { ObservabilityAlertsTableProps } from '../ObservabilityAlertsPage.interface';
import ObservabilityAlertsTable from './ObservabilityAlertsTable';

jest.mock('@openmetadata/ui-core-components', () => {
  const MockTable = ({
    children,
    'data-testid': testId,
  }: PropsWithChildren<{
    'data-testid'?: string;
    [key: string]: unknown;
  }>) => <table data-testid={testId}>{children}</table>;

  MockTable.Header = ({
    columns,
    children,
  }: {
    columns: unknown[];
    children: (col: unknown) => ReactNode;
  }) => (
    <thead>
      <tr>{(columns || []).map((col) => children(col))}</tr>
    </thead>
  );

  MockTable.Head = ({ label, id }: { label?: string; id?: string }) => (
    <th id={id}>{label}</th>
  );

  MockTable.Body = ({
    items,
    children,
    renderEmptyState,
  }: {
    items?: unknown[];
    children: (item: unknown) => ReactNode;
    renderEmptyState?: () => ReactNode;
    dependencies?: unknown[];
  }) => (
    <tbody>
      {items && items.length > 0
        ? items.map((item) => children(item))
        : renderEmptyState?.()}
    </tbody>
  );

  MockTable.Row = ({ children, id }: PropsWithChildren<{ id?: string }>) => (
    <tr id={id}>{children}</tr>
  );

  MockTable.Cell = ({
    children,
    className,
  }: PropsWithChildren<{ className?: string }>) => (
    <td className={className}>{children}</td>
  );

  const MockTableCard = {
    Root: ({ children }: PropsWithChildren) => <div>{children}</div>,
  };

  const MockBox = ({
    children,
    ...props
  }: PropsWithChildren<Record<string, unknown>>) => (
    <div {...props}>{children}</div>
  );

  interface MockFeature {
    key: string;
    title?: ReactNode;
    description?: ReactNode;
  }

  interface MockAction {
    key: string;
    label: ReactNode;
    onPress?: () => void;
  }

  const MockEmptyPlaceholder = ({
    title,
    description,
    features,
    actions,
  }: {
    title?: ReactNode;
    description?: ReactNode;
    features?: MockFeature[];
    actions?: MockAction[];
  }) => (
    <div data-testid="empty-placeholder">
      <span>{title}</span>
      <span>{description}</span>
      {features?.map((feature) => (
        <div key={feature.key}>
          <span>{feature.title}</span>
          <span>{feature.description}</span>
        </div>
      ))}
      {actions?.map((action) => (
        <button key={action.key} onClick={action.onPress}>
          {action.label}
        </button>
      ))}
    </div>
  );

  return {
    Box: MockBox,
    EmptyPlaceholder: MockEmptyPlaceholder,
    Table: MockTable,
    TableCard: MockTableCard,
  };
});

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: jest
    .fn()
    .mockImplementation(({ children, ...rest }) => (
      <div {...rest}>{children}</div>
    )),
}));

jest.mock('../../../components/common/NextPrevious/NextPrevious', () =>
  jest.fn().mockImplementation(() => <div data-testid="next-previous" />)
);

jest.mock('./ObservabilityAlertActions', () =>
  jest.fn().mockImplementation(() => <div data-testid="alert-actions" />)
);

const mockAlerts: EventSubscription[] = [
  {
    id: 'alert-1',
    name: 'alert-test',
    fullyQualifiedName: 'alert-test',
    filteringRules: { resources: ['all'], rules: [] },
  } as unknown as EventSubscription,
];

const columnList: AlertTableColumn[] = [
  { id: 'name', name: 'label.name' },
  { id: 'trigger', name: 'label.trigger' },
  { id: 'description', name: 'label.description' },
  { id: 'actions', name: 'label.action-plural' },
];

const mockOnAddAlert = jest.fn();
const mockOnPageChange = jest.fn();
const mockOnPageSizeChange = jest.fn();
const mockOnSelectAlert = jest.fn();
const mockGetAlertDetailsPath = jest.fn().mockReturnValue('/alert-details');

const mockProps: ObservabilityAlertsTableProps = {
  alertPermissions: [],
  alertResourcePermission: { Create: true } as OperationPermission,
  alerts: mockAlerts,
  columnList,
  currentPage: 1,
  getAlertDetailsPath: mockGetAlertDetailsPath,
  loading: false,
  loadingCount: 0,
  onAddAlert: mockOnAddAlert,
  onPageChange: mockOnPageChange,
  onPageSizeChange: mockOnPageSizeChange,
  onSelectAlert: mockOnSelectAlert,
  paging: { total: 1 },
  pageSize: 15,
  showPagination: true,
};

const renderTable = (props: Partial<ObservabilityAlertsTableProps> = {}) =>
  render(<ObservabilityAlertsTable {...mockProps} {...props} />, {
    wrapper: MemoryRouter,
  });

describe('ObservabilityAlertsTable component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the table with alert rows when data is present', () => {
    renderTable();

    expect(screen.getByTestId('alert-table')).toBeInTheDocument();
    expect(screen.getByTestId('alert-name')).toBeInTheDocument();
    expect(screen.getByTestId('alert-actions')).toBeInTheDocument();
  });

  it('should not render rows while loading', () => {
    renderTable({ loading: true, alerts: [] });

    expect(screen.queryByTestId('alert-name')).not.toBeInTheDocument();
    expect(screen.queryByTestId('empty-placeholder')).not.toBeInTheDocument();
  });

  it('should render the features EmptyPlaceholder when there are no alerts', () => {
    renderTable({ alerts: [], loading: false });

    expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
    expect(
      screen.getByText('message.observability-alert-empty-heading')
    ).toBeInTheDocument();
    expect(screen.getByText('label.pick-a-trigger')).toBeInTheDocument();
    expect(
      screen.getByText('label.choose-the-destination')
    ).toBeInTheDocument();
    expect(screen.getByText('label.stay-ahead')).toBeInTheDocument();
  });

  it('should render the new-alert action when the user has create permission and invoke onAddAlert on click', () => {
    renderTable({
      alerts: [],
      loading: false,
      alertResourcePermission: { Create: true } as OperationPermission,
    });

    const addButton = screen.getByText('label.new-entity');
    fireEvent.click(addButton);

    expect(mockOnAddAlert).toHaveBeenCalledTimes(1);
  });

  it('should not render the new-alert action when the user lacks create permission', () => {
    renderTable({
      alerts: [],
      loading: false,
      alertResourcePermission: {
        Create: false,
        All: false,
      } as OperationPermission,
    });

    expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
    expect(screen.queryByText('label.new-entity')).not.toBeInTheDocument();
  });

  it('should render pagination when showPagination is true', () => {
    renderTable();

    expect(screen.getByTestId('next-previous')).toBeInTheDocument();
  });

  it('should not render pagination when showPagination is false', () => {
    renderTable({ showPagination: false });

    expect(screen.queryByTestId('next-previous')).not.toBeInTheDocument();
  });
});
