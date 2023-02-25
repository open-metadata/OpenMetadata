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

import { Popover } from 'antd';
import classNames from 'classnames';
import React, { FC, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Transi18next } from '../../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { Button } from '../../buttons/Button/Button';

interface SendButtonProp {
  editorValue: string;
  buttonClass: string;
  onSaveHandler: () => void;
}

const getIcon = (editorValue: string) => {
  return editorValue.length > 0 ? Icons.PAPER_PLANE_PRIMARY : Icons.PAPER_PLANE;
};

export const SendButton: FC<SendButtonProp> = ({
  editorValue,
  buttonClass,
  onSaveHandler,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className="tw-absolute tw-right-2 tw-bottom-2 tw-flex tw-flex-row tw-items-center tw-justify-end"
      onClick={(e) => e.stopPropagation()}>
      <Popover
        content={
          <Fragment>
            <strong>{t('label.send-now')}</strong>
            <p>
              {t('label.press')}
              <Transi18next
                i18nKey="message.tour-step-discover-all-assets-at-one-place"
                renderElement={
                  <kbd className="tw-bg-white tw-text-grey-body tw-rounded-sm tw-px-1 tw-py-0.5" />
                }
                values={{
                  text: t('label.return'),
                }}
              />
            </p>
          </Fragment>
        }
        placement="top"
        trigger="hover">
        <Button
          className={classNames(
            'tw-py-0.5 tw-px-1 tw-rounded tw-bg-none',
            buttonClass
          )}
          data-testid="send-button"
          disabled={editorValue.length === 0}
          size="custom"
          variant="text"
          onClick={onSaveHandler}>
          <SVGIcons
            alt="paper-plane"
            icon={getIcon(editorValue)}
            width="18px"
          />
        </Button>
      </Popover>
    </div>
  );
};
