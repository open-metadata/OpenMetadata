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

import { Box, Typography } from '@openmetadata/ui-core-components';
import { Check } from '@openmetadata/ui-core-components/icons';
import { Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { TitleBreadcrumbProps } from '../../TitleBreadcrumb/TitleBreadcrumb.interface';
import type { CsvWorkflowHeaderProps } from './CsvWorkflowHeader.interface';

const CsvWorkflowHeader = ({
  breadcrumbList = [],
  activeStep,
  currentLabel,
  description,
  steps,
  title,
}: CsvWorkflowHeaderProps) => {
  const { t } = useTranslation();

  const workflowBreadcrumbs = useMemo<
    TitleBreadcrumbProps['titleLinks']
  >(() => {
    const hasCurrentBreadcrumb = breadcrumbList.some(
      (breadcrumb) => breadcrumb.activeTitle || breadcrumb.name === currentLabel
    );

    return [
      {
        name: t('label.governance'),
        url: '',
      },
      ...breadcrumbList,
      ...(hasCurrentBreadcrumb
        ? []
        : [
            {
              activeTitle: true,
              name: currentLabel,
              url: '',
            },
          ]),
    ];
  }, [breadcrumbList, currentLabel, t]);

  return (
    <Box
      align="center"
      className="csv-workflow-header tw:-mx-6 tw:border-b tw:border-[var(--om-grey-15,#eaecf5)] tw:bg-white tw:px-8 tw:py-3 tw:dark:border-secondary tw:dark:bg-surface"
      gap={4}
      justify="between">
      <Box
        className="csv-workflow-title-block tw:min-w-0 tw:flex-auto"
        direction="col">
        <nav
          aria-label={t('label.navigation')}
          className="csv-workflow-breadcrumb tw:mb-0.5 tw:flex tw:flex-wrap tw:items-center tw:gap-1.5 tw:text-xs tw:leading-[18px]
tw:text-[var(--tw-color-utility-gray-600)] tw:dark:text-tertiary tw:[&_a]:text-inherit"
          data-testid="title-breadcrumb">
          {workflowBreadcrumbs.map((breadcrumb, index) => {
            const isLast = index === workflowBreadcrumbs.length - 1;
            const content = (
              <span
                className={
                  isLast
                    ? 'active tw:font-semibold tw:text-[var(--tw-color-utility-gray-900)] tw:dark:text-primary'
                    : undefined
                }>
                {breadcrumb.name}
              </span>
            );

            return (
              <span
                className="csv-workflow-breadcrumb-item tw:inline-flex tw:items-center tw:gap-1.5"
                data-testid="breadcrumb-item"
                key={breadcrumb.name}>
                {!isLast && breadcrumb.url ? (
                  <Link to={breadcrumb.url}>{content}</Link>
                ) : (
                  content
                )}
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className="csv-workflow-breadcrumb-separator tw:text-[var(--tw-color-utility-gray-400)] tw:dark:text-quaternary">
                    /
                  </span>
                )}
              </span>
            );
          })}
        </nav>
        <Box
          align="baseline"
          className="csv-workflow-title-row tw:gap-2.5"
          wrap="wrap">
          {/* A native heading avoids the prose wrapper that enlarges and wraps this inline title. */}
          <h1
            className="csv-workflow-title tw:m-0 tw:text-base tw:font-semibold tw:tracking-[-0.005em] tw:leading-[22px]
tw:text-[var(--tw-color-utility-gray-900)] tw:dark:text-primary">
            {title}
          </h1>
          <Typography
            as="span"
            className="csv-workflow-description tw:text-[13px] tw:leading-[18px] tw:text-[var(--tw-color-utility-gray-600)] tw:dark:text-tertiary">
            {description}
          </Typography>
        </Box>
      </Box>
      <Box
        align="center"
        className="csv-workflow-inline-stepper tw:min-w-[340px] tw:flex-none"
        data-testid="stepper-container"
        gap={2}
        justify="end">
        <span hidden data-testid="stepper" />
        <span hidden data-testid="active-step">
          {activeStep}
        </span>
        {steps.map((step, index) => {
          const isActive = step.step === activeStep;
          const isDone = step.step < activeStep;

          return (
            <Fragment key={step.step}>
              <Box
                className={[
                  'csv-workflow-step tw:inline-flex tw:items-center tw:gap-1.5 tw:whitespace-nowrap tw:rounded-full tw:border ' +
                    'tw:border-transparent tw:py-[5px] tw:pr-2.5 tw:pl-1.5 tw:text-xs tw:font-medium tw:leading-[18px] ' +
                    'tw:text-[var(--tw-color-utility-gray-600)] tw:dark:text-tertiary',
                  isActive
                    ? 'active tw:bg-[var(--ant-primary-50)] tw:border-[var(--ant-primary-1)] tw:text-[var(--ant-primary-6)] ' +
                      'tw:dark:bg-brand-primary tw:dark:border-brand-subtle tw:dark:text-brand-secondary'
                    : '',
                  isDone
                    ? 'done tw:text-[var(--tw-color-utility-gray-700)] tw:dark:text-secondary'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-active={isActive}
                data-testid={`csv-workflow-step-${step.step}`}>
                <span
                  className={[
                    'csv-workflow-step-circle tw:inline-flex tw:size-4 tw:items-center tw:justify-center tw:rounded-full tw:text-[10px] tw:font-semibold tw:leading-none',
                    isActive || isDone
                      ? 'tw:bg-[var(--ant-primary-6)] tw:text-white tw:dark:bg-brand-solid tw:dark:text-white'
                      : 'tw:bg-[var(--tw-color-utility-gray-100)] tw:text-[var(--tw-color-utility-gray-600)] tw:dark:bg-tertiary tw:dark:text-secondary',
                  ].join(' ')}>
                  {isDone ? <Check size={10} strokeWidth={2.5} /> : index + 1}
                </span>
                <span className="csv-workflow-step-label">{step.name}</span>
              </Box>
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={[
                    'csv-workflow-step-connector tw:inline-flex tw:h-[1.5px] tw:min-w-6 tw:w-[6vw] tw:bg-[var(--ant-primary-1)] tw:dark:bg-border-secondary',
                    isDone
                      ? 'done tw:bg-[var(--ant-primary-6)] tw:dark:bg-brand-solid'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              )}
            </Fragment>
          );
        })}
      </Box>
    </Box>
  );
};

export default CsvWorkflowHeader;
