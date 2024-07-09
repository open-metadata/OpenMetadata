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

import { isEmpty, isUndefined } from 'lodash';
import React, { useCallback } from 'react';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { EntityChangeOperations } from '../../../enums/VersionPage.enum';
import { Glossary } from '../../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import {
  ChangeDescription,
  EntityReference,
} from '../../../generated/entity/type';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  getAddedDiffElement,
  getChangedEntityNewValue,
  getChangedEntityOldValue,
  getDiffByFieldName,
  getRemovedDiffElement,
} from '../../../utils/EntityVersionUtils';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';

interface GlossaryReviewersProps {
  glossaryData: Glossary | GlossaryTerm;
  isVersionView?: boolean;
  editPermission?: boolean;
}

function GlossaryReviewers({
  isVersionView,
  glossaryData,
  editPermission,
}: GlossaryReviewersProps) {
  const getReviewerName = useCallback(
    (reviewer: EntityReference, operation: EntityChangeOperations) => {
      switch (operation) {
        case EntityChangeOperations.ADDED: {
          return getAddedDiffElement(getEntityName(reviewer));
        }
        case EntityChangeOperations.DELETED: {
          return getRemovedDiffElement(getEntityName(reviewer));
        }
        case EntityChangeOperations.UPDATED:
        case EntityChangeOperations.NORMAL:
        default: {
          return getEntityName(reviewer);
        }
      }
    },
    []
  );

  const getReviewer = useCallback(
    (reviewer: EntityReference, operation: EntityChangeOperations) => {
      return (
        <OwnerLabel
          pills
          owner={reviewer}
          ownerDisplayName={getReviewerName(reviewer, operation)}
        />
      );
    },
    []
  );

  if (isVersionView) {
    const changeDescription = glossaryData.changeDescription;
    const reviewersDiff = getDiffByFieldName(
      EntityField.REVIEWERS,
      changeDescription as ChangeDescription
    );

    const addedReviewers: EntityReference[] = JSON.parse(
      getChangedEntityNewValue(reviewersDiff) ?? '[]'
    );
    const deletedReviewers: EntityReference[] = JSON.parse(
      getChangedEntityOldValue(reviewersDiff) ?? '[]'
    );

    const unchangedReviewers = glossaryData.reviewers
      ? glossaryData.reviewers.filter(
          (reviewer) =>
            !addedReviewers.find(
              (addedReviewer: EntityReference) =>
                addedReviewer.id === reviewer.id
            )
        )
      : [];

    if (
      !isEmpty(unchangedReviewers) ||
      !isEmpty(addedReviewers) ||
      !isEmpty(deletedReviewers)
    ) {
      return (
        <div className="d-flex items-center gap-1 flex-wrap">
          {unchangedReviewers.map((reviewer) =>
            getReviewer(reviewer, EntityChangeOperations.NORMAL)
          )}
          {addedReviewers.map((reviewer) =>
            getReviewer(reviewer, EntityChangeOperations.ADDED)
          )}
          {deletedReviewers.map((reviewer) =>
            getReviewer(reviewer, EntityChangeOperations.DELETED)
          )}
        </div>
      );
    }
  }

  if (
    !isEmpty(glossaryData.reviewers) &&
    !isUndefined(glossaryData.reviewers)
  ) {
    return (
      <div
        className="d-flex items-center gap-1 flex-wrap"
        data-testid="glossary-reviewer-name">
        {glossaryData.reviewers.map((reviewer) =>
          getReviewer(reviewer, EntityChangeOperations.NORMAL)
        )}
      </div>
    );
  }

  return editPermission ? null : <div>{NO_DATA_PLACEHOLDER}</div>;
}

export default GlossaryReviewers;
