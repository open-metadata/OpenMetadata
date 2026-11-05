/*
 *  Copyright 2024 Collate.
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
import {
  Alert,
  AlertVariant,
  Box,
  Button,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { InlineAlertProps, InlineAlertType } from './InlineAlert.interface';

const ALERT_VARIANT: Record<InlineAlertType, AlertVariant> = {
  error: 'error',
  warning: 'warning',
  info: 'brand',
  success: 'success',
};

function InlineAlert({
  alertClassName = '',
  type,
  heading,
  description,
  subDescription,
  onClose,
}: Readonly<InlineAlertProps>) {
  const { t } = useTranslation();
  const { inlineAlertDetails, setInlineAlertDetails } = useApplicationStore();
  const [showMore, setShowMore] = useState(false);
  const mounted = useRef(false);
  // Latest alert this form showed; a later failed submit replaces the first one.
  const ownedAlert = useRef(inlineAlertDetails);
  ownedAlert.current = inlineAlertDetails ?? ownedAlert.current;
  // The antd Alert this replaces hid itself on close even when the caller kept rendering it.
  const [isClosed, setIsClosed] = useState(false);

  const handleToggleShowMore = useCallback(() => {
    setShowMore((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsClosed(true);
    onClose?.();
  }, [onClose]);

  const combinedText = `${description} ${subDescription}`.trim();

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      // Strict Mode replays effect cleanup before remounting. Defer the clear
      // so that replay keeps the error visible, and preserve a newer form's alert.
      queueMicrotask(() => {
        const alert = ownedAlert.current;
        if (
          !mounted.current &&
          !isUndefined(alert) &&
          useApplicationStore.getState().inlineAlertDetails === alert
        ) {
          setInlineAlertDetails(undefined);
        }
      });
    };
  }, [setInlineAlertDetails]);

  if (isClosed) {
    return null;
  }

  return (
    <Alert
      closable
      className={classNames('inline-error-container', alertClassName)}
      title={heading}
      variant={type ? ALERT_VARIANT[type] : 'gray'}
      onClose={handleClose}>
      <Box direction="col" gap={2}>
        <Typography
          as="p"
          className={classNames('tw:m-0 tw:text-sm', {
            'tw:line-clamp-2 tw:break-words': !showMore,
          })}
          data-testid="inline-alert-description">
          {description}
          {subDescription && (
            <>
              <br />
              {subDescription}
            </>
          )}
        </Typography>
        {combinedText.length >= 200 && (
          <Button
            className="tw:w-fit"
            color="link-color"
            data-testid={`read-${showMore ? 'less' : 'more'}-button`}
            size="sm"
            onPress={handleToggleShowMore}>
            {t(`label.show-${showMore ? 'less' : 'more'}-lowercase`)}
          </Button>
        )}
      </Box>
    </Alert>
  );
}

export default InlineAlert;
