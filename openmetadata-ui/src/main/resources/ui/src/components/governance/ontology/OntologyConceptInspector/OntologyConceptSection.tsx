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
  ButtonUtility,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowRight,
  Plus,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { ReactNode, Ref } from 'react';
import { useTranslation } from 'react-i18next';

interface ConceptSectionProps {
  readonly addLabel?: string;
  readonly addTestId?: string;
  readonly children: ReactNode;
  /** Left out for a section that is a single value, like the description. */
  readonly count?: number;
  readonly sectionRef?: Ref<HTMLElement>;
  readonly testId?: string;
  readonly title: string;
  readonly onAdd?: () => void;
}

export const ConceptSection = ({
  addLabel,
  addTestId,
  children,
  count,
  sectionRef,
  testId,
  title,
  onAdd,
}: ConceptSectionProps) => {
  const { t } = useTranslation();

  return (
    <section
      className="tw:flex tw:flex-col tw:gap-3 tw:py-5"
      data-testid={testId}
      ref={sectionRef}>
      <Box align="center" className="tw:min-h-7" gap={2}>
        <Typography
          aria-level={3}
          role="heading"
          size="text-sm"
          weight="semibold">
          {title}
        </Typography>
        {count === undefined ? null : (
          <Badge color="gray" size="sm" type="pill-color">
            {count}
          </Badge>
        )}
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

/**
 * An inline add form: a brand-bordered card with a soft focus halo, so it reads as the active
 * input. The plain tone is the design's grey card, used where the form has its own title and close.
 */
export const ConceptFormCard = ({
  children,
  testId,
  tone = 'brand',
}: {
  readonly children: ReactNode;
  readonly testId?: string;
  readonly tone?: 'brand' | 'plain';
}) => (
  <Card
    className={
      tone === 'brand'
        ? 'tw:border-brand tw:outline-4 tw:outline-utility-brand-100'
        : undefined
    }
    data-testid={testId}
    size="sm">
    <Card.Content className="tw:flex tw:flex-col tw:gap-4 tw:p-4">
      {children}
    </Card.Content>
  </Card>
);

export const ConceptFormHeading = ({
  hint,
  title,
  onClose,
}: {
  readonly hint?: string;
  readonly title: string;
  readonly onClose?: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <Box align="start" gap={2}>
      <Box className="tw:min-w-0 tw:flex-1" direction="col">
        <Typography size="text-sm" weight="semibold">
          {title}
        </Typography>
        {hint ? (
          <Typography color="secondary" size="text-sm">
            {hint}
          </Typography>
        ) : null}
      </Box>
      {onClose ? (
        <ButtonUtility
          color="tertiary"
          icon={XClose}
          size="xs"
          tooltip={t('label.close')}
          onClick={onClose}
        />
      ) : null}
    </Box>
  );
};

export const ConceptFormPreview = ({
  children,
}: {
  readonly children: ReactNode;
}) => (
  <Box
    align="center"
    className="tw:rounded-lg tw:border tw:border-utility-brand-200 tw:bg-brand-primary tw:px-3 tw:py-2.5 tw:text-fg-brand-primary"
    gap={2}>
    <ArrowRight aria-hidden className="tw:size-4 tw:shrink-0" />
    <Typography as="span" className="tw:min-w-0" color="brand" size="text-sm">
      {children}
    </Typography>
  </Box>
);
