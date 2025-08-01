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
import WelcomeScreenSrc from '../../assets/img/welcome-screen.png';
import MonogramSrc, {
  ReactComponent as Monogram,
} from '../../assets/svg/logo-monogram.svg';
import LogoSrc, { ReactComponent as Logo } from '../../assets/svg/logo.svg';
import { t } from '../i18next/LocalUtil';

class BrandClassBase {
  public getMonogram() {
    return { src: MonogramSrc, svg: Monogram };
  }

  public getLogo() {
    return { src: LogoSrc, svg: Logo };
  }

  public getPageTitle() {
    return t('label.open-metadata');
  }

  public getReleaseLink(version: string) {
    const versionWithV = 'v' + version;

    return `https://open-metadata.org/product-updates#${versionWithV}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getBlogLink(_version: string) {
    // Since medium doens't follow any fixed structure we will just return the blog link
    return 'https://blog.open-metadata.org/announcing-openmetadata-1-8-948eb14d41c7';
  }

  public getWelcomeScreenImg() {
    return WelcomeScreenSrc;
  }
}

const brandClassBase = new BrandClassBase();

export default brandClassBase;
export { BrandClassBase };
