import {
  act,
  findAllByTestId,
  findAllByText,
  findByTestId,
  findByText,
  fireEvent,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  mockGetPolicyNoRuleData,
  mockGetPolicyWithRuleData,
  mockGetRole,
} from './RolePage.mock';
import RolesPage from './RolesPage.component';

jest.mock('../../axiosAPIs/rolesAPI', () => ({
  createRole: jest.fn(),
  getPolicy: jest.fn().mockImplementation((id: string) => {
    return Promise.resolve({
      data:
        id === 'noRule' ? mockGetPolicyNoRuleData : mockGetPolicyWithRuleData,
    });
  }),
  getRoleByName: jest.fn(),
  getRoles: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockGetRole })),
  updatePolicy: jest.fn(),
  updateRole: jest.fn(),
}));

jest.mock('../../auth-provider/AuthProvider', () => {
  return {
    useAuthContext: jest.fn(() => ({
      isAuthDisabled: false,
      isAuthenticated: true,
      isProtectedRoute: jest.fn().mockReturnValue(true),
      isTourRoute: jest.fn().mockReturnValue(false),
      onLogoutHandler: jest.fn(),
    })),
  };
});

jest.mock(
  '../../components/containers/PageLayout',
  () =>
    ({
      children,
      leftPanel,
      rightPanel,
    }: {
      children: React.ReactNode;
      rightPanel: React.ReactNode;
      leftPanel: React.ReactNode;
    }) =>
      (
        <div data-testid="PageLayout">
          <div data-testid="left-panel-content">{leftPanel}</div>
          <div data-testid="right-panel-content">{rightPanel}</div>
          {children}
        </div>
      )
);

jest.mock('../../components/common/non-admin-action/NonAdminAction', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <span>{children}</span>
    ));
});

jest.mock('../../components/containers/PageContainerV1', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <div data-testid="PageContainerV1">{children}</div>
    ));
});

jest.mock('../../components/common/description/Description', () => {
  return jest.fn().mockReturnValue(<p>Description component</p>);
});

jest.mock('../../components/Modals/ConfirmationModal/ConfirmationModal', () => {
  return jest.fn().mockReturnValue(<p>ConfirmationModal component</p>);
});

jest.mock('../../components/Modals/RulesModal/AddRuleModal', () => {
  return jest.fn().mockReturnValue(<p>AddRuleModal component</p>);
});

jest.mock('../teams/Form', () => {
  return jest.fn().mockReturnValue(<p>Form component</p>);
});

jest.mock('../teams/UserCard', () => {
  return jest.fn().mockReturnValue(<p>UserCardComponent</p>);
});

describe('Test RolesPage component', () => {
  it('RolesPage component should render properly', async () => {
    const { container } = render(<RolesPage />, {
      wrapper: MemoryRouter,
    });

    const PageContainerV1 = await findByTestId(container, 'PageContainerV1');
    const PageLayout = await findByTestId(container, 'PageLayout');
    const leftPanelContent = await findByTestId(
      container,
      'left-panel-content'
    );
    const leftPanelTitle = await findByTestId(container, 'left-panel-title');
    const leftPanelAddRoleButton = await findByTestId(container, 'add-role');
    const roleNames = await findAllByTestId(container, 'role-name-container');

    const roleContainer = await findByTestId(container, 'role-container');
    const header = await findByTestId(container, 'header');
    const headerTitle = await findByTestId(container, 'header-title');
    const addNewRuleButton = await findByTestId(
      container,
      'add-new-rule-button'
    );
    const tabs = await findByTestId(container, 'tabs');
    const description = await findByText(container, /Description component/i);

    expect(PageContainerV1).toBeInTheDocument();
    expect(PageLayout).toBeInTheDocument();
    expect(leftPanelContent).toBeInTheDocument();
    expect(leftPanelTitle).toBeInTheDocument();
    expect(leftPanelAddRoleButton).toBeInTheDocument();
    expect(roleNames.length).toBe(mockGetRole.data.length);
    expect(roleNames[0]).toHaveClass('activeCategory');
    expect(roleContainer).toBeInTheDocument();
    expect(header).toBeInTheDocument();
    expect(headerTitle).toBeInTheDocument();
    expect(headerTitle.textContent).toBe(mockGetRole.data[0].displayName);
    expect(addNewRuleButton).toBeInTheDocument();
    expect(tabs).toBeInTheDocument();
    expect(tabs.childElementCount).toBe(3);
    expect(tabs.children[0].textContent).toBe('Policy');
    expect(tabs.children[1].textContent).toBe('Teams');
    expect(tabs.children[2].textContent).toBe('Users');
    expect(tabs.children[0]).toHaveClass('active');
    expect(description).toBeInTheDocument();
  });

  it('Check no rule, no user and no teams behaviour', async () => {
    const { container } = render(<RolesPage />, {
      wrapper: MemoryRouter,
    });
    // checking No rules. directly as there is no data available on 1st instance

    const usersButton = await findByTestId(container, 'users');
    const teamsButton = await findByTestId(container, 'teams');

    expect(await findByText(container, /No rules./i)).toBeInTheDocument();

    fireEvent.click(usersButton);

    expect(await findByText(container, /No Users Added./i)).toBeInTheDocument();

    fireEvent.click(teamsButton);

    expect(await findByText(container, /No Teams Added./i)).toBeInTheDocument();
  });

  it('Check behaviour when there is data in policy and user', async () => {
    const { container } = render(<RolesPage />, {
      wrapper: MemoryRouter,
    });
    const roleNames = await findAllByTestId(container, 'role-name-container');
    const usersButton = await findByTestId(container, 'users');
    fireEvent.click(roleNames[1]);

    expect(roleNames[1]).toHaveClass('activeCategory');

    await act(async () => {
      fireEvent.click(roleNames[1]);

      expect(roleNames[1]).toHaveClass('activeCategory');
    });

    const headerTitle = await findByTestId(container, 'header-title');
    const table = await findByTestId(container, 'table');
    const tableHeading = await findAllByTestId(container, 'table-heading');

    expect(headerTitle).toBeInTheDocument();
    expect(headerTitle.textContent).toBe(mockGetRole.data[1].displayName);
    expect(table).toBeInTheDocument();
    expect(tableHeading.map((heading) => heading.textContent)).toStrictEqual([
      'Operation',
      'Access',
      'Enabled',
      'Action',
    ]);

    fireEvent.click(usersButton);
    const users = await findAllByText(container, /UserCardComponent/);

    expect(usersButton).toHaveClass('active');
    expect(users.length).toBe(mockGetRole.data[1].users.length);
  });

  it('CTA should work', async () => {
    const { container } = render(<RolesPage />, {
      wrapper: MemoryRouter,
    });

    const addRoleButton = await findByTestId(container, 'add-role');
    const addNewRuleButton = await findByTestId(
      container,
      'add-new-rule-button'
    );
    fireEvent.click(addRoleButton);

    expect(await findByText(container, /Form component/i)).toBeInTheDocument();

    fireEvent.click(addNewRuleButton);

    expect(
      await findByText(container, /AddRuleModal component/i)
    ).toBeInTheDocument();
  });
});
