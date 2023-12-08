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
import { Space } from 'antd';
import { isEmpty, isUndefined } from 'lodash';
import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import ProfilePicture from '../../../components/common/ProfilePicture/ProfilePicture';
import { getUserPath, NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { EntityChangeOperations } from '../../../enums/VersionPage.enum';
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
import { DomainExpertsProps } from './DomainExperts.interface';

function DomainExperts({
  isVersionsView,
  entity,
  editPermission,
}: DomainExpertsProps) {
  const getExpertName = useCallback(
    (expert: EntityReference, operation: EntityChangeOperations) => {
      switch (operation) {
        case EntityChangeOperations.ADDED: {
          return getAddedDiffElement(getEntityName(expert));
        }
        case EntityChangeOperations.DELETED: {
          return getRemovedDiffElement(getEntityName(expert));
        }
        case EntityChangeOperations.UPDATED:
        case EntityChangeOperations.NORMAL:
        default: {
          return getEntityName(expert);
        }
      }
    },
    []
  );

  const getExpert = useCallback(
    (expert: EntityReference, operation: EntityChangeOperations) => {
      return (
        <Space className="m-r-xss" key={expert.id} size={4}>
          <ProfilePicture
            displayName={getEntityName(expert)}
            name={expert.name ?? ''}
            textClass="text-xs"
            width="20"
          />
          <Link to={getUserPath(expert.name ?? '')}>
            {getExpertName(expert, operation)}
          </Link>
        </Space>
      );
    },
    []
  );

  if (isVersionsView) {
    const changeDescription = entity.changeDescription;
    const expertsDiff = getDiffByFieldName(
      EntityField.EXPERTS,
      changeDescription as ChangeDescription
    );

    const addedExperts: EntityReference[] = JSON.parse(
      getChangedEntityNewValue(expertsDiff) ?? '[]'
    );
    const deletedExperts: EntityReference[] = JSON.parse(
      getChangedEntityOldValue(expertsDiff) ?? '[]'
    );

    const unchangedExperts = entity.experts
      ? entity.experts.filter(
          (expert) =>
            !addedExperts.find(
              (addedReviewer: EntityReference) => addedReviewer.id === expert.id
            )
        )
      : [];

    if (
      !isEmpty(unchangedExperts) ||
      !isEmpty(addedExperts) ||
      !isEmpty(deletedExperts)
    ) {
      return (
        <>
          {unchangedExperts.map((expert) =>
            getExpert(expert, EntityChangeOperations.NORMAL)
          )}
          {addedExperts.map((expert) =>
            getExpert(expert, EntityChangeOperations.ADDED)
          )}
          {deletedExperts.map((expert) =>
            getExpert(expert, EntityChangeOperations.DELETED)
          )}
        </>
      );
    }
  }

  if (!isEmpty(entity.experts) && !isUndefined(entity.experts)) {
    return (
      <Space wrap data-testid="domain-expert-name-heading" size={8}>
        {entity.experts.map((expert) =>
          getExpert(expert, EntityChangeOperations.NORMAL)
        )}
      </Space>
    );
  }

  return editPermission ? null : <div>{NO_DATA_PLACEHOLDER}</div>;
}

export default DomainExperts;
