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
import DataInsightSummary from './DataInsightSummary';
import DescriptionInsight from './DescriptionInsight';
import OwnerInsight from './OwnerInsight';
import TierInsight from './TierInsight';
import TopActiveUsers from './TopActiveUsers';
import TopViewEntities from './TopViewEntities';
import TotalEntityInsight from './TotalEntityInsight';

const DataInsightDetail = () => {
  return (
    <>
      <DataInsightSummary />
      <TotalEntityInsight />
      <DescriptionInsight />
      <OwnerInsight />
      <TierInsight />
      <TopViewEntities />
      <TopActiveUsers />
    </>
  );
};

export default DataInsightDetail;
