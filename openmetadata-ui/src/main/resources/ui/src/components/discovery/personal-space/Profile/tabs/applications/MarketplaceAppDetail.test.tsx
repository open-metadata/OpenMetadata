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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactElement } from 'react';
import { getApplicationByName } from '../../../../../../rest/applicationAPI';
import { getMarketPlaceApplicationByFqn } from '../../../../../../rest/applicationMarketPlaceAPI';
import type { ApplicationsHeader } from './Applications.types';
import MarketplaceAppDetail from './MarketplaceAppDetail';

jest.mock('react-i18next', () => {
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

jest.mock('../../../../../../utils/i18next/LocalUtil', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
  t: (key: string) => key,
  Transi18next: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
}));

jest.mock(
  '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1',
  () =>
    jest.fn(({ markdown }: { markdown: string }) => (
      <div data-testid="markdown">{markdown}</div>
    ))
);

jest.mock('../../../../../../rest/applicationAPI', () => ({
  getApplicationByName: jest.fn(),
}));

jest.mock('../../../../../../rest/applicationMarketPlaceAPI', () => ({
  getMarketPlaceApplicationByFqn: jest.fn(),
}));

const marketplaceApp = {
  id: '1',
  name: 'RdfIndexApp',
  fullyQualifiedName: 'RdfIndexApp',
  displayName: 'RDF Knowledge Graph Indexing',
  description: 'Sync metadata to RDF.',
  developer: 'Collate Inc.',
  supportEmail: 'support@getcollate.io',
  developerUrl: 'https://www.getcollate.io',
  privacyPolicyUrl: 'https://www.getcollate.io/privacy',
};

const onNavigate = jest.fn();
const onHeaderChange = jest.fn();

const renderDetail = async () => {
  const result = render(
    <MarketplaceAppDetail
      fqn="RdfIndexApp"
      onHeaderChange={onHeaderChange}
      onNavigate={onNavigate}
    />
  );
  await act(async () => undefined);

  return result;
};

const renderHeaderActions = () => {
  const header: ApplicationsHeader = onHeaderChange.mock.calls.at(-1)[0];

  return render(header.actions as ReactElement);
};

describe('MarketplaceAppDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getMarketPlaceApplicationByFqn as jest.Mock).mockResolvedValue(
      marketplaceApp
    );
    (getApplicationByName as jest.Mock).mockRejectedValue(new Error('404'));
  });

  it('renders overview, publisher and resources with core-ui only', async () => {
    const { container } = await renderDetail();

    expect(screen.getByTestId('markdown')).toHaveTextContent(
      'Sync metadata to RDF.'
    );
    expect(screen.getByText('label.publisher')).toBeInTheDocument();
    expect(screen.getByText('Collate Inc.')).toBeInTheDocument();
    expect(screen.getByTestId('app-support-email')).toHaveAttribute(
      'href',
      'mailto:support@getcollate.io'
    );
    expect(screen.getByTestId('developer-website')).toBeInTheDocument();
    expect(screen.getByTestId('privacy-policy')).toBeInTheDocument();
    expect(container.querySelector('[class*="ant-"]')).toBeNull();
  });

  it('puts an enabled Install button in the header for a new app', async () => {
    await renderDetail();
    renderHeaderActions();

    const install = screen.getByTestId('install-application');

    expect(install).toBeEnabled();

    fireEvent.click(install);

    expect(onNavigate).toHaveBeenCalledWith({
      type: 'install',
      fqn: 'RdfIndexApp',
    });
  });

  it('disables Install when the app is already installed', async () => {
    (getApplicationByName as jest.Mock).mockResolvedValue({ id: 'x' });
    await renderDetail();
    renderHeaderActions();

    expect(screen.getByTestId('install-application')).toBeDisabled();
    expect(screen.getByTestId('install-blocked-reason')).toBeInTheDocument();
  });

  it('disables Install and explains a paid add-on', async () => {
    (getMarketPlaceApplicationByFqn as jest.Mock).mockResolvedValue({
      ...marketplaceApp,
      enabled: false,
    });
    await renderDetail();

    expect(screen.getByTestId('install-blocked-alert')).toHaveTextContent(
      'message.paid-addon-description'
    );
    expect(screen.getByText('message.please-contact-us')).toBeInTheDocument();

    renderHeaderActions();

    expect(screen.getByTestId('install-application')).toBeDisabled();
  });

  it('hides resources the app does not define', async () => {
    (getMarketPlaceApplicationByFqn as jest.Mock).mockResolvedValue({
      ...marketplaceApp,
      supportEmail: undefined,
      privacyPolicyUrl: undefined,
    });
    await renderDetail();

    expect(screen.queryByTestId('app-support-email')).not.toBeInTheDocument();
    expect(screen.queryByTestId('privacy-policy')).not.toBeInTheDocument();
    expect(screen.getByTestId('developer-website')).toBeInTheDocument();
  });
});
