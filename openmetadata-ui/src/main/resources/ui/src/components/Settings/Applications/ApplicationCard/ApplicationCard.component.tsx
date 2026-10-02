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

import { ExclamationCircleFilled } from '@ant-design/icons';
import {
  Button,
  Card,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { kebabCase } from 'lodash';
import { useTranslation } from 'react-i18next';
import RichTextEditorPreviewerNew from '../../../common/RichTextEditor/RichTextEditorPreviewNew';
import AppLogo from '../AppLogo/AppLogo.component';
import { ApplicationCardProps } from './ApplicationCard.interface';

const ApplicationCard = ({
  title,
  description,
  className,
  linkTitle,
  onClick,
  appName,
  deleted = false,
  disabled = false,
  disabledReason,
  showDescription = true,
}: ApplicationCardProps) => {
  const { t } = useTranslation();
  const isUnavailable = deleted || disabled;

  // Light keeps the legacy look: a 65% card fade and the antd heading/border
  // colours. In dark that fade sinks the text below contrast, so dark dims only
  // the logo and mutes the text with tokens instead.
  const card = (
    <Card
      aria-disabled={isUnavailable || undefined}
      className={classNames(
        className,
        'tw:flex tw:h-full tw:items-center tw:border-utility-gray-blue-100 tw:text-sm tw:leading-[1.5715] tw:text-primary tw:dark:border-subtle',
        isUnavailable
          ? 'tw:opacity-65 tw:dark:opacity-100'
          : 'tw:cursor-pointer tw:transition-shadow tw:hover:shadow-xl'
      )}
      data-testid={`${kebabCase(appName)}-card`}
      onClick={isUnavailable ? undefined : onClick}>
      <div className="tw:flex tw:items-center tw:gap-3 tw:p-5">
        <div
          className={classNames({
            'tw:grayscale tw:dark:opacity-65': isUnavailable,
          })}>
          <AppLogo appName={appName} />
        </div>
        <div className="tw:flex tw:flex-col tw:items-baseline">
          <div className="tw:flex tw:gap-2">
            <Typography
              as="h5"
              className={classNames('tw:m-0 tw:wrap-anywhere', {
                'tw:dark:text-tertiary': isUnavailable,
              })}
              size="text-md"
              weight="semibold">
              {title}
            </Typography>
            {isUnavailable && (
              <div
                className="deleted-badge-button text-xss flex-center tw:items-center"
                data-testid="deleted-badge">
                <ExclamationCircleFilled className="d-flex m-r-xss font-medium text-xs" />
                {t('label.disabled')}
              </div>
            )}
          </div>
          {showDescription && (
            <RichTextEditorPreviewerNew
              enableSeeMoreVariant={false}
              markdown={description}
            />
          )}
          <Button
            className={classNames(
              'tw:h-10 tw:rounded-lg tw:border tw:border-transparent tw:leading-[1.5715] tw:font-normal tw:text-link tw:hover:text-link tw:hover:*:data-text:decoration-transparent',
              { 'tw:dark:text-tertiary': isUnavailable }
            )}
            color="link-color"
            data-testid="config-btn"
            // react-aria's press handling stops the click reaching the card.
            onPress={isUnavailable ? undefined : onClick}>
            {linkTitle}
          </Button>
        </div>
      </div>
    </Card>
  );

  if (disabledReason) {
    return (
      // Out of the tab order: an AriaButton trigger would nest the card's
      // Configure button inside another button.
      <Tooltip
        excludeTriggerFromTabOrder
        placement="top"
        title={disabledReason}
        triggerClassName="tw:block tw:h-full">
        {card}
      </Tooltip>
    );
  }

  return card;
};

export default ApplicationCard;
