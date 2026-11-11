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
  Badge,
  Box,
  Button,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowRight, Plus } from '@openmetadata/ui-core-components/icons';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ConceptSectionProps {
  readonly addLabel?: string;
  readonly addTestId?: string;
  readonly children: ReactNode;
  readonly count: number;
  readonly testId?: string;
  readonly title: string;
  readonly onAdd?: () => void;
}

export const ConceptSection = ({
  addLabel,
  addTestId,
  children,
  count,
  testId,
  title,
  onAdd,
}: ConceptSectionProps) => {
  const { t } = useTranslation();

  return (
    <section
      className="tw:flex tw:flex-col tw:gap-3 tw:py-5"
      data-testid={testId}>
      <Box align="center" className="tw:min-h-7" gap={2}>
        <Typography
          aria-level={3}
          role="heading"
          size="text-sm"
          weight="semibold">
          {title}
        </Typography>
        <Badge color="gray" size="sm" type="pill-color">
          {count}
        </Badge>
        {onAdd ? (
          <Button
            className="tw:ml-auto"
            color="link-color"
            data-testid={addTestId}
            iconLeading={Plus}
            size="sm"
            onPress={onAdd}>
            {addLabel ?? t('label.add')}
          </Button>
        ) : null}
      </Box>
      {children}
    </section>
  );
};

export const ConceptEmptyState = ({
  hint,
  title,
}: {
  readonly hint?: string;
  readonly title: string;
}) => (
  <Box className="tw:rounded-lg tw:bg-secondary_alt tw:p-4" direction="col">
    <Typography as="p" className="tw:m-0" size="text-sm">
      {title}
    </Typography>
    {hint ? (
      <Typography as="p" className="tw:m-0 tw:text-tertiary" size="text-xs">
        {hint}
      </Typography>
    ) : null}
  </Box>
);

export const ConceptFormCard = ({
  children,
  testId,
}: {
  readonly children: ReactNode;
  readonly testId?: string;
}) => (
  <Card data-testid={testId} size="sm">
    <Card.Content className="tw:flex tw:flex-col tw:gap-3">
      {children}
    </Card.Content>
  </Card>
);

export const ConceptFormPreview = ({
  children,
}: {
  readonly children: ReactNode;
}) => (
  <Box
    align="center"
    className="tw:rounded-lg tw:bg-secondary_alt tw:px-3 tw:py-2.5 tw:text-tertiary"
    gap={2}>
    <ArrowRight aria-hidden className="tw:size-4 tw:shrink-0" />
    <Typography
      as="span"
      className="tw:min-w-0"
      color="secondary"
      size="text-sm">
      {children}
    </Typography>
  </Box>
);
