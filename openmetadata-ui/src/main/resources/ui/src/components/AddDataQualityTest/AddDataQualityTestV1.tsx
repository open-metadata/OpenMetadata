/*
 *  Copyright 2022 Collate
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

import { Typography } from 'antd';
import { StepperStepType } from 'Models';
import React, { useMemo, useState } from 'react';
import {
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getServiceDetailsPath,
  getTableTabPath,
} from '../../constants/constants';
import { FqnPart } from '../../enums/entity.enum';
import { PageLayoutType } from '../../enums/layout.enum';
import { ServiceCategory } from '../../enums/service.enum';
import {
  getEntityName,
  getPartialNameFromTableFQN,
} from '../../utils/CommonUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import PageLayout from '../containers/PageLayout';
import IngestionStepper from '../IngestionStepper/IngestionStepper.component';
import { AddDataQualityTestProps } from './AddDataQualityTest.interface';
import RightPanel from './components/RightPanel';

const AddDataQualityTestV1: React.FC<AddDataQualityTestProps> = ({ table }) => {
  const [activeServiceStep, setActiveServiceStep] = useState(1);

  const STEPS_FOR_ADD_SERVICE: Array<StepperStepType> = [
    { name: 'Select/Add Test Suite', step: 1 },
    { name: 'Configure Test Case', step: 2 },
    { name: 'Schedule Interval', step: 3 },
  ];
  const breadcrumb = useMemo(() => {
    const { service, serviceType, fullyQualifiedName = '' } = table;

    return [
      {
        name: service?.name || '',
        url: service
          ? getServiceDetailsPath(
              service.name || '',
              ServiceCategory.DATABASE_SERVICES
            )
          : '',
        imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
      },
      {
        name: getPartialNameFromTableFQN(fullyQualifiedName, [
          FqnPart.Database,
        ]),
        url: getDatabaseDetailsPath(fullyQualifiedName),
      },
      {
        name: getPartialNameFromTableFQN(fullyQualifiedName, [FqnPart.Schema]),
        url: getDatabaseSchemaDetailsPath(fullyQualifiedName),
      },
      {
        name: getEntityName(table),
        url: getTableTabPath(fullyQualifiedName),
      },
      {
        name: 'Add Table Test',
        url: '',
        activeTitle: true,
      },
    ];
  }, [table]);

  return (
    <PageLayout
      classes="tw-max-w-full-hd tw-h-full tw-pt-4"
      header={<TitleBreadcrumb titleLinks={breadcrumb} />}
      layout={PageLayoutType['2ColRTL']}
      rightPanel={<RightPanel />}>
      <div className="tw-form-container">
        <Typography.Title level={5}>Add Table Test</Typography.Title>
        <IngestionStepper
          activeStep={activeServiceStep}
          steps={STEPS_FOR_ADD_SERVICE}
        />
      </div>
    </PageLayout>
  );
};

export default AddDataQualityTestV1;
