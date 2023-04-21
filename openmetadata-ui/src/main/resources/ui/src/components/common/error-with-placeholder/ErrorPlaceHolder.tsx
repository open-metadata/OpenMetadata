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
import classNames from 'classnames';
import { t } from 'i18next';
import React from 'react';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';

import { PlusOutlined } from '@ant-design/icons';
import { Transi18next } from 'utils/CommonUtils';
import { ReactComponent as AddPlaceHolderIcon } from '../../../assets/svg/add-placeholder.svg';
import { ReactComponent as NoDataFoundPlaceHolderIcon } from '../../../assets/svg/no-access-placeholder.svg';
import PermissionErrorPlaceholder from './PermissionErrorPlaceholder';

type Props = {
  children?: React.ReactNode;
  type?: ERROR_PLACEHOLDER_TYPE;
  buttonLabel?: string;
  buttonListener?: () => void;
  heading?: string;
  doc?: string;
  button?: React.ReactNode;
  description?: React.ReactNode;
  classes?: string;
  size?: string;
  dataTestId?: string;
  disabled?: boolean;
  onClick?: () => void;
  permission?: boolean;
};

const ErrorPlaceHolder = ({
  doc,
  disabled,
  onClick,
  type,
  children,
  heading,
  description,
  classes,
  size = SIZE.LARGE,
  dataTestId,
  button,
  permission,
}: Props) => {
  const { Paragraph } = Typography;

  return type === ERROR_PLACEHOLDER_TYPE.ADD ? (
    <div
      className={classNames(classes, 'h-full flex-center')}
      data-testid={dataTestId}>
      <Space align="center" className="w-full" direction="vertical" size={10}>
        {permission ? (
          <>
            <AddPlaceHolderIcon
              data-testid="no-data-image"
              height={size}
              width={size}
            />
            <div className="m-t-sm text-center text-sm font-normal">
              {description ? (
                description
              ) : (
                <>
                  <Paragraph style={{ marginBottom: '0' }}>
                    {t(
                      'message.adding-new-entity-is-easy-just-give-it-a-spin',
                      {
                        entity: heading,
                      }
                    )}
                  </Paragraph>
                  <Paragraph>
                    <Transi18next
                      i18nKey="message.refer-to-our-doc"
                      renderElement={
                        <a
                          href={doc}
                          rel="noreferrer"
                          style={{ color: '#1890ff' }}
                          target="_blank"
                        />
                      }
                      values={{
                        doc: t('label.doc-plural-lowercase'),
                      }}
                    />
                  </Paragraph>
                </>
              )}
              {button ? (
                button
              ) : (
                <Tooltip
                  placement="top"
                  title={disabled && t('message.admin-only-action')}>
                  <Button
                    ghost
                    className="p-x-lg"
                    data-testid="add-placeholder-button"
                    icon={<PlusOutlined />}
                    type="primary"
                    onClick={onClick}>
                    {t('label.add')}
                  </Button>
                </Tooltip>
              )}
            </div>
          </>
        ) : (
          <PermissionErrorPlaceholder size={size} />
        )}
      </Space>
    </div>
  ) : (
    <div
      className={classNames(classes, 'flex-center flex-col w-full mt-24')}
      data-testid={dataTestId}>
      <div data-testid="error">
        <NoDataFoundPlaceHolderIcon
          data-testid="no-data-image"
          height={size}
          width={size}
        />
      </div>
      {children ? (
        <div className="tw-flex tw-flex-col tw-items-center tw-mt-5 tw-text-base tw-font-medium">
          {children}
        </div>
      ) : (
        <div className="tw-flex tw-flex-col tw-items-center tw-mt-8 tw-text-base tw-font-medium">
          <Typography.Text className="tw-text-sm">
            {t('message.no-data-available')}
          </Typography.Text>
          <Typography.Text className="tw-text-sm">
            {t('message.adding-new-entity-is-easy-just-give-it-a-spin', {
              entity: heading,
            })}
          </Typography.Text>
          {doc ? (
            <Typography.Text className="tw-text-sm">
              {t('label.refer-to-our')}{' '}
              <Typography.Link href={doc} target="_blank">
                {t('label.doc-plural')}
              </Typography.Link>{' '}
              {t('label.for-more-info')}
            </Typography.Text>
          ) : (
            ''
          )}
        </div>
      )}
    </div>
  );
};

export default ErrorPlaceHolder;
