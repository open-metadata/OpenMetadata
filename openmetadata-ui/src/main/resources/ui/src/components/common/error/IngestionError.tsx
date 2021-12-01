/*
 *  Copyright 2021 Collate
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

import { uniqueId } from 'lodash';
import React from 'react';

const stepsData = [
  {
    step: 1,
    title: 'Step1',
    description:
      'Lorem, ipsum dolor sit amet consectetur adipisicing elit. Aliquam, dolores!',
    link: 'https://docs.open-metadata.org/install/metadata-ingestion/ingest-sample-data',
  },
  {
    step: 2,
    title: 'Step2',
    description:
      'Lorem ipsum dolor sit amet consectetur adipisicing elit. Corporis, quos.',
    link: 'https://docs.open-metadata.org/install/metadata-ingestion/ingest-sample-data#index-sample-data-into-elasticsearch',
  },
  {
    step: 3,
    title: 'Step3',
    description:
      'Lorem ipsum dolor sit amet consectetur adipisicing elit. Corporis, quos.',
    link: 'https://docs.open-metadata.org/install/metadata-ingestion/connectors',
  },
  {
    step: 4,
    title: 'Step4',
    description:
      'Lorem ipsum dolor sit amet consectetur adipisicing elit. Corporis, quos.',
    link: 'https://slack.open-metadata.org',
  },
];

const IngestionError = () => {
  return (
    <div className="tw-p-4 tw-mt-10 ">
      <div className="tw-mb-3 tw-text-center">
        <p>
          <span>Welcome to OpenMetadata. </span>
          We are unable to access Airflow for ingestion workflow.
        </p>

        <p>
          Please follow the instructions here to set up Airflow for ingestion
          workflow.
        </p>
      </div>
      <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-mt-5">
        {stepsData.map((data) => (
          <div
            className="tw-card tw-flex tw-flex-col tw-justify-between tw-p-5"
            key={uniqueId()}>
            <div>
              <div className="tw-flex tw-mb-2">
                <div className="tw-rounded-full tw-flex tw-justify-center tw-items-center tw-h-10 tw-w-10 tw-border-2 tw-border-primary tw-text-lg tw-font-bold tw-text-primary">
                  {data.step}
                </div>
              </div>

              <h6
                className="tw-text-base tw-text-grey-body tw-font-medium"
                data-testid="service-name">
                {data.title}
              </h6>

              <p className="tw-text-grey-body tw-pb-1 tw-text-sm tw-mb-5">
                {data.description}
              </p>
            </div>

            <p>
              <a href={data.link} rel="noopener noreferrer" target="_blank">
                Click here &gt;&gt;
              </a>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IngestionError;
