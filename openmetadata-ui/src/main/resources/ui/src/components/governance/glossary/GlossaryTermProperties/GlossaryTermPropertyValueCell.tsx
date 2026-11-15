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

import { Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { EffectiveGlossaryTermProperty } from '../../../../generated/entity/data/glossaryTerm';
import { GlossaryTermPropertyDatatype } from '../../../../generated/type/glossaryTermProperty';
import {
  formatPropertyValue,
  isHttpUrl,
} from '../../../../utils/governance/glossary/GlossaryTermProperties.utils';

interface GlossaryTermPropertyValueCellProps {
  entry: Pick<EffectiveGlossaryTermProperty, 'property' | 'values'>;
}

const GlossaryTermPropertyValueCell = ({
  entry,
}: GlossaryTermPropertyValueCellProps) => {
  const { t } = useTranslation();
  const { property, values } = entry;
  const testId = `glossary-term-property-value-${property.name}`;

  if (property.datatype === GlossaryTermPropertyDatatype.URL && values.length) {
    return (
      <Typography as="span" data-testid={testId} size="text-sm">
        {values.map((value, index) => (
          <span key={value}>
            {index > 0 && ', '}
            {isHttpUrl(value) ? (
              <a
                className="tw:text-brand-secondary tw:hover:underline"
                href={value}
                rel="noopener noreferrer"
                target="_blank">
                {value}
              </a>
            ) : (
              value
            )}
          </span>
        ))}
      </Typography>
    );
  }
  const text = formatPropertyValue(property, values, t);

  return (
    <Typography
      color={text ? undefined : 'secondary'}
      data-testid={testId}
      size="text-sm">
      {text ?? t('label.no-value')}
    </Typography>
  );
};

export default GlossaryTermPropertyValueCell;
