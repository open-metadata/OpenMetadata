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
import { Badge } from '@openmetadata/ui-core-components';
import { AskCollateSparkle } from '@openmetadata/ui-core-components/icons';

/** Names the AI agent that proposed something, where a person's avatar and name would go. */
const AgentBadge = ({ name }: { name: string }) => (
  <Badge
    bordered={false}
    className="tw:gap-1 tw:bg-utility-purple-100 tw:font-semibold"
    color="purple"
    data-testid="agent-badge"
    size="sm"
    type="color">
    <AskCollateSparkle aria-hidden className="tw:size-3" />
    {name}
  </Badge>
);

export default AgentBadge;
