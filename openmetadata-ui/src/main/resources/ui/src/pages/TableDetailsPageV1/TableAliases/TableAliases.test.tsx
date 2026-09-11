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
import { TableAliases } from './TableAliases.component';

const mockUseGenericContext = jest.fn();

jest.mock(
  '../../../components/Customization/GenericProvider/GenericContext',
  () => ({
    useGenericContext: () => mockUseGenericContext(),
  })
);

jest.mock('../../../components/common/WidgetCard/WidgetCard', () => ({
  __esModule: true,
  default: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title: string;
  }) => (
    <div data-testid="widget-card">
      <span>{title}</span>
      {children}
    </div>
  ),
}));

describe('TableAliases', () => {
  it('renders only the alias name, not the fully qualified name', () => {
    mockUseGenericContext.mockReturnValue({
      data: {
        aliases: [
          'svc.analytics_core.dbo.mayur',
          'svc.analytics_core.dbo.apple',
        ],
      },
      filterWidgets: jest.fn(),
    });

    render(<TableAliases />);

    expect(screen.getByText('mayur')).toBeInTheDocument();
    expect(screen.getByText('apple')).toBeInTheDocument();
    expect(
      screen.queryByText('svc.analytics_core.dbo.mayur')
    ).not.toBeInTheDocument();
  });

  it('keeps the full fully qualified name available on hover', () => {
    mockUseGenericContext.mockReturnValue({
      data: { aliases: ['svc.analytics_core.dbo.mayur'] },
      filterWidgets: jest.fn(),
    });

    render(<TableAliases />);

    // The full FQN is surfaced by the design-system Tooltip on hover (a
    // react-aria overlay that jsdom does not render). What is verifiable here is
    // that the truncated name is a Focusable tooltip trigger — Focusable clones
    // tabindex="-1" onto it — rather than plain text; the hover overlay itself is
    // covered by playwright/e2e/Pages/TableAliases.spec.ts.
    expect(screen.getByText('mayur')).toHaveAttribute('tabindex', '-1');
  });

  it('does not split a quoted name part that contains a dot', () => {
    mockUseGenericContext.mockReturnValue({
      data: { aliases: ['svc.analytics_core.dbo."order.items"'] },
      filterWidgets: jest.fn(),
    });

    render(<TableAliases />);

    expect(screen.getByText('order.items')).toBeInTheDocument();
  });

  it('renders nothing when there are no aliases', () => {
    mockUseGenericContext.mockReturnValue({
      data: { aliases: [] },
      filterWidgets: jest.fn(),
    });

    const { container } = render(<TableAliases />);

    expect(container).toBeEmptyDOMElement();
  });

  it('offers no edit control, because aliases are source-managed', () => {
    mockUseGenericContext.mockReturnValue({
      data: { aliases: ['svc.analytics_core.dbo.mayur'] },
      filterWidgets: jest.fn(),
    });

    render(<TableAliases />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
