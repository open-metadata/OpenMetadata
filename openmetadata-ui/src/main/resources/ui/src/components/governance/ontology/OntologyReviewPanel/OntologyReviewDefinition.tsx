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
import { lazy, Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { OntologyReleaseMember } from '../../../../generated/type/ontologyReleaseMember';
import type { OntologyReviewDefinition as ReviewDefinition } from '../../../../rest/ontologyAPI';

const CodeEditor = lazy(
  () => import('../../../Database/SchemaEditor/CodeEditor')
);

interface OntologyReviewDefinitionProps {
  definition: ReviewDefinition | OntologyReleaseMember['payload'];
}

const OntologyReviewDefinition = ({
  definition,
}: OntologyReviewDefinitionProps) => {
  const { t } = useTranslation();
  const content = useMemo(
    () => JSON.stringify(definition, null, 2),
    [definition]
  );

  return (
    <Suspense
      fallback={<Typography role="status">{t('label.loading')}</Typography>}>
      <CodeEditor readOnly title={t('label.definition')} value={content} />
    </Suspense>
  );
};

export default OntologyReviewDefinition;
