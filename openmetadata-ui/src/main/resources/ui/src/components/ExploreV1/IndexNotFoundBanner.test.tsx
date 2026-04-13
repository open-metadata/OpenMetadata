/*
 *  Copyright 2023 Collate.
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
import { SEARCH_INDEXING_APPLICATION } from '../../constants/explore.constants';
import { getApplicationDetailsPath } from '../../utils/RouterUtils';
import { IndexNotFoundBanner } from './IndexNotFoundBanner';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    theme: {
      errorColor: '#ff4d4f',
    },
  }),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getApplicationDetailsPath: jest.fn().mockReturnValue('/settings/search'),
}));

jest.mock('../../utils/CommonUtils', () => ({
  Transi18next: jest
    .fn()
    .mockImplementation(({ i18nKey, renderElement, values }) => (
      <div data-testid="trans-i18next">
        {i18nKey}
        <span data-testid="trans-settings-value">{values?.settings}</span>
        {renderElement}
      </div>
    )),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: ({
    children,
    to,
    ...props
  }: {
    children?: React.ReactNode;
    to: string;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('antd', () => ({
  Alert: ({
    description,
    ...props
  }: {
    description?: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <div data-testid="index-not-found-alert" {...props}>
      {description}
    </div>
  ),
  Typography: {
    Text: ({ children }: { children?: React.ReactNode }) => (
      <span>{children}</span>
    ),
    Paragraph: ({ children }: { children?: React.ReactNode }) => (
      <p>{children}</p>
    ),
  },
}));

describe('IndexNotFoundBanner', () => {
  it('renders indexing error details and re-index help text', () => {
    render(<IndexNotFoundBanner />);

    expect(screen.getByTestId('index-not-found-alert')).toBeInTheDocument();
    expect(screen.getByText('server.indexing-error')).toBeInTheDocument();
    expect(screen.getByTestId('trans-i18next')).toHaveTextContent(
      'message.configure-search-re-index'
    );
    expect(screen.getByTestId('trans-settings-value')).toHaveTextContent(
      'label.search-index-setting-plural'
    );
  });

  it('builds the settings link using search indexing application path', () => {
    render(<IndexNotFoundBanner />);

    expect(getApplicationDetailsPath).toHaveBeenCalledWith(
      SEARCH_INDEXING_APPLICATION
    );

    const settingsLink = document.querySelector(
      '.alert-link'
    ) as HTMLAnchorElement;

    expect(settingsLink).toBeInTheDocument();
    expect(settingsLink.getAttribute('href')).toBe('/settings/search');
  });
});
