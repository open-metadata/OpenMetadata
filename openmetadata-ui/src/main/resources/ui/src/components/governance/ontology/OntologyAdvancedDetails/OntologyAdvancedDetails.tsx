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
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy01,
} from '@openmetadata/ui-core-components/icons';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useClipboard } from '../../../../hooks/useClipBoard';

export interface OntologyAdvancedRow {
  readonly label: string;
  readonly value: string;
  readonly testId: string;
  readonly copyable?: boolean;
}

interface OntologyAdvancedDetailsProps {
  /** The lighter text after "Advanced", e.g. "ID and IRI". */
  readonly summary: string;
  readonly rows: readonly OntologyAdvancedRow[];
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  /** The section's test id; its toggle is `${testId}-toggle`. */
  readonly testId: string;
  readonly className?: string;
  /** A note under the rows, e.g. that they are generated and read-only. */
  readonly footnote?: ReactNode;
}

const AdvancedRow = ({
  copyable = false,
  label,
  testId,
  value,
}: OntologyAdvancedRow) => {
  const { t } = useTranslation();
  const { hasCopied, onCopyToClipBoard } = useClipboard(value);

  return (
    <div className="tw:flex tw:min-h-9 tw:items-center tw:gap-2.5 tw:py-1.5 tw:pr-1.5 tw:pl-3">
      <dt className="tw:w-16 tw:shrink-0 tw:text-xs tw:text-quaternary">
        {label}
      </dt>
      <dd
        className="tw:m-0 tw:min-w-0 tw:flex-1 tw:break-all tw:text-xs tw:text-primary tw:normal-nums"
        data-testid={testId}>
        {value}
      </dd>
      {copyable ? (
        <ButtonUtility
          color="tertiary"
          icon={hasCopied ? Check : Copy01}
          size="xs"
          tooltip={t(
            hasCopied
              ? 'message.copied-to-clipboard'
              : 'message.copy-to-clipboard'
          )}
          onClick={() => void onCopyToClipBoard(value)}
        />
      ) : null}
    </div>
  );
};

/** The design's collapsed "Advanced" disclosure: identifiers in a bordered list, each copyable. */
const OntologyAdvancedDetails = ({
  summary,
  rows,
  isOpen,
  onToggle,
  testId,
  className,
  footnote,
}: OntologyAdvancedDetailsProps) => {
  const { t } = useTranslation();
  const Chevron = isOpen ? ChevronDown : ChevronRight;

  return (
    <section className={className} data-testid={testId}>
      {/* A semibold "Advanced" and a lighter summary, no button chrome. */}
      <button
        aria-expanded={isOpen}
        className="tw:flex tw:cursor-pointer tw:items-center tw:gap-1.5 tw:rounded tw:border-0 tw:bg-transparent tw:p-0 tw:text-left tw:outline-focus-ring tw:focus-visible:outline-2"
        data-testid={`${testId}-toggle`}
        type="button"
        onClick={onToggle}>
        <Chevron aria-hidden className="tw:size-4 tw:text-fg-quaternary" />
        <Typography
          className="tw:text-secondary"
          size="text-sm"
          weight="semibold">
          {t('label.advanced')}
        </Typography>
        <Typography className="tw:text-quaternary" size="text-sm">
          {summary}
        </Typography>
      </button>
      {isOpen ? (
        <Box className="tw:gap-1.5 tw:pt-2.5" direction="col">
          <dl className="tw:m-0 tw:divide-y tw:divide-secondary tw:rounded-lg tw:border tw:border-secondary">
            {rows.map((row) => (
              <AdvancedRow key={row.testId} {...row} />
            ))}
          </dl>
          {footnote ? (
            <Typography
              className="tw:text-tertiary tw:normal-nums"
              size="text-xs">
              {footnote}
            </Typography>
          ) : null}
        </Box>
      ) : null}
    </section>
  );
};

export default OntologyAdvancedDetails;
