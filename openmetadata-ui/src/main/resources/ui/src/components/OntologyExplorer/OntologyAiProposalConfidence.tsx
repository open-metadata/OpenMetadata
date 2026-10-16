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
import { useTranslation } from 'react-i18next';
import {
  getConfidenceColor,
  getConfidencePercent,
  OntologyProposal,
} from './utils/ontologyProposals';

interface OntologyAiProposalConfidenceProps {
  readonly item: OntologyProposal;
  readonly withLabel?: boolean;
}

const OntologyAiProposalConfidence = ({
  item,
  withLabel = false,
}: OntologyAiProposalConfidenceProps) => {
  const { t } = useTranslation();
  const percent = getConfidencePercent(item.operation);
  if (percent === undefined) {
    return null;
  }

  return (
    <Badge color={getConfidenceColor(percent)} size="sm" type="pill-color">
      {withLabel ? t('label.percent-confidence', { percent }) : `${percent}%`}
    </Badge>
  );
};

export default OntologyAiProposalConfidence;
