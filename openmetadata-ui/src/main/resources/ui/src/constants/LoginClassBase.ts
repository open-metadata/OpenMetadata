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
import collaborationImg from '../assets/img/login-screen/collaboration/collaboration-main.png';
import collaborationMenu from '../assets/img/login-screen/collaboration/collaboration-menu.png';
import collaborationTabs from '../assets/img/login-screen/collaboration/collaboration-tabs.png';
import discoveryDataAssets from '../assets/img/login-screen/discovery/discovery-data-asset.png';
import discoveryLanguage from '../assets/img/login-screen/discovery/discovery-language.png';
import discoveryImg from '../assets/img/login-screen/discovery/discovery-main.png';
import governanceItems from '../assets/img/login-screen/governance/governance-items.png';
import governanceList from '../assets/img/login-screen/governance/governance-list.png';
import governanceImg from '../assets/img/login-screen/governance/governance-main.png';
import governanceReviewer from '../assets/img/login-screen/governance/governance-reviewer.png';
import dataObservabilityImg from '../assets/img/login-screen/observability/observability-main.png';
import observabilityTestcase from '../assets/img/login-screen/observability/observability-testcase.png';

class LoginClassBase {
  public getLoginCarouselContent() {
    const carouselContent = [
      {
        title: 'governance',
        image: governanceImg,
        descriptionKey: 'assess-data-reliability-with-data-profiler-lineage',
        imgClass: 'governance-image',
        image1: {
          image: governanceList,
          position: 'governance-top-left',
        },
        image2: {
          image: governanceItems,
          position: 'governance-middle-right',
        },
        image3: {
          image: governanceReviewer,
          position: 'governance-bottom-right',
        },
      },
      {
        title: 'data-collaboration',
        image: collaborationImg,
        descriptionKey: 'deeply-understand-table-relations-message',
        imgClass: 'collaboration-image',
        image1: {
          image: collaborationTabs,
          position: 'collab-top-left',
        },
        image2: {
          image: collaborationMenu,
          position: 'collab-middle-right',
        },
      },
      {
        title: 'data-observability',
        image: dataObservabilityImg,
        descriptionKey:
          'discover-your-data-and-unlock-the-value-of-data-assets',
        imgClass: 'observability-image',
        image1: {
          image: observabilityTestcase,
          position: 'observability-bottom-right',
        },
      },
      {
        title: 'data-discovery',
        image: discoveryImg,
        descriptionKey: 'enables-end-to-end-metadata-management',
        imgClass: 'discovery-image',
        image1: {
          image: discoveryLanguage,
          position: 'discovery-top-right',
        },
        image2: {
          image: discoveryDataAssets,
          position: 'discovery-middle-right',
        },
      },
    ];

    return carouselContent;
  }
}

const loginClassBase = new LoginClassBase();

export default loginClassBase;
export { LoginClassBase };
