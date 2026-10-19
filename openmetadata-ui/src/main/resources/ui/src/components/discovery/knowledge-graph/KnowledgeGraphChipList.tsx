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

import { BadgeWithIcon, Box, Button } from '@openmetadata/ui-core-components';
import { BookClosed, Tag01 } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CHIP_LIMIT } from './KnowledgeGraphDetails.constants';

export interface KnowledgeGraphChip {
  /** Tag FQN; two chips may share a label but never an id. */
  id: string;
  label: string;
  kind: 'tag' | 'glossary';
}

interface KnowledgeGraphChipListProps {
  chips: KnowledgeGraphChip[];
}

/** Tag / glossary-term chips, capped at {@link CHIP_LIMIT} until expanded. */
const KnowledgeGraphChipList = ({ chips }: KnowledgeGraphChipListProps) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? chips : chips.slice(0, CHIP_LIMIT);

  return (
    <Box align="center" gap={1} wrap="wrap">
      {visible.map((chip) => (
        <BadgeWithIcon
          color="gray"
          iconLeading={chip.kind === 'tag' ? Tag01 : BookClosed}
          key={chip.id}
          size="sm"
          type="modern">
          {chip.label}
        </BadgeWithIcon>
      ))}
      {chips.length > CHIP_LIMIT && (
        <Button
          color="link-color"
          size="xs"
          onPress={() => setExpanded((value) => !value)}>
          {expanded
            ? t('label.view-less')
            : t('label.kg-more-count', { count: chips.length - CHIP_LIMIT })}
        </Button>
      )}
    </Box>
  );
};

export default KnowledgeGraphChipList;
