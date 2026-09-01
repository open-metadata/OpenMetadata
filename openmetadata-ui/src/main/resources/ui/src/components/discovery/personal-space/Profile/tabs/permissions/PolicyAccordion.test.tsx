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
import { ReactNode } from 'react';
import { PolicyInfo } from 'rest/permissionAPI';

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: (ref: { name?: string }) => ref?.name ?? '',
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  Badge: ({ children, color }: { children?: ReactNode; color?: string }) => (
    <span data-color={color} data-testid="badge">
      {children}
    </span>
  ),
  Accordion: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  AccordionHeader: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  AccordionPanel: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

import PolicyAccordion from './PolicyAccordion';

const POLICY: PolicyInfo = {
  policy: { name: 'DataConsumerPolicy', type: 'policy' },
  effect: 'ALLOW',
  rules: [
    {
      name: 'EditRule',
      effect: 'ALLOW',
      operations: ['EditDescription'],
      resources: ['All'],
      matches: true,
    },
  ],
} as PolicyInfo;

describe('PolicyAccordion', () => {
  it('renders policy name, effect badge and rule count', () => {
    render(<PolicyAccordion policy={POLICY} />);

    expect(screen.getByText('DataConsumerPolicy')).toBeInTheDocument();
    // The first Badge is the accordion header effect badge.
    expect(screen.getAllByTestId('badge')[0]).toHaveAttribute(
      'data-color',
      'success'
    );
    expect(screen.getByText('label.rule-plural: 1')).toBeInTheDocument();
  });

  it('renders each rule with its operations and resources', () => {
    render(<PolicyAccordion defaultExpanded policy={POLICY} />);

    expect(screen.getByText('EditDescription')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
  });
});
