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
import { Box, Card, Typography } from '@openmetadata/ui-core-components';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as StarIcon } from '../../../../../assets/svg/ic-suggestions.svg';
import { WidgetEditButton } from '../../../../common/WidgetActionButton/WidgetActionButton';
import {
  ConfigurationParameterRow,
  TestCaseConfigurationCardProps,
} from './TestCaseConfigurationCard.types';
import {
  getCategoryTranslation,
  getConfigurationShapes,
  getDefinitionDisplayName,
  toSqlLines,
} from './TestCaseConfigurationCard.utils';

// No ligatures: Geist Mono draws `>=` as `≥`, so the query would read as something it is not.
const SQL_BLOCK_CLASS_NAME =
  'tw:max-h-80 tw:overflow-auto tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:py-2.5 tw:focus-visible:outline-focus-ring tw:[font-variant-ligatures:none]';

/**
 * The prototype's read-only, line-numbered SQL block. Deliberately not
 * `SchemaEditor` — CodeMirror is a full editor whose gutter and theme look
 * nothing like this, and loading it into a 320px rail costs a lazy chunk to
 * render three static lines.
 *
 * Capped in height: a custom SQL test can run past a hundred lines, which
 * would otherwise stretch the rail thousands of pixels down the page.
 */
function ConfigurationSql({ value }: Readonly<{ value: string }>) {
  const { t } = useTranslation();

  return (
    <Card
      aria-label={t('label.sql-query')}
      className={SQL_BLOCK_CLASS_NAME}
      data-testid="sql-expression-container"
      role="region"
      // Safari does not make a scroll container keyboard-focusable, so the rest
      // of a query past the cap would be out of keyboard reach.
      tabIndex={0}
      variant="ghost">
      {toSqlLines(value).map((line) => (
        <div
          className="tw:flex tw:font-mono tw:text-xs tw:leading-[1.8]"
          key={line.number}>
          <span
            aria-hidden
            className="tw:w-[30px] tw:shrink-0 tw:pr-2.5 tw:text-right tw:text-quaternary">
            {line.number}
          </span>
          <span className="tw:whitespace-pre-wrap">
            {line.tokens.map((token) => (
              <span
                className={
                  token.isKeyword
                    ? 'tw:font-semibold tw:text-utility-purple-600'
                    : 'tw:text-primary'
                }
                key={`${line.number}:${token.offset}`}>
                {token.text}
              </span>
            ))}
          </span>
        </div>
      ))}
    </Card>
  );
}

/**
 * A parameter value can be far longer than the rail is wide — a `tableDiff`
 * test's `table2` is a fully-qualified table name — so it wraps instead of
 * truncating. Wrapping keeps the whole value readable; an ellipsis would hide
 * the part that distinguishes one table from another.
 *
 * Deliberately not wrapped in `Tooltip`: its trigger is a `w-max` `<button>`,
 * which cannot shrink below max-content, so the row overflowed and the card's
 * `overflow-hidden` clipped it — and it made a non-interactive value focusable.
 */
function ConfigurationValue({ value }: Readonly<{ value: ReactNode }>) {
  return (
    <Typography
      className="tw:max-w-[65%] tw:shrink-0 tw:break-words tw:text-right tw:font-mono tw:text-primary"
      size="text-xs"
      weight="semibold">
      {value}
    </Typography>
  );
}

function ParameterRows({
  rows,
}: Readonly<{ rows: ConfigurationParameterRow[] }>) {
  return (
    <div
      className="tw:overflow-hidden tw:rounded-lg tw:border tw:border-secondary"
      data-testid="configuration-parameter-rows">
      {rows.map((row, index) => (
        <Box
          align="center"
          className={`tw:px-3 tw:py-2.5 ${
            index < rows.length - 1 ? 'tw:border-b tw:border-secondary' : ''
          }`}
          data-testid={`configuration-parameter-${row.label}`}
          gap={2}
          justify="between"
          key={row.label}>
          {/* The label gives way, so a narrow rail wraps it, not the value. */}
          <Typography
            as="span"
            className="tw:min-w-0 tw:text-xs tw:text-tertiary">
            {row.label}
          </Typography>
          <ConfigurationValue value={row.value} />
        </Box>
      ))}
    </div>
  );
}

// The prototype's supporting line is #3E7BC2, which is not on the palette
// (blue-600 #1570EF, blue-700 #175CD3). blue-600 reads too vivid against it;
// blue-700 at 80% lands within ~26 RGB units instead of ~62, and keeps the
// subtitle lighter than the title the way the prototype has it. Opacity rather
// than a raw hex so the token still flips for dark mode.
function DynamicAssertionCallout() {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:gap-2.5 tw:rounded-lg tw:border tw:border-utility-blue-200 tw:bg-utility-blue-50 tw:px-3 tw:py-2.5"
      data-testid="dynamic-assertion">
      {/* The sparkle matches the title colour; the asset draws in currentColor. */}
      <StarIcon
        aria-hidden
        className="tw:h-[18px] tw:w-[18px] tw:shrink-0 tw:text-utility-blue-700"
      />
      <div>
        <Typography
          as="span"
          className="tw:text-xs tw:font-semibold tw:text-utility-blue-700">
          {t('label.dynamic-assertion')}
        </Typography>
        <Typography
          as="span"
          className="tw:mt-px tw:block tw:text-xs tw:text-utility-blue-700/80">
          {t('message.bounds-learned-automatically')}
        </Typography>
      </div>
    </Box>
  );
}

const TestCaseConfigurationCard = ({
  testCaseData,
  testDefinition,
  parameterRows,
  withSqlParams,
  isVersionPage,
  versionParameterDiff,
  showEditButton,
  onEditParameter,
}: Readonly<TestCaseConfigurationCardProps>) => {
  const { t } = useTranslation();

  const category = getCategoryTranslation(testCaseData?.entityLink);
  const categoryLine = t(category.key, category.options);
  const definitionName = getDefinitionDisplayName(testDefinition);

  const {
    hasVersionDiff,
    hasParameterRows,
    hasSql,
    isDynamicAssertion,
    isEmpty,
  } = getConfigurationShapes({
    testCaseData,
    parameterRows,
    withSqlParams,
    isVersionPage,
    versionParameterDiff,
  });

  return (
    <div
      className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-surface tw:shadow-xs"
      data-testid="test-case-configuration-card">
      {/* The edit sits beside the title, not at the right as in the mock: the
          rail's other cards place their actions there. */}
      <Box
        align="center"
        className="tw:border-b tw:border-secondary tw:px-4 tw:py-3"
        gap={2}>
        <Typography
          as="span"
          className="tw:text-sm tw:font-bold tw:text-primary">
          {t('label.configuration')}
        </Typography>
        {showEditButton && (
          <WidgetEditButton
            data-testid="edit-parameter-icon"
            title={t('label.edit-entity', { entity: t('label.parameter') })}
            onClick={onEditParameter}
          />
        )}
      </Box>

      <div className="tw:px-4 tw:py-3.5">
        {/* Spacing sits on a plain wrapper: `Typography` renders inside a
            `.prose` container whose rules override utility margins set on the
            element itself, so `tw:mb-*` here computed to 0 and the mock's
            3px/12px rhythm collapsed. */}
        <div className="tw:mb-3 tw:flex tw:flex-col tw:gap-0.5">
          {definitionName && (
            <Typography
              as="p"
              className="tw:text-sm tw:font-semibold tw:text-secondary"
              data-testid="configuration-test-name">
              {definitionName}
            </Typography>
          )}
          <Typography
            as="p"
            className="tw:text-xs tw:text-tertiary"
            data-testid="configuration-category">
            {categoryLine}
          </Typography>
        </div>

        <div className="tw:flex tw:flex-col tw:gap-2.5">
          {hasParameterRows && <ParameterRows rows={parameterRows} />}
          {isDynamicAssertion && <DynamicAssertionCallout />}
          {hasVersionDiff && (
            <div data-testid="configuration-version-diff">
              {versionParameterDiff}
            </div>
          )}
          {hasSql &&
            withSqlParams.map((param) => (
              <ConfigurationSql key={param.name} value={param.value ?? ''} />
            ))}
          {isEmpty && (
            <Typography
              as="p"
              className="tw:text-xs tw:text-tertiary"
              data-testid="configuration-empty-state">
              {t('message.no-configurable-parameters')}
            </Typography>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestCaseConfigurationCard;
