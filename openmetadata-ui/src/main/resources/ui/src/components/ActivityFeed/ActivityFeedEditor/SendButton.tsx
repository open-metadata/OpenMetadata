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

import { ButtonUtility } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconPaperPlanePrimary } from '../../../assets/svg/paper-plane-fill.svg';
import './send-button.less';

interface SendButtonProp {
  editorValue: string;
  className?: string;
  onSaveHandler: () => void;
}

export const SendButton: FC<SendButtonProp> = ({
  editorValue,
  className,
  onSaveHandler,
}) => {
  const { t } = useTranslation();

  return (
    <ButtonUtility
      aria-label={t('label.send')}
      className={classNames('send-button', className)}
      color="tertiary"
      data-testid="send-button"
      icon={IconPaperPlanePrimary}
      isDisabled={editorValue.length === 0}
      size="xs"
      onClick={onSaveHandler}
    />
  );
};
