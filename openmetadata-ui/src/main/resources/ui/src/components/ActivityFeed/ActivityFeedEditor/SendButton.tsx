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

import { Button } from 'antd';
import classNames from 'classnames';
import React, { FC } from 'react';

import { ReactComponent as IconPaperPlanePrimary } from '../../../assets/svg/paper-plane-primary.svg';

interface SendButtonProp {
  editorValue: string;
  buttonClass: string;
  onSaveHandler: () => void;
}

export const SendButton: FC<SendButtonProp> = ({
  editorValue,
  buttonClass,
  onSaveHandler,
}) => (
  <div
    className="tw-absolute tw-right-2 tw-bottom-2 tw-flex tw-flex-row tw-items-center tw-justify-end"
    onClick={(e) => e.stopPropagation()}>
    <Button
      className={classNames('p-0', buttonClass)}
      data-testid="send-button"
      disabled={editorValue.length === 0}
      size="small"
      type="text"
      onClick={onSaveHandler}>
      <IconPaperPlanePrimary height={18} width={18} />
    </Button>
  </div>
);
