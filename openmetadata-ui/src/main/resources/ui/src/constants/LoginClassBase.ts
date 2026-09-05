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
    return loginVideo;
  }

  // Gradient behind the login video panel. Returned from here (not inlined in
  // CarouselLayout) so Collate can override the login palette via
  // LoginClassCollate without forking the layout. Fixed brand illustration
  // colours — no semantic-token equivalent.
  public getLoginVideoPanelClassName(): string {
    return 'tw:bg-[linear-gradient(165deg,#f8f7fc_0%,#f3effc_55%,#ece5fb_100%)]';
  }

  // Gradient + shadow of the inset video card, shown until the video paints.
  public getLoginVideoCardClassName(): string {
    return (
      'tw:bg-[linear-gradient(180deg,#f2f1f5_0%,#e3d9f8_55%,#8a5cf0_100%)] ' +
      'tw:shadow-[0_32px_80px_-28px_rgba(86,54,205,0.38),0_6px_20px_-6px_rgba(38,24,90,0.12)]'
    );
  }
}

const loginClassBase = new LoginClassBase();

export default loginClassBase;
export { LoginClassBase };
