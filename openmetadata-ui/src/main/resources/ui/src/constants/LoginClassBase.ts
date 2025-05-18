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
import collaborationImg from '../assets/img/login-screen/data-collaboration.png';
import discoveryImg from '../assets/img/login-screen/data-discovery.png';
import governanceImg from '../assets/img/login-screen/data-governance.png';
import dataObservabilityImg from '../assets/img/login-screen/data-observability.png';

class LoginClassBase {
  public getLoginCarouselContent() {
    const carouselContent = [
      {
        title: 'governance',
        image: governanceImg,
        descriptionKey: 'assess-data-reliability-with-data-profiler-lineage',
        width: '550px',
      },
      {
        title: 'data-collaboration',
        image: collaborationImg,
        descriptionKey: 'deeply-understand-table-relations-message',
        width: '400px',
      },
      {
        title: 'data-observability',
        image: dataObservabilityImg,
        descriptionKey:
          'discover-your-data-and-unlock-the-value-of-data-assets',
        width: '350px',
      },
      {
        title: 'data-discovery',
        image: discoveryImg,
        descriptionKey: 'enables-end-to-end-metadata-management',
        width: '500px',
      },
    ];

    return carouselContent;
  }
}

const loginClassBase = new LoginClassBase();

export default loginClassBase;
export { LoginClassBase };
