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
import { Button, Space } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import SVGIcons from 'utils/SvgUtils';

interface VersionButtonProps {
  size?: 'small' | 'middle' | 'large' | undefined;
  selected: boolean;
  version: string;
  className?: string;
}

const VersionButton: React.FC<VersionButtonProps> = ({
  selected,
  size,
  version,
  className,
}) => {
  const { t } = useTranslation();
  const buttonClassNames = classNames(
    'tw-border tw-rounded',
    selected ? 'tw-text-white' : 'tw-text-primary',
    className
  );

  return (
    <Button
      className={buttonClassNames}
      data-testid="version-button"
      size={size}
      type={selected ? 'primary' : 'default'}>
      <Space>
        <span>
          <SVGIcons
            alt="version icon"
            height="12px"
            icon={selected ? 'icon-version-white' : 'icon-version'}
            width="12px"
          />
          <span className="tw-ml-1">{t('label.version-plural')}</span>
        </span>
        <span
          className={classNames(
            'tw-border-l tw-font-medium tw-cursor-pointer tw-pl-1',
            { 'tw-border-primary': !selected }
          )}
          data-testid="version-value">
          {parseFloat(version).toFixed(1)}
        </span>
      </Space>
    </Button>
  );
};

export default VersionButton;
