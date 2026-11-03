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
import { Avatar } from '@openmetadata/ui-core-components';
import { AiAgent } from '@openmetadata/ui-core-components/icons';

const SmallAgentIcon = () => <AiAgent className="tw:size-2.5" />;
const AgentIcon = () => <AiAgent className="tw:size-3.5" />;

const AGENT_ICONS = { xxs: SmallAgentIcon, xs: AgentIcon };

/** An AI agent's avatar, where a person's picture would go. */
const AgentAvatar = ({ size }: { size: keyof typeof AGENT_ICONS }) => (
  <Avatar
    colorVariant="plain"
    data-testid="agent-avatar"
    placeholderIcon={AGENT_ICONS[size]}
    size={size}
  />
);

export default AgentAvatar;
