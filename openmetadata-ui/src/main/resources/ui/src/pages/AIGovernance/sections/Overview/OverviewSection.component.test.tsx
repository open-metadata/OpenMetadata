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
import { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { HeroStrip } from './OverviewSection.component';

const mockNavigate = jest.fn();

const labels: Record<string, string> = {
  'label.ai-governance': 'AI GOVERNANCE',
  'message.estate-mostly-compliant': '2 items need attention',
  'message.estate-fully-compliant': 'Estate fully compliant',
  'message.estate-summary': '70% ready, 1 high risk, 1 shadow',
  'label.export-audit-pack': 'Export audit pack',
  'label.configure-risk-council': 'Configure risk council',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => labels[key] ?? key,
  }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../../components/AIGovUntitled.component', () => ({
  Button: ({
    children,
    className,
    icon,
    type: _type,
    ...props
  }: {
    children?: ReactNode;
    className?: string;
    icon?: ReactNode;
    type?: string;
  } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>) => (
    <button className={className} type="button" {...props}>
      {icon}
      {children}
    </button>
  ),
  Col: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Row: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Space: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  Typography: {
    Paragraph: ({
      children,
      className,
    }: {
      children?: ReactNode;
      className?: string;
    }) => <p className={className}>{children}</p>,
    Title: ({
      children,
      className,
      style,
    }: {
      children?: ReactNode;
      className?: string;
      style?: CSSProperties;
    }) => (
      <h2 className={className} style={style}>
        {children}
      </h2>
    ),
  },
}));

describe('HeroStrip', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders the governance badge as a compact inline span', () => {
    const { container } = render(
      <HeroStrip euReadiness={70} highRisk={1} shadow={1} />
    );
    const badge = container.querySelector('.ai-gov-hero-badge');

    expect(badge?.tagName).toBe('SPAN');
    expect(badge).toHaveTextContent('AI GOVERNANCE');
    expect(screen.getByText('Export audit pack')).toBeInTheDocument();
    expect(screen.getByText(/Configure risk council/)).toBeInTheDocument();
  });

  it('routes hero actions to audit reports and approvals', () => {
    render(<HeroStrip euReadiness={70} highRisk={1} shadow={1} />);

    fireEvent.click(screen.getByText('Export audit pack'));
    fireEvent.click(screen.getByText(/Configure risk council/));

    expect(mockNavigate).toHaveBeenNthCalledWith(
      1,
      '/governance/ai-governance/reports?generate=1'
    );
    expect(mockNavigate).toHaveBeenNthCalledWith(
      2,
      '/governance/ai-governance/approvals'
    );
  });
});
