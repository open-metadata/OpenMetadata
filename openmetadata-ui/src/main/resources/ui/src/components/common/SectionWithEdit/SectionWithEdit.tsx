/*
 *  Copyright 2025 Collate.
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
import { Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React from 'react';
import { twMerge } from 'tailwind-merge';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { t } from '../../../utils/i18next/LocalUtil';
import { EditIconButton } from '../IconButtons/EditIconButton';
import { SectionWithEditProps } from './SectionWithEdit.interface';

const SectionWithEdit: React.FC<SectionWithEditProps> = ({
  title,
  titleExtra,
  children,
  onEdit,
  showEditButton = true,
  className,
  titleClassName,
  contentClassName,
}) => {
  const titleNode =
    typeof title === 'string' ? (
      <Typography
        className="tw:m-0 tw:text-[13px] tw:leading-5 tw:font-semibold tw:text-utility-gray-900"
        data-testid="section-title">
        {title}
      </Typography>
    ) : (
      title
    );

  return (
    <div
      className={classNames(
        'tw:border-b-[0.6px] tw:border-utility-gray-blue-100 tw:px-3.5 tw:pb-4 tw:dark:border-subtle',
        className
      )}
      data-testid="section-with-edit">
      <div
        className={twMerge(
          'tw:mb-3 tw:flex tw:justify-between',
          titleClassName
        )}
        data-testid="section-header">
        {titleExtra ? (
          <div className="tw:flex tw:items-center tw:gap-2">
            {titleNode}
            {titleExtra}
          </div>
        ) : (
          titleNode
        )}
        {showEditButton && onEdit && (
          <EditIconButton
            newLook
            data-testid="edit-button"
            disabled={false}
            icon={<EditIcon color={DE_ACTIVE_COLOR} width="12px" />}
            size="small"
            title={t('label.edit-entity', {
              entity: title,
            })}
            onClick={onEdit}
          />
        )}
      </div>
      <div
        className={classNames(
          'tw:leading-normal tw:text-(color:--om-legacy-color-595959)',
          contentClassName
        )}
        data-testid="section-content">
        {children}
      </div>
    </div>
  );
};

export default SectionWithEdit;
