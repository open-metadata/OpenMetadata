/*
 *  Copyright 2024 Collate.
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

import dataCollaborationImg from '../assets/img/login-screen/data-collaboration/data-collaboration.png';
import discoveryImg from '../assets/img/login-screen/discovery/data-discovery.png';
import governanceImg from '../assets/img/login-screen/governance/governance.png';
import observabilityImg from '../assets/img/login-screen/observability/data-observability.png';
import loginDarkVideo from '../assets/videos/omd-dark.mp4';
import loginVideo from '../assets/videos/omd.mp4';

class LoginClassBase {
  public getLoginCarouselContent() {
    const carouselContent = [
      {
        title: 'governance',
        image: governanceImg,
        descriptionKey: 'assess-data-reliability-with-data-profiler-lineage',
      },
      {
        title: 'data-collaboration',
        image: dataCollaborationImg,
        descriptionKey: 'deeply-understand-table-relations-message',
      },
      {
        title: 'data-observability',
        image: observabilityImg,
        descriptionKey:
          'discover-your-data-and-unlock-the-value-of-data-assets',
      },
      {
        title: 'data-discovery',
        image: discoveryImg,
        descriptionKey: 'enables-end-to-end-metadata-management',
      },
    ];

    return carouselContent;
  }

  public getLoginVideo(): string | undefined {
    // On /signin no ThemeProvider mounts; `dark-mode` comes from the
    // #theme-restore boot script in index.html. An OS scheme flip while the
    // sign-in page is open keeps the current video until reload.
    return document.documentElement.classList.contains('dark-mode')
      ? loginDarkVideo
      : loginVideo;
  }

  // Panel and card styles are returned from here (not inlined in
  // CarouselLayout) so Collate can override the login palette via
  // LoginClassCollate without forking the layout. Theme-aware tokens live in
  // styles/tokens.css (light) and styles/app.less (dark).
  public getLoginVideoPanelClassName(): string {
    return 'tw:bg-(image:--om-login-panel-bg)';
  }

  // The card background stands in for the video until it paints.
  public getLoginVideoCardClassName(): string {
    return 'tw:bg-(image:--om-login-card-bg) tw:shadow-(--om-login-card-shadow)';
  }
}

const loginClassBase = new LoginClassBase();

export default loginClassBase;
export { LoginClassBase };
