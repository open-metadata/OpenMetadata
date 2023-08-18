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
  className?: string;
  onSaveHandler: () => void;
}

export const SendButton: FC<SendButtonProp> = ({
  editorValue,
  className,
  onSaveHandler,
}) => (
  <Button
    className={classNames('absolute', className)}
    data-testid="send-button"
    disabled={editorValue.length === 0}
    icon={<IconPaperPlanePrimary height={18} width={18} />}
    size="small"
    style={{ bottom: '2px', right: '5px' }}
    type="text"
    onClick={onSaveHandler}
  />
);
