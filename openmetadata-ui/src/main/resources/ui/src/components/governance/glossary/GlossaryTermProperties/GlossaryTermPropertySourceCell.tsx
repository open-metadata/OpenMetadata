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

import { Badge, BadgeWithIcon, Box } from '@openmetadata/ui-core-components';
import { CornerDownRight } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { GlossaryTermPropertySource } from '../../../../utils/governance/glossary/GlossaryTermProperties.types';

interface GlossaryTermPropertySourceCellProps {
  source: GlossaryTermPropertySource;
}

const GlossaryTermPropertySourceCell = ({
  source,
}: GlossaryTermPropertySourceCellProps) => {
  const { t } = useTranslation();

  if (source.kind === 'declared') {
    return (
      <Badge color="gray" size="sm" type="color">
        {t('label.defined-here')}
      </Badge>
    );
  }

  return (
    <Box align="center" gap={1} wrap="wrap">
      <BadgeWithIcon
        color="blue"
        iconLeading={CornerDownRight}
        size="sm"
        type="color">
        {source.from}
      </BadgeWithIcon>
      {source.kind === 'overriddenHere' && (
        <Badge color="orange" size="sm" type="color">
          {t('label.overridden-here')}
        </Badge>
      )}
      {source.kind === 'overriddenIn' && (
        <Badge color="orange" size="sm" type="color">
          {t('label.overridden-in', { term: source.in })}
        </Badge>
      )}
    </Box>
  );
};

export default GlossaryTermPropertySourceCell;
