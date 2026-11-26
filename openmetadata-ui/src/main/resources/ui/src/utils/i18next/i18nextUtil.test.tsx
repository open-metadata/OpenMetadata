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
import { DateFormatter } from '@internationalized/date';
import { initCoreI18n } from '@openmetadata/ui-core-components';
import { render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { I18nProvider, useLocale } from 'react-aria';
import { I18nextProvider, Trans } from 'react-i18next';
import esES from '../../locale/languages/es-es.json';
import {
  applyDocumentLanguage,
  getCurrentLocaleForConstrue,
  getInitOptions,
  getLanguageDirection,
  getReactAriaLocale,
} from './i18nextUtil';
import { SupportedLocales } from './LocalUtil.interface';

jest.unmock('react-i18next');

describe('i18next initialization', () => {
  it.each([
    [undefined, 'en'],
    ['en-US', 'en'],
    ['fr-FR', 'fr'],
    ['pt-BR', 'pt_BR'],
    ['zh-CN', 'zh_CN'],
  ])(
    'maps the resolved language %s to cron locale %s',
    (language, expected) => {
      const originalLanguage = i18next.resolvedLanguage;
      i18next.resolvedLanguage = language;

      try {
        expect(getCurrentLocaleForConstrue()).toBe(expected);
      } finally {
        i18next.resolvedLanguage = originalLanguage;
      }
    }
  );

  it('keeps interpolation and plural forms from the application catalog', async () => {
    const instance = i18next.createInstance();
    await instance.init({ ...getInitOptions(), lng: 'en-US' });
    const searchLabel: string = instance.t('label.search');

    expect(searchLabel).toBe('Search');
    expect(instance.t('label.brand-name')).toBe(
      process.env.BRAND_NAME ?? 'OpenMetadata'
    );
    expect(instance.t('label.count-asset', { count: 1 })).toBe('1 asset');
    expect(instance.t('label.count-asset', { count: 2 })).toBe('2 assets');
  });

  it('switches application and core namespaces together', async () => {
    const instance = i18next.createInstance();
    await instance.init({ ...getInitOptions(), lng: 'en-US' });
    instance.addResourceBundle('es-ES', 'translation', esES);
    initCoreI18n(instance);

    expect(instance.t('label.table')).toBe('Table');
    expect(instance.t('label.close', { ns: 'core' })).toBe('Close');

    await instance.changeLanguage('es-ES');

    expect(instance.t('label.table')).toBe(esES.label.table);
    expect(instance.t('label.close', { ns: 'core' })).toBe('Cerrar');
  });

  it('renders translated markup using the active instance', async () => {
    const instance = i18next.createInstance();
    await instance.init({ ...getInitOptions(), lng: 'en-US' });
    const { container } = render(
      <I18nextProvider i18n={instance}>
        <Trans
          components={[<strong key="count" />]}
          count={2}
          i18nKey="label.group-count"
        />
      </I18nextProvider>
    );

    expect(container).toHaveTextContent('2 groups');
    expect(screen.getByText('2').tagName).toBe('STRONG');
  });
});

describe('applyDocumentLanguage', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('dir');
    document.documentElement.removeAttribute('lang');
  });

  it.each([
    [SupportedLocales.العربية, 'ar-SA', 'rtl'],
    [SupportedLocales.Hebrew, 'he-HE', 'rtl'],
    [SupportedLocales.Persian, 'fa-IR', 'rtl'],
    [SupportedLocales.English, 'en-US', 'ltr'],
    [SupportedLocales.Français, 'fr-FR', 'ltr'],
  ])(
    'renders %s with lang %s and dir %s on the document root',
    (language, lang, dir) => {
      applyDocumentLanguage(language);

      expect(document.documentElement).toHaveAttribute('lang', lang);
      expect(document.documentElement).toHaveAttribute('dir', dir);
    }
  );

  it('switches the document back to ltr when leaving an RTL locale', () => {
    applyDocumentLanguage(SupportedLocales.العربية);
    applyDocumentLanguage(SupportedLocales.English);

    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });
});

describe('getLanguageDirection', () => {
  it.each([
    [SupportedLocales.Persian, 'rtl'],
    [SupportedLocales.العربية, 'rtl'],
    [SupportedLocales.English, 'ltr'],
  ])('resolves %s as %s', async (language, dir) => {
    const instance = i18next.createInstance();
    await instance.init({ ...getInitOptions(), lng: language });

    expect(getLanguageDirection(instance)).toBe(dir);
  });
});

describe('getReactAriaLocale', () => {
  const LocaleProbe = () => {
    const { locale, direction } = useLocale();
    const { calendar, numberingSystem } = new DateFormatter(
      locale
    ).resolvedOptions();

    return <span>{`${direction} ${calendar} ${numberingSystem}`}</span>;
  };

  const renderProbe = (language: string) =>
    render(
      <I18nProvider locale={getReactAriaLocale(language)}>
        <LocaleProbe />
      </I18nProvider>
    );

  it.each([
    [SupportedLocales.العربية, 'rtl'],
    [SupportedLocales.Hebrew, 'rtl'],
    [SupportedLocales.Thai, 'ltr'],
    [SupportedLocales.English, 'ltr'],
  ])(
    'gives React Aria %s as %s with the calendar and digits the app formats dates in',
    (language, direction) => {
      const { calendar, numberingSystem } = new Intl.DateTimeFormat(
        language
      ).resolvedOptions();

      renderProbe(language);

      expect(
        screen.getByText(`${direction} ${calendar} ${numberingSystem}`)
      ).toBeInTheDocument();
    }
  );

  it('gives React Aria Persian as rtl on the Gregorian calendar with Latin digits', () => {
    renderProbe(SupportedLocales.Persian);

    expect(screen.getByText('rtl gregory latn')).toBeInTheDocument();
  });
});
