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

import { Check } from '@untitledui/icons';
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
    <div className="csv-workflow-header">
      <div className="csv-workflow-title-block">
        <nav
          aria-label={t('label.navigation')}
          className="csv-workflow-breadcrumb"
          data-testid="title-breadcrumb">
          {workflowBreadcrumbs.map((breadcrumb, index) => {
            const isLast = index === workflowBreadcrumbs.length - 1;
            const content = (
              <span className={isLast ? 'active' : undefined}>
                {breadcrumb.name}
              </span>
            );

            return (
              <span
                className="csv-workflow-breadcrumb-item"
                data-testid="breadcrumb-item"
                key={`${breadcrumb.name}-${index}`}>
                {!isLast && breadcrumb.url ? (
                  <Link to={breadcrumb.url}>{content}</Link>
                ) : (
                  content
                )}
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className="csv-workflow-breadcrumb-separator">
                    /
                  </span>
                )}
              </span>
            );
          })}
        </nav>
        <div className="csv-workflow-title-row">
          <h1 className="csv-workflow-title">{title}</h1>
          <span className="csv-workflow-description">{description}</span>
        </div>
      </div>
      <div
        className="csv-workflow-inline-stepper"
        data-testid="csv-workflow-stepper">
        <span hidden data-testid="stepper" />
        <span hidden data-testid="active-step">
          {activeStep}
        </span>
        {steps.map((step, index) => {
          const isActive = step.step === activeStep;
          const isDone = step.step < activeStep;

          return (
            <Fragment key={step.step}>
              <div
                className={[
                  'csv-workflow-step',
                  isActive ? 'active' : '',
                  isDone ? 'done' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-active={isActive}
                data-testid={`csv-workflow-step-${step.step}`}>
                <span className="csv-workflow-step-circle">
                  {isDone ? <Check size={10} strokeWidth={2.5} /> : index + 1}
                </span>
                <span className="csv-workflow-step-label">{step.name}</span>
              </div>
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={[
                    'csv-workflow-step-connector',
                    isDone ? 'done' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default CsvWorkflowHeader;
