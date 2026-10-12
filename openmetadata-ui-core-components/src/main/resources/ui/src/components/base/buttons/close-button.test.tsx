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
