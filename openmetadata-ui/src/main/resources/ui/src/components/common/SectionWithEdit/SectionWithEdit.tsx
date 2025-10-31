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
import { Typography } from 'antd';
import React from 'react';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { t } from '../../../utils/i18next/LocalUtil';
import { EditIconButton } from '../IconButtons/EditIconButton';
import { SectionWithEditProps } from './SectionWithEdit.interface';
import './SectionWithEdit.less';

const SectionWithEdit: React.FC<SectionWithEditProps> = ({
  title,
  children,
  onEdit,
  showEditButton = true,
  className = '',
  titleClassName = '',
  contentClassName = '',
}) => {
  return (
    <div className={`section-with-edit ${className}`}>
      <div className={`section-header ${titleClassName}`}>
        {typeof title === 'string' ? (
          <Typography.Text className="section-title">{title}</Typography.Text>
        ) : (
          title
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
      <div className={`section-content ${contentClassName}`}>{children}</div>
    </div>
  );
};

export default SectionWithEdit;
