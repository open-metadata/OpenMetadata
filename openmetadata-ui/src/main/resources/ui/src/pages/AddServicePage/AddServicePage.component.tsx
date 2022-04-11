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

import React from 'react';
import { useParams } from 'react-router-dom';
import AddService from '../../components/AddService/AddService.component';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import { ServiceCategory } from '../../enums/service.enum';
// import { DataObj } from '../../interface/service.interface';

const AddServicePage = () => {
  const { serviceCategory } = useParams<{ [key: string]: string }>();

  // const onAddServiceSave = (service: DataObj) => {};

  return (
    <PageContainerV1>
      <AddService
        serviceCategory={serviceCategory as ServiceCategory}
        // onSave={onAddServiceSave}
      />
    </PageContainerV1>
  );
};

export default AddServicePage;
