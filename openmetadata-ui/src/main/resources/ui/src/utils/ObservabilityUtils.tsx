/*
 *  Copyright 2024 Collate.
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
import { ReactComponent as PipelineIcon } from '../assets/svg/ic-pipeline.svg';
import { ReactComponent as ContainerIcon } from '../assets/svg/ic-storage.svg';
import { ReactComponent as TableIcon } from '../assets/svg/ic-table.svg';
import { ReactComponent as TopicIcon } from '../assets/svg/ic-topic.svg';
import { ReactComponent as IconTestSuite } from '../assets/svg/icon-test-suite.svg';

export const getIconForEntity = (type: string) => {
  switch (type) {
    case 'container':
      return <ContainerIcon height={16} width={16} />;
    case 'pipeline':
      return <PipelineIcon height={16} width={16} />;
    case 'topic':
      return <TopicIcon height={16} width={16} />;
    case 'table':
      return <TableIcon height={16} width={16} />;
    case 'testCase':
    case 'testSuite':
      return <IconTestSuite height={16} width={16} />;
  }

  return null;
};
