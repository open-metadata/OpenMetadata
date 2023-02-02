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

import { Typography } from 'antd';
import classNames from 'classnames';
import React from 'react';
import AddPlaceHolder from '../../../assets/img/add-placeholder.svg';
import NoDataFoundPlaceHolder from '../../../assets/img/no-data-placeholder.svg';
import { SIZE } from '../../../enums/common.enum';

type Props = {
  children?: React.ReactNode;
  type?: string;
  buttonLabel?: string;
  buttonListener?: () => void;
  heading?: string;
  doc?: string;
  buttons?: React.ReactNode;
  buttonId?: string;
  description?: React.ReactNode;
  classes?: string;
  size?: string;
  dataTestId?: string;
};

const ErrorPlaceHolder = ({
  doc,
  type,
  children,
  heading,
  buttons,
  description,
  classes,
  size = SIZE.LARGE,
  dataTestId,
}: Props) => {
  const { Paragraph, Link } = Typography;

  return type === 'ADD_DATA' ? (
    <div data-testid={dataTestId}>
      <div className="flex-center flex-col tw-mt-24 " data-testid="error">
        {' '}
        <img data-testid="no-data-image" src={AddPlaceHolder} width={size} />
      </div>
      <div className="tw-flex tw-flex-col tw-items-center tw-mt-10 tw-text-base tw-font-medium">
        {description ? (
          description
        ) : (
          <>
            <Paragraph style={{ marginBottom: '4px' }}>
              {' '}
              Adding a new {heading} is easy, just give it a spin!
            </Paragraph>
            <Paragraph>
              {' '}
              Still need help? Refer to our{' '}
              <Link href={doc} target="_blank">
                docs
              </Link>{' '}
              for more information.
            </Paragraph>
          </>
        )}

        <div className="tw-text-lg tw-text-center">{buttons}</div>
      </div>
    </div>
  ) : (
    <div
      className={classNames(classes, 'flex-center flex-col w-full mt-24')}
      data-testid={dataTestId}>
      <div data-testid="error">
        <img
          data-testid="no-data-image"
          src={NoDataFoundPlaceHolder}
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
            No Data Available
          </Typography.Text>
          <Typography.Text className="tw-text-sm">
            Go ahead and add a new {heading}!
          </Typography.Text>
          {doc ? (
            <Typography.Text className="tw-text-sm">
              Still need help? Refer to our{' '}
              <Typography.Link href={doc} target="_blank">
                docs
              </Typography.Link>{' '}
              for more information.
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
