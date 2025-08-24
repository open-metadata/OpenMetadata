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
import dataCollaborationPng from '../assets/img/login-screen/data-collabration/data-collbration-optimized.png';
import discoveryPng from '../assets/img/login-screen/discovery/data-discovery-optimized.png';
import governancePng from '../assets/img/login-screen/governance/governce-optimized.png';
import observabilityPng from '../assets/img/login-screen/observability/data-observability-optimized.png';

class LoginClassBase {
  public getLoginCarouselContent() {
    const carouselContent = [
      {
        title: 'governance',
        image: governancePng,
        descriptionKey: 'assess-data-reliability-with-data-profiler-lineage',
      },
      {
        title: 'data-collaboration',
        image: dataCollaborationPng,
        descriptionKey: 'deeply-understand-table-relations-message',
      },
      {
        title: 'data-observability',
        image: observabilityPng,
        descriptionKey:
          'discover-your-data-and-unlock-the-value-of-data-assets',
      },
      {
        title: 'data-discovery',
        image: discoveryPng,
        descriptionKey: 'enables-end-to-end-metadata-management',
      },
    ];

    return carouselContent;
  }
}

const loginClassBase = new LoginClassBase();

export default loginClassBase;
export { LoginClassBase };
