/*
 *  Copyright 2022 Collate.
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

import { Badge } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { ArrayChange } from 'diff';
import { uniqueId } from 'lodash';
import { useTranslation } from 'react-i18next';
import { TagLabel } from '../../../../generated/type/tagLabel';

export const TagsDiffView = ({
  diffArr,
  className,
}: {
  diffArr: ArrayChange<TagLabel>[];
  className?: string;
}) => {
  const { t } = useTranslation();
  const elements = diffArr.map((diff) => {
    if (diff.added) {
      return (
        <div
          className="d-flex flex-wrap m-y-xs"
          data-testid="diff-added"
          key={uniqueId()}>
          {diff.value.map((tag) => (
            <Badge
              className="tw:mr-2"
              color="gray"
              key={uniqueId()}
              size="sm"
              style={{
                background: 'rgba(0, 131, 118, 0.2)',
                color: '#008376',
              }}
              type="color">
              {tag.tagFQN}
            </Badge>
          ))}
        </div>
      );
    }
    if (diff.removed) {
      return (
        <div
          className="d-flex flex-wrap m-y-xs"
          data-testid="diff-removed"
          key={uniqueId()}>
          {diff.value.map((tag) => (
            <Badge
              className="tw:mr-2"
              color="gray"
              key={uniqueId()}
              size="sm"
              style={{ color: 'grey', textDecoration: 'line-through' }}
              type="color">
              {tag.tagFQN}
            </Badge>
          ))}
        </div>
      );
    }

    return (
      <div
        className="d-flex flex-wrap m-y-xs"
        data-testid="diff-normal"
        key={uniqueId()}>
        {diff.value.length ? (
          diff.value.map((tag) => (
            <Badge
              className="tw:mr-2"
              color="gray"
              key={uniqueId()}
              size="sm"
              type="color">
              {tag.tagFQN}
            </Badge>
          ))
        ) : (
          <div
            className="text-grey-muted text-center"
            data-testid="noDiff-placeholder">
            {t('label.no-diff-available')}
          </div>
        )}
      </div>
    );
  });

  return (
    <div
      className={classNames('w-full', className)}
      data-testid="diff-container">
      {elements}
    </div>
  );
};
