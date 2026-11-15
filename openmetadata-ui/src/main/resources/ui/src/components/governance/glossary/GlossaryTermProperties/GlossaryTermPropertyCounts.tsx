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
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import { getPropertyCounts } from '../../../../utils/governance/glossary/GlossaryTermProperties.utils';

interface GlossaryTermPropertyCountsProps {
  effectiveProperties: GlossaryTerm['effectiveProperties'];
}

const GlossaryTermPropertyCounts = ({
  effectiveProperties,
}: GlossaryTermPropertyCountsProps) => {
  const { t } = useTranslation();
  const { own, inherited } = getPropertyCounts(effectiveProperties);

  if (own + inherited === 0) {
    return <Typography color="secondary">{NO_DATA_PLACEHOLDER}</Typography>;
  }

  return (
    <Box data-testid="glossary-term-property-counts" direction="col">
      {own > 0 && (
        <Typography size="text-sm">
          {t('label.count-own', { count: own })}
        </Typography>
      )}
      {inherited > 0 && (
        <Typography color="secondary" size="text-xs">
          {t('label.count-inherited', { count: inherited })}
        </Typography>
      )}
    </Box>
  );
};

export default GlossaryTermPropertyCounts;
