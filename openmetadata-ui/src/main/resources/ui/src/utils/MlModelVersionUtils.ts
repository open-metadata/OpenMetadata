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

import { cloneDeep, isEqual } from 'lodash';
import { EntityField } from '../constants/Feeds.constants';
import {
  ChangeDescription,
  MlFeature,
  Mlmodel,
} from '../generated/entity/data/mlmodel';
import { VersionData } from '../pages/EntityVersionPage/EntityVersionPage.component';
import {
  getAllChangedEntityNames,
  getAllDiffByFieldName,
  getChangedEntityNewValue,
  getChangedEntityOldValue,
  getDiffByFieldName,
  getTagsDiff,
  getTextDiff,
  removeDuplicateTags,
} from './EntityVersionUtils';
import { TagLabelWithStatus } from './EntityVersionUtils.interface';

const handleFeatureDescriptionChangeDiff = (
  colList: Mlmodel['mlFeatures'],
  oldDiffs: MlFeature[],
  newDiffs: MlFeature[]
) => {
  colList?.forEach((i) => {
    newDiffs.forEach((newDiff, index) => {
      if (isEqual(i.name, newDiff.name)) {
        i.description = getTextDiff(
          oldDiffs[index]?.description ?? '',
          newDiff.description ?? ''
        );
      }
    });
  });
};

const handleFeatureTagChangeDiff = (
  colList: Mlmodel['mlFeatures'],
  oldDiffs: MlFeature[],
  newDiffs: MlFeature[]
) => {
  colList?.forEach((i) => {
    newDiffs.forEach((newDiff, index) => {
      if (isEqual(i.name, newDiff.name)) {
        const flag: { [x: string]: boolean } = {};
        const uniqueTags: Array<TagLabelWithStatus> = [];
        const oldTag = removeDuplicateTags(
          oldDiffs[index].tags ?? [],
          newDiff.tags ?? []
        );
        const newTag = removeDuplicateTags(
          newDiff.tags ?? [],
          oldDiffs[index].tags ?? []
        );
        const tagsDiff = getTagsDiff(oldTag, newTag);

        [...tagsDiff, ...((i.tags ?? []) as Array<TagLabelWithStatus>)].forEach(
          (elem: TagLabelWithStatus) => {
            if (!flag[elem.tagFQN]) {
              flag[elem.tagFQN] = true;
              uniqueTags.push(elem);
            }
          }
        );
        i.tags = uniqueTags;
      }
    });
  });
};

export const getMlFeatureVersionData = (
  currentVersionData: VersionData,
  changeDescription: ChangeDescription
): Mlmodel['mlFeatures'] => {
  const featureList = cloneDeep(
    (currentVersionData as Mlmodel).mlFeatures ?? []
  );
  const featuresDiff = getAllDiffByFieldName(
    EntityField.ML_FEATURES,
    changeDescription
  );
  const changedEntities = getAllChangedEntityNames(featuresDiff);

  changedEntities.forEach((changedField) => {
    if (changedField === EntityField.ML_FEATURES) {
      const featureDiff = getDiffByFieldName(changedField, changeDescription);
      const oldDiff = JSON.parse(getChangedEntityOldValue(featureDiff) ?? '[]');
      const newDiff = JSON.parse(getChangedEntityNewValue(featureDiff) ?? '[]');

      handleFeatureDescriptionChangeDiff(featureList, oldDiff, newDiff);

      handleFeatureTagChangeDiff(featureList, oldDiff, newDiff);
    }
  });

  return featureList;
};
