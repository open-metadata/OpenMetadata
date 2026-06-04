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
import { ButtonHTMLAttributes, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AIGovernanceTab } from '../AIGovernancePage.interface';
import AIGovernanceSecondaryNav from './AIGovernanceSecondaryNav.component';

const labels: Record<string, string> = {
  'label.ai-governance': 'AI Governance',
  'label.new': 'NEW',
  'label.overview': 'Overview',
  'label.ai-asset-registry': 'AI Asset Registry',
  'label.shadow-ai': 'Shadow AI',
  'label.approval-plural': 'Approvals',
  'label.framework-plural': 'Frameworks',
  'label.policies-and-drift': 'Policies & Drift',
  'label.audit-report-plural': 'Audit Reports',
  'label.register-ai-asset': 'Register AI Asset',
  'label.expand': 'Expand',
  'label.collapse': 'Collapse',
};

const navigate = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => labels[key] ?? key,
  }),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => navigate,
}));

jest.mock('./AIGovUntitled.component', () => ({
  Button: ({
    children,
    type: _type,
    ...props
  }: {
    children?: ReactNode;
    type?: string;
  } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

describe('AIGovernanceSecondaryNav', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders only AI Governance navigation with badges and register action', () => {
    const onOpenIntake = jest.fn();
    const { container } = render(
      <MemoryRouter>
        <AIGovernanceSecondaryNav
          activeTab={AIGovernanceTab.REGISTRY}
          approvalsCount={2}
          registryCount={9}
          shadowCount={3}
          onOpenIntake={onOpenIntake}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('AI Governance')).toBeInTheDocument();
    expect(screen.getByText('NEW')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('AI Asset Registry')).toBeInTheDocument();
    expect(screen.getByText('Shadow AI')).toBeInTheDocument();
    expect(screen.getByText('Approvals')).toBeInTheDocument();
    expect(screen.getByText('Frameworks')).toBeInTheDocument();
    expect(screen.getByText('Policies & Drift')).toBeInTheDocument();
    expect(screen.getByText('Audit Reports')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText('Governance')).not.toBeInTheDocument();
    expect(screen.queryByText('Workspace')).not.toBeInTheDocument();
    expect(screen.queryByText('Glossary')).not.toBeInTheDocument();
    expect(
      screen.getByTestId(`ai-gov-secondary-nav-${AIGovernanceTab.REGISTRY}`)
    ).toHaveClass('is-active');
    expect(
      container.querySelectorAll('.ai-gov-secondary-nav-item-icon-slot')
    ).toHaveLength(7);

    fireEvent.click(screen.getByTestId('ai-gov-secondary-nav-register'));

    expect(onOpenIntake).toHaveBeenCalledTimes(1);
  });
});
