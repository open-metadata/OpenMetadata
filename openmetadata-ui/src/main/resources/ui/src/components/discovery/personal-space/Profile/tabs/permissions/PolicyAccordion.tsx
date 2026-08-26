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

import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Typography,
} from '@openmetadata/ui-core-components';
import { PolicyInfo } from '../../../../../../rest/permissionAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import React from 'react';
import { useTranslation } from 'react-i18next';
import PermissionRuleRow from './PermissionRuleRow';
import { getEffectBadgeColor } from './permissions.utils';

export interface PolicyAccordionProps {
  policy: PolicyInfo;
  // Expand the panel on first render (used for the primary policy in a card).
  defaultExpanded?: boolean;
}

/**
 * A single policy as an expandable accordion: header shows the policy name,
 * its Allow/Deny effect and rule count; the panel lists its rules.
 */
const PolicyAccordion: React.FC<PolicyAccordionProps> = ({
  policy,
  defaultExpanded,
}) => {
  const { t } = useTranslation();
  const itemId = policy.policy.fullyQualifiedName ?? policy.policy.name ?? '';

  return (
    <Accordion defaultExpandedKeys={defaultExpanded ? [itemId] : []}>
      <AccordionItem id={itemId}>
        <AccordionHeader className="tw:bg-utility-gray-blue-50">
          <Box
            align="center"
            className="tw:w-full tw:justify-between tw:gap-2 ">
            <Typography
              className="tw:text-utility-blue-dark-500"
              size="text-sm"
              weight="medium">
              {getEntityName(policy.policy)}
            </Typography>
            <Box align="center" className="tw:shrink-0 tw:gap-2">
              <Badge color={getEffectBadgeColor(policy.effect)} size="sm">
                {policy.effect}
              </Badge>
              <Typography className="tw:text-secondary" size="text-xs">
                {`${t('label.rule-plural')}: ${policy.rules.length}`}
              </Typography>
            </Box>
          </Box>
        </AccordionHeader>
        <AccordionPanel className="tw:border-t-0 tw:pt-0">
          <Box
            className="tw:divide-y tw:divide-border-secondary"
            direction="col">
            {policy.rules.map((rule, index) => (
              <PermissionRuleRow key={`${rule.name}-${index}`} rule={rule} />
            ))}
          </Box>
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  );
};

export default PolicyAccordion;
