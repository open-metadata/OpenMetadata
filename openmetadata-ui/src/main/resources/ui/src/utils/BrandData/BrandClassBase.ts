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
import UpgradeScreenDarkSrc from '../../assets/img/upgrade-screen-dark.svg';
import UpgradeScreenLightSrc from '../../assets/img/upgrade-screen-light.svg';
import WelcomeScreenDarkSrc from '../../assets/img/welcome-screen-dark.svg';
import WelcomeScreenLightSrc from '../../assets/img/welcome-screen-light.svg';
import MonogramSrc, {
  ReactComponent as Monogram,
} from '../../assets/svg/logo-monogram.svg';
import LogoSrc, { ReactComponent as Logo } from '../../assets/svg/logo.svg';
import { Theme } from '../../context/UntitledUIThemeProvider/theme-provider.interface';
import { t } from '../i18next/LocalUtil';

/**
 * Core palette shades (`--tw-color-<shade>`) for the welcome screen's glow and
 * primary button.
 */
export interface WelcomeTheme {
  glow: string;
  button: string;
  buttonHover: string;
}

class BrandClassBase {
  public getMonogram() {
    return { src: MonogramSrc, svg: Monogram };
  }

  public getLogo() {
    return { src: LogoSrc, svg: Logo };
  }

  /**
   * Brand logo for the expanded app-mode (AI) sidebar header. Defaults
   * to the standard wordmark; a downstream build (e.g. Collate) overrides this
   * to show its sidebar-specific full logo without affecting the NavBar/login
   * brand from `getLogo()`.
   */
  public getSidebarLogo() {
    return this.getLogo();
  }

  /**
   * Compact brand mark for the collapsed app-mode (AI) sidebar rail.
   * Defaults to the standard monogram; overridable per build independently of
   * `getMonogram()`.
   */
  public getSidebarMonogram() {
    return this.getMonogram();
  }

  public getReleaseLink(version: string) {
    const versionWithV = 'v' + version;

    return `https://open-metadata.org/product-updates#${versionWithV}`;
  }

  public getBlogLink(_version: string) {
    // Since medium doens't follow any fixed structure we will just return the blog link
    return 'https://blog.open-metadata.org/announcing-openmetadata-1-13-123d66609468';
  }

  public getWelcomeScreenImg(theme: Theme) {
    return theme === 'dark' ? WelcomeScreenDarkSrc : WelcomeScreenLightSrc;
  }

  public getUpgradeScreenImg(theme: Theme) {
    return theme === 'dark' ? UpgradeScreenDarkSrc : UpgradeScreenLightSrc;
  }

  /**
   * The welcome screen's fixed colours from its Figma mock. It shows the
   * product's own style and deliberately ignores a custom theme.
   */
  public getWelcomeTheme(): WelcomeTheme {
    return {
      glow: 'purple-500',
      button: 'purple-600',
      buttonHover: 'purple-700',
    };
  }

  /** Product name in the welcome screen's "Your {{platform}} is ready". */
  public getPlatformName() {
    return t('label.context-platform');
  }
}

const brandClassBase = new BrandClassBase();

export default brandClassBase;
export { BrandClassBase };
