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

import { Button, Space, Tooltip, Typography } from 'antd';
import { t } from 'i18next';
import { kebabCase } from 'lodash';
import React from 'react';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import SVGIcons, { Icons } from '../../utils/SvgUtils';

interface SummaryDetailsProps {
  title: string;
  children: React.ReactElement;
  hasAccess: boolean;
  showIcon?: boolean;
  showAddIcon?: boolean;
  setShow?: (value: React.SetStateAction<boolean>) => void;
  onSave?: () => void;
  onAddClick?: () => void;
}

const SummaryDetail = ({
  title,
  children,
  setShow,
  showIcon,
  showAddIcon = false,
  hasAccess,
  onSave,
  onAddClick,
  ...props
}: SummaryDetailsProps) => {
  return (
    <Space className="w-full" direction="vertical" {...props}>
      <Space
        className="w-full justify-between"
        data-testid={`section-${kebabCase(title)}`}>
        <div className="flex-center">
          <Typography.Text type="secondary">{title}</Typography.Text>
          {showAddIcon && (
            <Button
              className="cursor-pointer m--t-xss"
              data-testid="add-button"
              disabled={!hasAccess}
              icon={
                <SVGIcons
                  alt="icon-plus-primary"
                  icon="icon-plus-primary-outlined"
                  width="16px"
                />
              }
              size="small"
              type="text"
              onClick={onAddClick}
            />
          )}
        </div>
        {showIcon ? (
          <Tooltip
            title={hasAccess ? t('label.edit') : NO_PERMISSION_FOR_ACTION}>
            <Button
              className="cursor-pointer m--t-xss"
              data-testid="edit-button"
              disabled={!hasAccess}
              icon={
                <SVGIcons
                  alt="edit"
                  icon={Icons.IC_EDIT_PRIMARY}
                  width="16px"
                />
              }
              size="small"
              type="text"
              onClick={() => setShow && setShow(true)}
            />
          </Tooltip>
        ) : (
          <Button
            data-testid="save-btn"
            size="small"
            type="link"
            onClick={onSave}>
            {t('label.save')}
          </Button>
        )}
      </Space>
      {children}
    </Space>
  );
};

export default SummaryDetail;
