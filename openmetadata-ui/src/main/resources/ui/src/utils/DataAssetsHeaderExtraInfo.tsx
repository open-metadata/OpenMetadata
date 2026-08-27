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

import Icon from '@ant-design/icons';
import { Divider, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import React from 'react';
import { ReactComponent as IconExternalLink } from '../assets/svg/external-links.svg';
import {
  DATA_ASSET_ICON_DIMENSION,
  NO_DATA_PLACEHOLDER,
} from '../constants/constants';

export const ExtraInfoLabel = ({
  label,
  value,
  dataTestId,
  inlineLayout = false,
}: {
  label: string;
  value: string | number | React.ReactNode;
  dataTestId?: string;
  inlineLayout?: boolean;
}) => {
  if (inlineLayout) {
    return (
      <>
        <Divider className="self-center" type="vertical" />
        <Typography.Text
          className="self-center text-xs whitespace-nowrap"
          data-testid={dataTestId}>
          {!isEmpty(label) && (
            <span className="text-grey-muted">{`${label}: `}</span>
          )}
          <span className="font-medium">{value}</span>
        </Typography.Text>
      </>
    );
  }

  return (
    <div className="d-flex align-start extra-info-container">
      <Typography.Text
        className="text-sm d-flex flex-col gap-2 w-full"
        data-testid={dataTestId}>
        {!isEmpty(label) && (
          <Typography.Text
            className="extra-info-label-heading"
            ellipsis={{ tooltip: true }}>
            {label}
          </Typography.Text>
        )}

        <Typography.Text
          className={classNames('font-medium extra-info-value')}
          ellipsis={{
            tooltip: true,
          }}>
          {value ?? NO_DATA_PLACEHOLDER}
        </Typography.Text>
      </Typography.Text>
    </div>
  );
};

export const ExtraInfoLink = ({
  label,
  value,
  href,
  newTab = false,
  ellipsis = false,
}: {
  label: string;
  value: string | number;
  href: string;
  newTab?: boolean;
  ellipsis?: boolean;
}) => (
  <div
    className={classNames('d-flex  text-sm  flex-col gap-2', {
      'w-48': ellipsis,
    })}>
    {!isEmpty(label) && (
      <Typography.Text
        className="extra-info-label-heading m-r-xss"
        ellipsis={ellipsis ? { tooltip: true } : false}>
        {label}
      </Typography.Text>
    )}
    <div className="d-flex items-center gap-1">
      <Tooltip title={value}>
        <Typography.Link
          ellipsis
          className="extra-info-link"
          href={href}
          rel={newTab ? 'noopener noreferrer' : undefined}
          target={newTab ? '_blank' : undefined}>
          {value}
        </Typography.Link>
      </Tooltip>
      <Icon
        className="m-l-xs"
        component={IconExternalLink}
        style={DATA_ASSET_ICON_DIMENSION}
      />
    </div>
  </div>
);
