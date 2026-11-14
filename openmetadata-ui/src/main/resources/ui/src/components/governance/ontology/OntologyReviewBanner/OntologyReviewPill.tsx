/*
 *  Copyright 2026 Collate.
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
  Box,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import { ClipboardCheck, XClose } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export type OntologyReviewPillTone = 'brand' | 'error' | 'success' | 'warning';

const TONE_CLASS: Record<OntologyReviewPillTone, string> = {
  brand: 'tw:border-utility-brand-300 tw:bg-utility-brand-50',
  error: 'tw:border-utility-error-300 tw:bg-utility-error-50',
  success: 'tw:border-utility-success-300 tw:bg-utility-success-50',
  warning: 'tw:border-utility-warning-300 tw:bg-utility-warning-50',
};

const ICON_CLASS: Record<OntologyReviewPillTone, string> = {
  brand: 'tw:text-utility-brand-600',
  error: 'tw:text-utility-error-600',
  success: 'tw:text-utility-success-600',
  warning: 'tw:text-utility-warning-600',
};

interface OntologyReviewPillProps {
  readonly tone: OntologyReviewPillTone;
  readonly title: ReactNode;
  readonly detail?: ReactNode;
  readonly action?: ReactNode;
  readonly children?: ReactNode;
  readonly testId?: string;
  /** Hides the notice for this session; a new review shows it again. */
  readonly onDismiss?: () => void;
}

/** A review notice as a compact pill over the Studio canvas. */
const OntologyReviewPill = ({
  tone,
  title,
  detail,
  action,
  children,
  testId,
  onDismiss,
}: OntologyReviewPillProps) => {
  const { t } = useTranslation();

  return (
    <div
      className={classNames(
        'tw:flex tw:max-w-full tw:items-center tw:gap-3 tw:rounded-full tw:border tw:py-2 tw:pr-2 tw:pl-4 tw:shadow-xs',
        TONE_CLASS[tone]
      )}
      data-testid={testId}
      role="status">
      <ClipboardCheck
        aria-hidden="true"
        className={classNames('tw:size-4 tw:shrink-0', ICON_CLASS[tone])}
      />
      <Box className="tw:min-w-0 tw:flex-1" direction="col">
        {/* A rejection carries the reviewer's full reason; the pill keeps one line and the
            ellipsis tooltip shows the rest. */}
        <Typography
          ellipsis={{ tooltip: true }}
          size="text-sm"
          weight="semibold">
          {title}
        </Typography>
        {detail ? (
          <Typography ellipsis color="secondary" size="text-xs">
            {detail}
          </Typography>
        ) : null}
        {children}
      </Box>
      {action}
      {onDismiss ? (
        <ButtonUtility
          data-testid="ontology-review-dismiss"
          icon={XClose}
          size="sm"
          tooltip={t('label.dismiss')}
          onClick={onDismiss}
        />
      ) : null}
    </div>
  );
};

export default OntologyReviewPill;
