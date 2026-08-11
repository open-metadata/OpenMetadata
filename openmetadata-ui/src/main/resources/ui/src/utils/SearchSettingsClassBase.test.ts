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

import { SearchSettingsClassBase } from './SearchSettingsClassBase';

class HybridSearchSettingsClass extends SearchSettingsClassBase {
  public showHybridSearchWeights(): boolean {
    return true;
  }
}

class CollateSearchSettingsClass extends SearchSettingsClassBase {
  public isNLQSupported(): boolean {
    return true;
  }
}

describe('SearchSettingsClassBase', () => {
  it('does not support NLQ in OSS', () => {
    const searchSettings = new SearchSettingsClassBase();

    expect(searchSettings.isNLQSupported()).toBe(false);
  });

  it('does not infer NLQ support from hybrid-search weights', () => {
    const searchSettings = new HybridSearchSettingsClass();

    expect(searchSettings.isNLQSupported()).toBe(false);
  });

  it('supports NLQ through the dedicated Collate override', () => {
    const searchSettings = new CollateSearchSettingsClass();

    expect(searchSettings.isNLQSupported()).toBe(true);
  });
});
