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
import { Box, Tooltip, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { ReactComponent as StarIcon } from '../../../../../assets/svg/ic-suggestions.svg';
import { EditIconButton } from '../../../../common/IconButtons/EditIconButton';
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

/**
 * The prototype's read-only, line-numbered SQL block. Deliberately not
 * `SchemaEditor` — CodeMirror is a full editor whose gutter and theme look
 * nothing like this, and loading it into a 320px rail costs a lazy chunk to
 * render three static lines.
 */
function ConfigurationSql({ value }: Readonly<{ value: string }>) {
  return (
    <div
      className="tw:overflow-x-auto tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:py-2.5"
      data-testid="sql-expression-container">
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
    </div>
  );
}

/**
 * A parameter value can be far longer than the rail is wide — a `tableDiff`
 * test's `table2` is a fully-qualified table name — so the value truncates and
 * the full text stays reachable through the tooltip.
 */
function ConfigurationValue({ value }: Readonly<{ value: string }>) {
  return (
    <Tooltip placement="bottom left" title={value}>
      <span className="tw:min-w-0 tw:truncate tw:font-mono tw:text-xs tw:font-semibold tw:text-primary">
        {value}
      </span>
    </Tooltip>
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
          <Typography
            as="span"
            className="tw:shrink-0 tw:text-xs tw:text-tertiary">
            {row.label}
          </Typography>
          {typeof row.value === 'string' ? (
            <ConfigurationValue value={row.value} />
          ) : (
            row.value
          )}
        </Box>
      ))}
    </div>
  );
}

function DynamicAssertionCallout() {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:rounded-lg tw:border tw:border-utility-blue-200 tw:bg-utility-blue-50 tw:px-3 tw:py-2.5"
      data-testid="dynamic-assertion"
      gap={3}>
      {/* The sparkle takes the callout's blue — the asset draws in currentColor. */}
      <StarIcon
        aria-hidden
        className="tw:h-[18px] tw:w-[18px] tw:shrink-0 tw:text-utility-blue-600"
      />
      <div>
        <Typography
          as="span"
          className="tw:text-xs tw:font-semibold tw:text-utility-blue-700">
          {t('label.dynamic-assertion')}
        </Typography>
        <Typography
          as="span"
          className="tw:block tw:text-xs tw:text-utility-blue-600">
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
      className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-bg-primary tw:shadow-xs"
      data-testid="test-case-configuration-card">
      <Box
        align="center"
        className="tw:border-b tw:border-secondary tw:px-4 tw:py-3"
        justify="between">
        <Typography
          as="span"
          className="tw:text-sm tw:font-bold tw:text-primary">
          {t('label.configuration')}
        </Typography>
        {showEditButton && (
          <EditIconButton
            newLook
            data-testid="edit-parameter-icon"
            size="small"
            title={t('label.edit-entity', { entity: t('label.parameter') })}
            onClick={onEditParameter}
          />
        )}
      </Box>

      <div className="tw:px-4 tw:py-3.5">
        {definitionName && (
          <Typography
            as="p"
            className="tw:mb-0.5 tw:text-sm tw:font-semibold tw:text-secondary"
            data-testid="configuration-test-name">
            {definitionName}
          </Typography>
        )}
        <Typography
          as="p"
          className="tw:mb-3 tw:text-xs tw:text-tertiary"
          data-testid="configuration-category">
          {categoryLine}
        </Typography>

        <div className="tw:flex tw:flex-col tw:gap-2.5">
          {hasVersionDiff && (
            <div data-testid="configuration-version-diff">
              {versionParameterDiff}
            </div>
          )}
          {hasParameterRows && <ParameterRows rows={parameterRows} />}
          {isDynamicAssertion && <DynamicAssertionCallout />}
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
