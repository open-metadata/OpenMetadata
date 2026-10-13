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

import type { BreadcrumbItemType } from '@openmetadata/ui-core-components';
import {
  Box,
  Breadcrumbs,
  ProgressSteps,
  Typography,
} from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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

  const breadcrumbItems = useMemo<BreadcrumbItemType[]>(() => {
    const hasCurrentBreadcrumb = breadcrumbList.some(
      (breadcrumb) => breadcrumb.activeTitle || breadcrumb.name === currentLabel
    );
    const links = [
      { name: t('label.governance'), url: '' },
      ...breadcrumbList,
      ...(hasCurrentBreadcrumb ? [] : [{ name: currentLabel, url: '' }]),
    ];

    return links.map(({ name, url }) => ({
      id: name,
      label: name,
      href: typeof url === 'string' && url ? url : undefined,
    }));
  }, [breadcrumbList, currentLabel, t]);

  const progressSteps = useMemo(
    () => steps.map(({ name, step }) => ({ id: String(step), title: name })),
    [steps]
  );

  return (
    <Box
      align="center"
      className="csv-workflow-header tw:-mx-6 tw:border-b tw:border-secondary tw:bg-surface tw:px-8 tw:py-3"
      gap={4}
      justify="between">
      <Box className="tw:min-w-0 tw:flex-auto" direction="col" gap={1}>
        <Breadcrumbs
          data-testid="title-breadcrumb"
          divider="slash"
          items={breadcrumbItems}
          size="xs"
          type="text"
        />
        <Box align="baseline" gap={2} wrap="wrap">
          {/* A native heading avoids the prose wrapper that enlarges and wraps this inline title. */}
          <h1 className="tw:m-0 tw:text-md tw:font-semibold tw:text-primary">
            {title}
          </h1>
          <Typography as="span" color="secondary" size="text-sm">
            {description}
          </Typography>
        </Box>
      </Box>
      <Box data-testid="stepper-container">
        <span hidden data-testid="stepper" />
        <span hidden data-testid="active-step">
          {activeStep}
        </span>
        <ProgressSteps
          currentStep={steps.findIndex(({ step }) => step === activeStep)}
          labelPlacement="attach"
          size="sm"
          steps={progressSteps}
          type="number"
        />
      </Box>
    </Box>
  );
};

export default CsvWorkflowHeader;
