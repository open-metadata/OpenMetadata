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

import { Box, Typography } from '@openmetadata/ui-core-components';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ContextMemory } from '../../../../generated/entity/context/contextMemory';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getGlossaryPath } from '../../../../utils/RouterUtils';
import { getDerivedTerms } from './MemoryDerivedTerm.utils';

export interface MemoryDerivedTermProps {
  memory: ContextMemory;
  isViewOnly: boolean;
  onNavigate: () => void;
}

const MemoryDerivedTerm: FC<MemoryDerivedTermProps> = ({
  memory,
  isViewOnly,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const derivedTerms = getDerivedTerms(memory);

  if (derivedTerms.length === 0) {
    return null;
  }

  return (
    <Box data-testid="memory-derived-term" direction="col" gap={2}>
      <Typography size="text-sm" weight="medium">
        {t('label.derived-term')}
      </Typography>
      {derivedTerms.map((term) =>
        isViewOnly ? (
          <Link
            className="tw:text-link tw:hover:underline"
            key={term.id}
            to={getGlossaryPath(term.fullyQualifiedName)}
            onClick={onNavigate}>
            {getEntityName(term)}
          </Link>
        ) : (
          <Typography className="tw:text-tertiary" key={term.id} size="text-sm">
            {getEntityName(term)}
          </Typography>
        )
      )}
    </Box>
  );
};

export default MemoryDerivedTerm;
