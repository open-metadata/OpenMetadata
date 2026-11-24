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
import type { ComponentProps } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import { CloseButton } from './close-button';
import { CORE_NS, initCoreI18n } from '@/locale';

type CloseButtonProps = ComponentProps<typeof CloseButton>;

/**
 * Renders <CloseButton> against a fresh, fully-initialized i18next instance
 * scoped to the `core` namespace under the requested language. Because the
 * component reads its translations through <I18nextProvider> (via
 * useCoreTranslation -> useTranslation('core')), exercising the real
 * resolution path — rather than a mock — proves the rendered aria-label is
 * genuinely the bundle value for that locale.
 */
async function renderInLocale(
  lng: string,
  props: Partial<CloseButtonProps> = {}
) {
  const instance = i18next.createInstance();

  await instance.use(initReactI18next).init({
    fallbackLng: 'en-US',
    lng,
    ns: [CORE_NS],
    defaultNS: CORE_NS,
    interpolation: { escapeValue: false },
  });

  initCoreI18n(instance);

  return render(
    <I18nextProvider i18n={instance}>
      <CloseButton {...props} />
    </I18nextProvider>
  );
}

describe('CloseButton', () => {
  it.each([
    ['en-US', 'Close'],
    ['es-ES', 'Cerrar'],
    ['fr-FR', 'Fermer'],
    ['de-DE', 'Schließen'],
    ['zh-CN', '关闭'],
  ])(
    'localizes the default aria-label under the %s locale to "%s"',
    async (lng, expected) => {
      await renderInLocale(lng);

      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        expected
      );
    }
  );

  it('uses the explicit `label` prop instead of the localized default', async () => {
    await renderInLocale('es-ES', { label: 'Cerrar aviso' });

    expect(
      screen.getByRole('button', { name: 'Cerrar aviso' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Cerrar aviso'
    );
  });
});

describe('CloseButton — keyboard focus ring', () => {
  // CloseButton is an icon-only control, so the keyboard focus outline is the
  // only signal that a keyboard user has focused it. `tw:focus:outline-hidden`
  // poisons `--tw-outline-style` to `none`, which collapses the
  // `tw:focus-visible:outline-2` ring to 0px width — see WCAG 2.4.7. The root
  // class list must NOT carry it.
  it('does not carry the tw:focus:outline-hidden class that suppresses the focus ring', async () => {
    await renderInLocale('en-US');
    const button = screen.getByRole('button');

    expect(button).not.toHaveClass('tw:focus:outline-hidden');
  });

  it('renders the focus-visible outline classes for an accessible keyboard focus indicator', async () => {
    await renderInLocale('en-US');
    const button = screen.getByRole('button');

    expect(button).toHaveClass('tw:focus-visible:outline-2');
    expect(button).toHaveClass('tw:focus-visible:outline-offset-2');
    expect(button).toHaveClass('tw:outline-focus-ring');
  });

  it.each(['light', 'dark'] as const)(
    'keeps the focus-visible ring under the %s theme',
    async (theme) => {
      await renderInLocale('en-US', { theme });
      const button = screen.getByRole('button');

      expect(button).toHaveClass('tw:focus-visible:outline-2');
      expect(button).toHaveClass('tw:focus-visible:outline-offset-2');
      expect(button).toHaveClass('tw:outline-focus-ring');
      expect(button).not.toHaveClass('tw:focus:outline-hidden');
    }
  );

  it.each(['xs', 'sm', 'md', 'lg'] as const)(
    'keeps the focus-visible ring at the %s size',
    async (size) => {
      await renderInLocale('en-US', { size });
      const button = screen.getByRole('button');

      expect(button).toHaveClass('tw:focus-visible:outline-2');
      expect(button).not.toHaveClass('tw:focus:outline-hidden');
    }
  );

  it('does not let a consumer className re-introduce the suppressing class', async () => {
    await renderInLocale('en-US', { className: 'tw:top-3 tw:right-3' });
    const button = screen.getByRole('button');

    // Consumer positioning classes are applied ...
    expect(button).toHaveClass('tw:top-3');
    expect(button).toHaveClass('tw:right-3');
    // ... but the focus ring stays intact and unsuppressed.
    expect(button).toHaveClass('tw:focus-visible:outline-2');
    expect(button).not.toHaveClass('tw:focus:outline-hidden');
  });
});
