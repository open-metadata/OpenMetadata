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

import { EntityField } from '../constants/Feeds.constants';
import type {
  ChangeDescription,
  Mlmodel,
} from '../generated/entity/data/mlmodel';
import { getMlFeatureVersionData } from './MlModelVersionUtils';

describe('getMlFeatureVersionData', () => {
  it('keeps rendering when the old feature diff is malformed', () => {
    const currentVersionData = {
      mlFeatures: [{ name: 'feature', tags: [] }],
    } as unknown as Mlmodel;
    const changeDescription: ChangeDescription = {
      fieldsUpdated: [
        {
          name: EntityField.ML_FEATURES,
          oldValue: '{invalid',
          newValue: JSON.stringify([{ name: 'feature', tags: [] }]),
        },
      ],
    };

    const result = getMlFeatureVersionData(
      currentVersionData,
      changeDescription
    );

    expect(result).toHaveLength(1);
  });

  it('ignores feature diffs with malformed nested tags', () => {
    const currentVersionData = {
      mlFeatures: [{ name: 'feature' }],
    } as unknown as Mlmodel;
    const changeDescription: ChangeDescription = {
      fieldsUpdated: [
        {
          name: EntityField.ML_FEATURES,
          oldValue: '[{"name":"feature","tags":[null]}]',
          newValue: '[{"name":"feature","tags":[null]}]',
        },
      ],
    };

    expect(
      getMlFeatureVersionData(currentVersionData, changeDescription)
    ).toEqual(currentVersionData.mlFeatures);
  });
});
