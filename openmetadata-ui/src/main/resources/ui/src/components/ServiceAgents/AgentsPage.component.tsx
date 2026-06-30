/*
 *  Copyright 2025 Collate.
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

import { FC } from 'react';
import './agents-preview.css';
import AgentsPageHeader from './components/AgentsPageHeader.component';
import { SERVICE_INFO } from './mock/agents.mock';

const AgentsPage: FC = () => (
  <div className="agents-preview-root tw:flex-1 tw:overflow-y-auto tw:bg-[color:var(--bg-app)]">
    <div className="tw:mx-auto tw:max-w-[1080px] tw:px-9 tw:pb-20 tw:pt-7">
      <AgentsPageHeader service={SERVICE_INFO} />
    </div>
  </div>
);

export default AgentsPage;
