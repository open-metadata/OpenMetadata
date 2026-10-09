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
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { usePersonalSpaceStore } from '../../../../../../hooks/usePersonalSpaceStore';
import { useSettingsHash } from '../../../../../../hooks/useSettingsHash';
import type { ProfileHeaderOverride } from '../../profileNavConfig';
import type { PersonaDetailTab, PersonaView } from './Personas.types';
import PersonasPanel from './PersonasPanel';

jest.mock('./PersonasLanding', () => ({
  __esModule: true,
  default: ({ onNavigate }: { onNavigate: (view: PersonaView) => void }) => (
    <button
      data-testid="personas-landing"
      onClick={() => onNavigate({ type: 'detail', fqn: 'p1', name: 'p1' })}>
      landing
    </button>
  ),
}));

jest.mock('./PersonaAddForm', () => ({
  __esModule: true,
  default: ({ onCancel }: { onCancel: () => void }) => (
    <button data-testid="persona-add-form" onClick={onCancel}>
      add
    </button>
  ),
}));

jest.mock('./PersonaDetail', () => ({
  __esModule: true,
  default: (props: {
    activeTab: PersonaDetailTab;
    fqn: string;
    subCategory?: string;
    onDeleted: () => void;
    onRename: (name: string) => void;
    onSelectCategory: (category: string) => void;
    onTabChange: (tab: PersonaDetailTab) => void;
  }) => (
    <div
      data-active-tab={props.activeTab}
      data-fqn={props.fqn}
      data-sub-category={props.subCategory ?? ''}
      data-testid="persona-detail">
      <button
        data-testid="detail-rename"
        onClick={() => props.onRename('Data Steward')}>
        detail-rename
      </button>
      <button
        data-testid="detail-select-navigation"
        onClick={() => props.onSelectCategory('navigation')}>
        detail-select-navigation
      </button>
      <button
        data-testid="detail-select-users-tab"
        onClick={() => props.onTabChange('users')}>
        detail-select-users-tab
      </button>
      <button data-testid="detail-delete" onClick={props.onDeleted}>
        detail-delete
      </button>
    </div>
  ),
}));

const mockEditorSave = jest.fn();

jest.mock('./customize/PersonaCustomizeView', () => ({
  __esModule: true,
  default: (props: {
    category: string;
    personaFqn: string;
    onBack: () => void;
    onEditorActionsChange?: (actions: {
      canSave: boolean;
      onSave: () => void;
      onReset: () => void;
    }) => void;
  }) => (
    <>
      <button
        data-category={props.category}
        data-fqn={props.personaFqn}
        data-testid="persona-customize-view"
        onClick={props.onBack}>
        customize
      </button>
      <button
        data-testid="make-editor-dirty"
        onClick={() =>
          props.onEditorActionsChange?.({
            canSave: true,
            onSave: mockEditorSave,
            onReset: jest.fn(),
          })
        }
      />
    </>
  ),
}));

const HashProbe = () => {
  const { state } = useSettingsHash();

  return (
    <span data-testid="hash-probe">
      {`${state.tab}|${state.subPath}|${state.params.tab ?? ''}`}
    </span>
  );
};

const Host = () => {
  const [header, setHeader] = useState<ProfileHeaderOverride | null>(null);

  return (
    <>
      <h1 data-testid="header-title">{header?.title}</h1>
      {header?.breadcrumbs?.map((crumb) => (
        <button
          data-testid={`crumb-${crumb.id}`}
          key={crumb.id}
          onClick={() => header.onBreadcrumbAction?.(crumb.id)}>
          {crumb.label}
        </button>
      ))}
      {header?.actions}
      <PersonasPanel onHeaderChange={setHeader} />
      <HashProbe />
    </>
  );
};

const renderAt = (hash: string) => {
  window.history.replaceState(null, '', `/${hash}`);

  return render(
    <MemoryRouter initialEntries={[`/${hash}`]}>
      <Host />
    </MemoryRouter>
  );
};

const crumbIds = () =>
  screen.getAllByTestId(/^crumb-/).map((crumb) => crumb.dataset.testid);

describe('PersonasPanel', () => {
  beforeEach(() => {
    usePersonalSpaceStore.setState({
      activePanel: 'profile',
      suppressHashClear: false,
    });
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  });

  it('renders the landing view with the personas header', () => {
    renderAt('#personas');

    expect(screen.getByTestId('personas-landing')).toBeInTheDocument();
    expect(screen.getByTestId('header-title')).toHaveTextContent(
      'label.persona-plural'
    );
    expect(crumbIds()).toEqual(['crumb-settings', 'crumb-current']);
  });

  it('opens the add form from the header action and returns on cancel', () => {
    renderAt('#personas');

    fireEvent.click(screen.getByTestId('add-persona-button'));

    expect(screen.getByTestId('persona-add-form')).toBeInTheDocument();
    expect(screen.getByTestId('hash-probe')).toHaveTextContent('personas|add|');
    expect(screen.getByTestId('header-title')).toHaveTextContent(
      'label.add-entity'
    );

    fireEvent.click(screen.getByTestId('persona-add-form'));

    expect(screen.getByTestId('personas-landing')).toBeInTheDocument();
    expect(screen.getByTestId('hash-probe')).toHaveTextContent('personas||');
  });

  it('navigates from the landing to the persona detail', () => {
    renderAt('#personas');

    fireEvent.click(screen.getByTestId('personas-landing'));

    expect(screen.getByTestId('persona-detail')).toHaveAttribute(
      'data-fqn',
      'p1'
    );
    expect(screen.getByTestId('hash-probe')).toHaveTextContent('personas|p1|');
  });

  it('renders the detail view with the default tab and the resolved name', () => {
    renderAt('#personas/p1');

    const detail = screen.getByTestId('persona-detail');

    expect(detail).toHaveAttribute('data-active-tab', 'customize-ui');
    expect(detail).toHaveAttribute('data-sub-category', '');
    expect(screen.getByTestId('header-title')).toHaveTextContent('p1');
    expect(crumbIds()).toEqual([
      'crumb-settings',
      'crumb-personas',
      'crumb-current',
    ]);

    fireEvent.click(screen.getByTestId('detail-rename'));

    expect(screen.getByTestId('header-title')).toHaveTextContent(
      'Data Steward'
    );
  });

  it('reads the active tab from the hash', () => {
    renderAt('#personas/p1?tab=users');

    expect(screen.getByTestId('persona-detail')).toHaveAttribute(
      'data-active-tab',
      'users'
    );
  });

  it('writes tab changes back to the hash', () => {
    renderAt('#personas/p1');

    fireEvent.click(screen.getByTestId('detail-select-users-tab'));

    expect(screen.getByTestId('hash-probe')).toHaveTextContent(
      'personas|p1|users'
    );
    expect(screen.getByTestId('persona-detail')).toHaveAttribute(
      'data-active-tab',
      'users'
    );
  });

  it('returns to the landing from the personas breadcrumb and on delete', () => {
    renderAt('#personas/p1');

    fireEvent.click(screen.getByTestId('crumb-personas'));

    expect(screen.getByTestId('personas-landing')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('personas-landing'));
    fireEvent.click(screen.getByTestId('detail-delete'));

    expect(screen.getByTestId('personas-landing')).toBeInTheDocument();
  });

  it.each(['governance', 'data-assets'])(
    'keeps the detail page for the %s sub-grid category',
    (category) => {
      renderAt(`#personas/p1/customize/${category}`);

      expect(screen.getByTestId('persona-detail')).toHaveAttribute(
        'data-sub-category',
        category
      );
      expect(crumbIds()).toEqual([
        'crumb-settings',
        'crumb-personas',
        'crumb-detail',
        'crumb-current',
      ]);
      expect(
        screen.queryByTestId('persona-customize-view')
      ).not.toBeInTheDocument();
    }
  );

  it('returns from a sub-grid category to the persona detail via the breadcrumb', () => {
    renderAt('#personas/p1/customize/governance');

    expect(screen.getByTestId('crumb-current')).toHaveTextContent(
      'label.governance'
    );

    fireEvent.click(screen.getByTestId('crumb-detail'));

    expect(screen.getByTestId('persona-detail')).toHaveAttribute(
      'data-sub-category',
      ''
    );
    expect(screen.getByTestId('hash-probe')).toHaveTextContent('personas|p1|');
  });

  it('renders the in-modal customize editor for a non-fullscreen category', async () => {
    renderAt('#personas/p1');

    fireEvent.click(screen.getByTestId('detail-select-navigation'));

    const view = await screen.findByTestId('persona-customize-view');

    expect(view).toHaveAttribute('data-category', 'navigation');
    expect(view).toHaveAttribute('data-fqn', 'p1');
    expect(screen.getByTestId('header-title')).toHaveTextContent(
      'label.navigation'
    );
    expect(screen.getByTestId('hash-probe')).toHaveTextContent(
      'personas|p1/customize/navigation|'
    );

    fireEvent.click(view);

    expect(screen.getByTestId('persona-detail')).toBeInTheDocument();
  });

  it.each(['LandingPage', 'homepage', 'data-assets/Table'])(
    'hands the %s category over to the fullscreen view and closes silently',
    (category) => {
      renderAt(`#personas/p1/customize/${category}`);

      expect(screen.queryByTestId('persona-detail')).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('persona-customize-view')
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId('personas-landing')).not.toBeInTheDocument();
      expect(usePersonalSpaceStore.getState()).toEqual(
        expect.objectContaining({ activePanel: null, suppressHashClear: true })
      );
    }
  );

  describe('unsaved in-modal customize changes', () => {
    const openDirtyEditor = async () => {
      renderAt('#personas/p1/customize/navigation');
      fireEvent.click(await screen.findByTestId('make-editor-dirty'));
    };

    it('asks before a breadcrumb leaves and discards on confirm', async () => {
      await openDirtyEditor();

      fireEvent.click(screen.getByTestId('crumb-detail'));

      expect(
        await screen.findByTestId('unsaved-changes-modal')
      ).toBeInTheDocument();
      expect(screen.getByTestId('persona-customize-view')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('unsaved-changes-modal-discard'));

      expect(await screen.findByTestId('persona-detail')).toBeInTheDocument();
      expect(mockEditorSave).not.toHaveBeenCalled();
    });

    it('saves the editor before leaving when the user picks save', async () => {
      await openDirtyEditor();

      fireEvent.click(screen.getByTestId('persona-customize-view'));
      fireEvent.click(await screen.findByTestId('unsaved-changes-modal-save'));

      expect(await screen.findByTestId('persona-detail')).toBeInTheDocument();
      expect(mockEditorSave).toHaveBeenCalledTimes(1);
    });

    it('intercepts closing the modal through the exit guard', async () => {
      await openDirtyEditor();
      const close = jest.fn();

      let intercepted = false;
      act(() => {
        intercepted =
          usePersonalSpaceStore.getState().exitGuard?.(close) ?? false;
      });

      expect(intercepted).toBe(true);
      expect(
        await screen.findByTestId('unsaved-changes-modal')
      ).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('unsaved-changes-modal-discard'));

      expect(close).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps the modal open for in-modal views', () => {
    renderAt('#personas/p1');

    expect(usePersonalSpaceStore.getState().activePanel).toBe('profile');
  });
});
