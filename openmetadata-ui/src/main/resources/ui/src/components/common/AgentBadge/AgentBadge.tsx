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
import { AskCollateSparkle } from '@openmetadata/ui-core-components/icons';

/** Names the AI agent that proposed something, where a person's avatar and name would go. */
const AgentBadge = ({ name }: { name: string }) => (
  <span
    className="tw:inline-flex tw:items-center tw:gap-1 tw:rounded-md tw:bg-utility-purple-100 tw:px-2 tw:py-0.5 tw:text-xs tw:font-semibold tw:whitespace-nowrap tw:text-utility-purple-700"
    data-testid="agent-badge">
    <AskCollateSparkle aria-hidden className="tw:size-3" />
    {name}
  </span>
);

export default AgentBadge;
