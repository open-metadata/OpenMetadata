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

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Persona } from '../../../../generated/entity/teams/persona';
import {
  AppMode,
  PageViewMode,
  PersonaPreferences,
} from '../../../../generated/type/personaPreferences';
import { useCustomizeStore } from '../../../CustomizablePage/CustomizeStore';
import { PersonaAppLayoutPage } from './PersonaAppLayoutPage';

jest.mock('../../../../components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock(
  '../../../../components/common/NavigationBlocker/NavigationBlocker',
  () => ({
    NavigationBlocker: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  })
);

const personaId = 'persona-1';
const persona = { id: personaId, name: 'analytics' } as Persona;

const seedDoc = (
  preferences: Pick<
    PersonaPreferences,
    'appMode' | 'defaultLandingPage' | 'defaultViewModes'
  > = {}
) => {
  useCustomizeStore.setState({
    document: {
      id: 'doc-1',
      name: 'persona.analytics',
      fullyQualifiedName: 'persona.analytics',
      entityType: 'persona',
      data: {
        personaPreferences: [
          { personaId, personaName: 'analytics', ...preferences },
        ],
      },
    } as never,
  });
};

const renderPage = (onSave = jest.fn().mockResolvedValue(undefined)) => {
  render(
    <MemoryRouter>
      <PersonaAppLayoutPage personaDetails={persona} onSave={onSave} />
    </MemoryRouter>
  );

  return onSave;
};

const getSaveButton = () => screen.getByTestId('save-button');

const clickSave = () =>
  act(async () => {
    fireEvent.click(getSaveButton());
  });

const getRadio = (value: string) =>
  within(screen.getByTestId(`app-mode-option-${value}`)).getByRole(
    'radio'
  ) as HTMLInputElement;

const getLandingPageTrigger = () =>
  within(screen.getByTestId('default-landing-page-select')).getByRole('button');

const getViewOption = (page: string, view: string) =>
  within(screen.getByTestId(`view-mode-row-${page}`)).getByRole('radio', {
    name: view,
  });

const openAddPageMenu = () =>
  fireEvent.click(screen.getByTestId('add-view-mode-page'));

describe('PersonaAppLayoutPage', () => {
  beforeEach(() => {
    seedDoc();
  });

  describe('App Mode', () => {
    it('renders No default, Classic and AI options', () => {
      renderPage();

      expect(getRadio('null')).toBeInTheDocument();
      expect(getRadio(AppMode.Classic)).toBeInTheDocument();
      expect(getRadio(AppMode.AI)).toBeInTheDocument();
    });

    it('selects the persisted appMode on mount', () => {
      seedDoc({ appMode: AppMode.AI });
      renderPage();

      expect(getRadio(AppMode.AI).checked).toBe(true);
    });

    it('selects No default when the persona has no appMode', () => {
      renderPage();

      expect(getRadio('null').checked).toBe(true);
      expect(getRadio(AppMode.Classic).checked).toBe(false);
    });

    it('never shows the unavailable placeholder (AI always available in OSS)', () => {
      renderPage();

      expect(
        screen.queryByTestId('app-mode-unavailable-placeholder')
      ).not.toBeInTheDocument();
    });
  });

  describe('Default Landing Page', () => {
    it('shows Home when the persona has no landing page', () => {
      renderPage();

      expect(getLandingPageTrigger()).toHaveTextContent('label.home-my-data');
      expect(getLandingPageTrigger()).toHaveTextContent('/my-data');
    });

    it('shows the persisted landing page', () => {
      seedDoc({ defaultLandingPage: '/glossary' });
      renderPage();

      expect(getLandingPageTrigger()).toHaveTextContent('label.glossary');
    });

    it('lists the options under their section headers', async () => {
      renderPage();

      fireEvent.click(getLandingPageTrigger());
      const govern = await screen.findByRole('group', { name: 'label.govern' });

      expect(
        within(govern).getByRole('option', { name: /label\.glossary/ })
      ).toBeInTheDocument();
      expect(
        within(govern).queryByRole('option', { name: /label\.explore/ })
      ).not.toBeInTheDocument();
    });
  });

  describe('View Mode', () => {
    it('shows each configured page with its saved view', () => {
      seedDoc({ defaultViewModes: { domains: PageViewMode.Tree } });
      renderPage();

      expect(getViewOption('domains', 'label.tree')).toBeChecked();
      expect(getViewOption('domains', 'label.table')).not.toBeChecked();
      expect(
        screen.queryByTestId('view-mode-row-dataProducts')
      ).not.toBeInTheDocument();
    });

    it('offers Tree only on Domains', () => {
      seedDoc({
        defaultViewModes: {
          domains: PageViewMode.Table,
          dataProducts: PageViewMode.Card,
        },
      });
      renderPage();

      expect(
        within(screen.getByTestId('view-mode-row-dataProducts')).queryByRole(
          'radio',
          { name: 'label.tree' }
        )
      ).not.toBeInTheDocument();
      expect(getViewOption('domains', 'label.tree')).toBeInTheDocument();
    });

    it('lists only pages that are not configured yet', async () => {
      seedDoc({ defaultViewModes: { domains: PageViewMode.Tree } });
      renderPage();

      openAddPageMenu();

      expect(
        await screen.findByRole('menuitem', {
          name: /label\.sub-domain-plural/,
        })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: /^label\.domain-plural/ })
      ).not.toBeInTheDocument();
    });

    it('saves added, changed and removed pages', async () => {
      seedDoc({
        defaultViewModes: {
          domains: PageViewMode.Table,
          dataProducts: PageViewMode.Card,
        },
      });
      const onSave = renderPage();

      openAddPageMenu();
      fireEvent.click(
        await screen.findByRole('menuitem', {
          name: /label\.learning-resources/,
        })
      );
      fireEvent.click(getViewOption('domains', 'label.tree'));
      fireEvent.click(screen.getByTestId('remove-view-mode-dataProducts'));
      await clickSave();

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultViewModes: {
            domains: PageViewMode.Tree,
            learningResources: PageViewMode.Table,
          },
        })
      );
    });

    it('saves no view modes once every page is removed', async () => {
      seedDoc({ defaultViewModes: { domains: PageViewMode.Card } });
      const onSave = renderPage();

      fireEvent.click(screen.getByTestId('remove-view-mode-domains'));
      await clickSave();

      expect(onSave.mock.calls[0][0].defaultViewModes).toBeUndefined();
    });
  });

  describe('Save and discard', () => {
    it('disables save and discard until something changes', () => {
      seedDoc({ appMode: AppMode.AI, defaultLandingPage: '/explore' });
      renderPage();

      expect(getSaveButton()).toBeDisabled();
      expect(screen.getByTestId('discard-button')).toBeDisabled();
      expect(screen.getByTestId('save-status')).toHaveTextContent(
        'message.all-changes-saved'
      );

      fireEvent.click(getRadio(AppMode.Classic));

      expect(getSaveButton()).toBeEnabled();
      expect(screen.getByTestId('save-status')).toHaveTextContent(
        'message.unsaved-changes'
      );
    });

    it('saves the selected app mode and keeps Home as unset', async () => {
      const onSave = renderPage();

      fireEvent.click(getRadio(AppMode.AI));
      await clickSave();

      expect(onSave).toHaveBeenCalledWith({
        appMode: AppMode.AI,
        defaultLandingPage: undefined,
      });
    });

    it('saves a chosen landing page', async () => {
      const onSave = renderPage();

      fireEvent.click(getLandingPageTrigger());
      fireEvent.click(
        await screen.findByRole('option', {
          name: /label\.data-product-plural/,
        })
      );
      await clickSave();

      expect(onSave).toHaveBeenCalledWith({
        appMode: undefined,
        defaultLandingPage: '/dataProduct',
      });
    });

    it('saves No default as an unset app mode', async () => {
      seedDoc({ appMode: AppMode.AI });
      const onSave = renderPage();

      fireEvent.click(getRadio('null'));
      await clickSave();

      expect(onSave).toHaveBeenCalledWith({
        appMode: undefined,
        defaultLandingPage: undefined,
      });
    });

    it('discard reverts every unsaved change to the saved values', () => {
      seedDoc({
        appMode: AppMode.AI,
        defaultLandingPage: '/glossary',
        defaultViewModes: { domains: PageViewMode.Tree },
      });
      renderPage();

      fireEvent.click(getRadio(AppMode.Classic));
      fireEvent.click(screen.getByTestId('remove-view-mode-domains'));
      fireEvent.click(screen.getByTestId('discard-button'));

      expect(getRadio(AppMode.AI).checked).toBe(true);
      expect(getLandingPageTrigger()).toHaveTextContent('label.glossary');
      expect(getViewOption('domains', 'label.tree')).toBeChecked();
      expect(getSaveButton()).toBeDisabled();
    });
  });
});
