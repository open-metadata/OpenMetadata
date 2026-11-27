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
import { MemoryRouter } from 'react-router-dom';
import { usePersonalSpaceStore } from '../../../../hooks/usePersonalSpaceStore';
import { useSettingsHash } from '../../../../hooks/useSettingsHash';
import { useCustomizePageChrome } from '../../../MyData/CustomizableComponents/CustomizablePageHeader/CustomizePageChrome.context';
import PersonaFullscreenPortal from './PersonaFullscreenPortal';

jest.mock('../Profile/tabs/personas/customize/PersonaCustomizeView', () => ({
  __esModule: true,
  default: function MockPersonaCustomizeView(props: {
    category: string;
    personaFqn: string;
    onBack: () => void;
    onRename: (name: string) => void;
  }) {
    const chrome = useCustomizePageChrome();

    return (
      <div
        data-category={props.category}
        data-fqn={props.personaFqn}
        data-testid="persona-customize-view">
        {chrome?.breadcrumbs.map((crumb) => (
          <button
            data-testid={`crumb-${crumb.id}`}
            key={crumb.id}
            onClick={() => chrome.onNavigate(String(crumb.id))}>
            {crumb.label}
          </button>
        ))}
        <button
          data-testid="chrome-back"
          onClick={() => chrome?.onNavigate('back')}>
          chrome-back
        </button>
        <button data-testid="view-back" onClick={props.onBack}>
          view-back
        </button>
        <button
          data-testid="view-rename"
          onClick={() => props.onRename('Data Steward')}>
          view-rename
        </button>
      </div>
    );
  },
}));

const HashProbe = () => {
  const { state } = useSettingsHash();

  return (
    <span data-testid="hash-probe">{`${state.tab}|${state.subPath}`}</span>
  );
};

const renderAt = (hash: string) => {
  window.history.replaceState(null, '', `/${hash}`);

  return render(
    <MemoryRouter initialEntries={[`/${hash}`]}>
      <PersonaFullscreenPortal />
      <HashProbe />
    </MemoryRouter>
  );
};

const crumbIds = () =>
  screen.getAllByTestId(/^crumb-/).map((crumb) => crumb.dataset.testid);

describe('PersonaFullscreenPortal', () => {
  beforeEach(() => {
    usePersonalSpaceStore.setState({
      activePanel: null,
      suppressHashClear: true,
    });
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  });

  it.each([
    '#personas',
    '#personas/p1',
    '#personas/p1/customize/navigation',
    '#personas/p1/customize/governance',
    '#profile',
  ])('renders nothing for the in-modal hash %s', (hash) => {
    renderAt(hash);

    expect(
      screen.queryByTestId('persona-fullscreen-view')
    ).not.toBeInTheDocument();
  });

  it('renders the home page customize view with its breadcrumbs', async () => {
    renderAt('#personas/p1/customize/LandingPage');

    const view = await screen.findByTestId('persona-customize-view');

    expect(screen.getByTestId('persona-fullscreen-view')).toBeInTheDocument();
    expect(view).toHaveAttribute('data-category', 'LandingPage');
    expect(view).toHaveAttribute('data-fqn', 'p1');
    expect(crumbIds()).toEqual([
      'crumb-settings',
      'crumb-personas',
      'crumb-persona',
      'crumb-current',
    ]);
    expect(screen.getByTestId('crumb-persona')).toHaveTextContent('p1');
    expect(screen.getByTestId('crumb-current')).toHaveTextContent(
      'label.home-page'
    );
  });

  it('falls back to the raw category when it has no known label', async () => {
    renderAt('#personas/p1/customize/homepage');

    expect(await screen.findByTestId('crumb-current')).toHaveTextContent(
      'homepage'
    );
  });

  it('adds the parent category crumb for an entity-level category', async () => {
    renderAt('#personas/p1/customize/data-assets/Table');

    expect(await screen.findByTestId('crumb-parent')).toHaveTextContent(
      'label.data-asset-plural'
    );
    expect(screen.getByTestId('crumb-current')).toHaveTextContent('Table');
  });

  it('shows the resolved persona name once the view reports it', async () => {
    renderAt('#personas/p1/customize/LandingPage');

    fireEvent.click(await screen.findByTestId('view-rename'));

    expect(screen.getByTestId('crumb-persona')).toHaveTextContent(
      'Data Steward'
    );
  });

  it.each([
    ['settings', 'personas|'],
    ['personas', 'personas|'],
    ['persona', 'personas|p1'],
    ['current', 'personas|p1/customize/LandingPage'],
  ])(
    'navigating to the %s crumb sets the hash to %s',
    async (crumbId, expectedHash) => {
      renderAt('#personas/p1/customize/LandingPage');

      fireEvent.click(await screen.findByTestId(`crumb-${crumbId}`));

      expect(screen.getByTestId('hash-probe')).toHaveTextContent(expectedHash);
    }
  );

  it('re-opens the profile modal and hides itself when leaving', async () => {
    renderAt('#personas/p1/customize/LandingPage');

    fireEvent.click(await screen.findByTestId('crumb-persona'));

    expect(usePersonalSpaceStore.getState()).toEqual(
      expect.objectContaining({
        activePanel: 'profile',
        suppressHashClear: false,
      })
    );
    expect(
      screen.queryByTestId('persona-fullscreen-view')
    ).not.toBeInTheDocument();
  });

  it('goes back to the persona detail from a base category', async () => {
    renderAt('#personas/p1/customize/LandingPage');

    fireEvent.click(await screen.findByTestId('chrome-back'));

    expect(screen.getByTestId('hash-probe')).toHaveTextContent('personas|p1');
    expect(usePersonalSpaceStore.getState().activePanel).toBe('profile');
  });

  it.each(['chrome-back', 'view-back', 'crumb-parent'])(
    'goes back to the parent sub-grid from an entity category via %s',
    async (testId) => {
      renderAt('#personas/p1/customize/data-assets/Table');

      fireEvent.click(await screen.findByTestId(testId));

      expect(screen.getByTestId('hash-probe')).toHaveTextContent(
        'personas|p1/customize/data-assets'
      );
      expect(usePersonalSpaceStore.getState().activePanel).toBe('profile');
    }
  );
});
