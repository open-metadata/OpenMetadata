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
import { ROUTES } from '../../../../constants/constants';
import SidebarBrand from './SidebarBrand';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

let mockCustomLogoConfig: Record<string, string> = {};
let mockTheme = 'light';
jest.mock('../../../../context/UntitledUIThemeProvider/theme-provider', () => ({
  useResolvedTheme: () => mockTheme,
}));
jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    applicationConfig: { customLogoConfig: mockCustomLogoConfig },
  }),
}));

jest.mock('../../../common/BrandImage/BrandImage', () =>
  jest.fn(({ isMonoGram }) => (
    <img alt="" data-testid={isMonoGram ? 'custom-monogram' : 'custom-logo'} />
  ))
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../utils/BrandData/BrandClassBase', () => ({
  __esModule: true,
  default: {
    getSidebarLogo: () => ({ svg: () => <svg data-testid="logo" /> }),
    getSidebarMonogram: () => ({ svg: () => <svg data-testid="monogram" /> }),
  },
}));

describe('SidebarBrand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCustomLogoConfig = {};
    mockTheme = 'light';
  });

  // `/my-data` is the personal-space My Data page in app mode; the brand is
  // the way home, which is the landing page at `/`.
  it.each(['panel', 'rail'] as const)(
    'leads to the home page from the %s',
    (variant) => {
      render(<SidebarBrand variant={variant} />);

      fireEvent.click(screen.getByTestId('ask-logo-btn'));

      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.HOME);
      expect(mockNavigate).not.toHaveBeenCalledWith(ROUTES.MY_DATA);
    }
  );

  it('is named Home for assistive tech', () => {
    render(<SidebarBrand />);

    expect(screen.getByRole('button', { name: 'label.home' })).toBeVisible();
  });

  it('shows the build brand mark when no custom logo is set', () => {
    const { rerender } = render(<SidebarBrand />);

    expect(screen.getByTestId('logo')).toBeInTheDocument();

    rerender(<SidebarBrand variant="rail" />);

    expect(screen.getByTestId('monogram')).toBeInTheDocument();
  });

  it('shows the admin custom logo and monogram when set', () => {
    mockCustomLogoConfig = {
      customLogoUrlPath: 'https://cdn.example.com/logo.svg',
      customMonogramUrlPath: 'https://cdn.example.com/mark.svg',
    };
    const { rerender } = render(<SidebarBrand />);

    expect(screen.getByTestId('custom-logo')).toBeInTheDocument();
    expect(screen.queryByTestId('logo')).not.toBeInTheDocument();

    rerender(<SidebarBrand variant="rail" />);

    expect(screen.getByTestId('custom-monogram')).toBeInTheDocument();
  });

  it('uses a dark-only custom logo in the dark theme and the build mark in light', () => {
    mockCustomLogoConfig = {
      customLogoDarkUrlPath: 'https://cdn.example.com/logo-dark.svg',
    };
    const { rerender } = render(<SidebarBrand />);

    expect(screen.getByTestId('logo')).toBeInTheDocument();

    mockTheme = 'dark';
    rerender(<SidebarBrand />);

    expect(screen.getByTestId('custom-logo')).toBeInTheDocument();
  });
});
