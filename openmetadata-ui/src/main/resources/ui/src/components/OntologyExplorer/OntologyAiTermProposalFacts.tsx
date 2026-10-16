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

import { Badge, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import {
  PROPOSAL_LIST_CLASS_NAME,
  PROPOSAL_ROW_CLASS_NAME,
} from './OntologyAiProposal.constants';
import OntologyAiProposalSection from './OntologyAiProposalSection';
import { getReferenceLabel, ProposedTerm } from './utils/ontologyProposals';

interface OntologyAiTermProposalFactsProps {
  readonly term: ProposedTerm;
}

/** What a proposed term would carry with it: properties, mappings, assets. */
const OntologyAiTermProposalFacts = ({
  term,
}: OntologyAiTermProposalFactsProps) => {
  const { t } = useTranslation();
  const mappings = term.operation.term?.conceptMappings ?? [];
  const realizations = term.operation.term?.realizedIn ?? [];

  return (
    <>
      {term.properties.length > 0 ? (
        <OntologyAiProposalSection
          count={term.properties.length}
          testId="ontology-ai-term-properties"
          title={t('label.proposed-property-plural')}>
          <ul className={PROPOSAL_LIST_CLASS_NAME}>
            {term.properties.map((property) => (
              <li className={PROPOSAL_ROW_CLASS_NAME} key={property.id}>
                <Typography ellipsis as="span" size="text-sm" weight="medium">
                  {property.name}
                </Typography>
                {property.isIdentifier ? (
                  <Badge color="warning" size="sm" type="color">
                    {t('label.id')}
                  </Badge>
                ) : null}
                <span className="tw:flex-1" />
                <Badge color="blue" size="sm" type="pill-color">
                  {property.dataType.toLocaleLowerCase()}
                </Badge>
              </li>
            ))}
          </ul>
        </OntologyAiProposalSection>
      ) : null}

      {mappings.length > 0 ? (
        <OntologyAiProposalSection
          count={mappings.length}
          testId="ontology-ai-term-mappings"
          title={t('label.mapping-plural')}>
          <ul className={PROPOSAL_LIST_CLASS_NAME}>
            {mappings.map((mapping) => (
              <li className={PROPOSAL_ROW_CLASS_NAME} key={mapping.conceptIri}>
                <span className="tw:min-w-0 tw:flex-1">
                  <Typography ellipsis as="span" size="text-sm" weight="medium">
                    {mapping.conceptIri}
                  </Typography>
                </span>
                <Badge color="purple" size="sm" type="pill-color">
                  {mapping.mappingType.replaceAll('_', ' ').toLowerCase()}
                </Badge>
              </li>
            ))}
          </ul>
        </OntologyAiProposalSection>
      ) : null}

      {realizations.length > 0 ? (
        <OntologyAiProposalSection
          count={realizations.length}
          testId="ontology-ai-term-found-in"
          title={t('label.found-in')}>
          <ul className={PROPOSAL_LIST_CLASS_NAME}>
            {realizations.map((realization) => (
              <li className={PROPOSAL_ROW_CLASS_NAME} key={realization.id}>
                <div className="tw:min-w-0 tw:flex-1">
                  <Typography ellipsis as="p" size="text-sm" weight="medium">
                    {getReferenceLabel(realization.asset)}
                  </Typography>
                  <Typography
                    ellipsis
                    as="p"
                    className="tw:text-tertiary"
                    size="text-xs">
                    {realization.asset.fullyQualifiedName}
                  </Typography>
                </div>
                <Badge color="gray" size="sm" type="color">
                  {realization.asset.type}
                </Badge>
              </li>
            ))}
          </ul>
        </OntologyAiProposalSection>
      ) : null}
    </>
  );
};

export default OntologyAiTermProposalFacts;
