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
import AssignErrorPlaceHolder from './AssignErrorPlaceHolder';

jest.mock('./PermissionErrorPlaceholder', () =>
  jest.fn().mockReturnValue(<div data-testid="permission-error-placeholder" />)
);

describe('AssignErrorPlaceHolder', () => {
  it('renders the heading message and the action button', () => {
    render(
      <AssignErrorPlaceHolder
        permission
        button={<button>add</button>}
        heading="KPI">
        No KPIs yet
      </AssignErrorPlaceHolder>
    );

    expect(screen.getByText('No KPIs yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'add' })).toBeInTheDocument();
  });

  // Regression for #35838: bg-white is the page colour in dark mode, so the
  // placeholder showed as a black box on cards.
  it('paints the theme surface rather than the legacy white background', () => {
    render(<AssignErrorPlaceHolder permission heading="KPI" />);

    const placeholder = screen.getByTestId('assign-error-placeholder-KPI');

    expect(placeholder).toHaveClass('tw:bg-surface');
    expect(placeholder).not.toHaveClass('bg-white');
  });

  it('shows the permission placeholder when the user cannot assign', () => {
    render(<AssignErrorPlaceHolder heading="KPI" permission={false} />);

    expect(
      screen.getByTestId('permission-error-placeholder')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('assign-error-placeholder-KPI')
    ).not.toBeInTheDocument();
  });
});
