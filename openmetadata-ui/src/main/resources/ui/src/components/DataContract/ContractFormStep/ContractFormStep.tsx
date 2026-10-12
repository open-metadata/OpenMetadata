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
import { Button, Typography } from '@openmetadata/ui-core-components';
import {
  ChevronLeft,
  ChevronRight,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface ContractFormStepProps {
  title: ReactNode;
  description: ReactNode;
  extra?: ReactNode;
  className?: string;
  children?: ReactNode;
  onPrev?: () => void;
  onNext?: () => void;
  prevLabel?: string;
  nextLabel?: string;
  isNextVisible?: boolean;
}

export const ContractFormStep = ({
  title,
  description,
  extra,
  className,
  children,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  isNextVisible = true,
}: ContractFormStepProps) => {
  const { t } = useTranslation();
  const showNext = Boolean(onNext) && isNextVisible;

  return (
    <>
      <section
        className={classNames(
          'tw:flex tw:flex-col tw:gap-5 tw:rounded-xl tw:bg-secondary tw:p-5',
          className
        )}>
        <div className="tw:flex tw:items-center tw:justify-between tw:gap-4">
          <div className="tw:flex tw:flex-col tw:gap-0.5">
            <Typography className="tw:block" size="text-lg" weight="semibold">
              {title}
            </Typography>
            <Typography as="p" className="tw:text-tertiary" size="text-sm">
              {description}
            </Typography>
          </div>
          {extra}
        </div>
        {children}
      </section>
      {(onPrev || showNext) && (
        <div
          className={classNames(
            'tw:mt-4 tw:flex',
            onPrev ? 'tw:justify-between' : 'tw:justify-end'
          )}>
          {onPrev && (
            <Button
              className="contract-prev-button tw:font-semibold"
              color="secondary"
              iconLeading={ChevronLeft}
              size="md"
              onPress={onPrev}>
              {prevLabel ?? t('label.previous')}
            </Button>
          )}
          {showNext && (
            <Button
              className="contract-next-button tw:font-semibold"
              color="primary"
              iconTrailing={ChevronRight}
              size="md"
              onPress={onNext}>
              {nextLabel ?? t('label.next')}
            </Button>
          )}
        </div>
      )}
    </>
  );
};
