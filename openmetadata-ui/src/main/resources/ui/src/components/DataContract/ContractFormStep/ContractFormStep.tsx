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
  Button,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ChevronLeft,
  ChevronRight,
} from '@openmetadata/ui-core-components/icons';
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
      <Card className={className} color="secondary" variant="ghost">
        <Card.Header
          className="tw:items-center"
          extra={extra}
          hasDivider={false}
          subtitle={
            <Typography as="p" className="tw:text-tertiary" size="text-sm">
              {description}
            </Typography>
          }
          title={
            <Typography className="tw:block" size="text-lg" weight="semibold">
              {title}
            </Typography>
          }
        />
        <Card.Content>{children}</Card.Content>
      </Card>
      {(onPrev || showNext) && (
        <Box className="tw:mt-4" justify={onPrev ? 'between' : 'end'}>
          {onPrev && (
            <Button
              color="secondary"
              iconLeading={ChevronLeft}
              size="md"
              onPress={onPrev}>
              {prevLabel ?? t('label.previous')}
            </Button>
          )}
          {showNext && (
            <Button
              color="primary"
              iconTrailing={ChevronRight}
              size="md"
              onPress={onNext}>
              {nextLabel ?? t('label.next')}
            </Button>
          )}
        </Box>
      )}
    </>
  );
};
