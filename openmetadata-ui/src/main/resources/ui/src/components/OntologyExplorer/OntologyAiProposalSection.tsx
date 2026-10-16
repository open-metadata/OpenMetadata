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
import { ReactNode } from 'react';

interface OntologyAiProposalSectionProps {
  readonly children: ReactNode;
  readonly count: string | number;
  readonly hint?: string;
  readonly testId: string;
  readonly title: string;
}

const OntologyAiProposalSection = ({
  children,
  count,
  hint,
  testId,
  title,
}: OntologyAiProposalSectionProps) => (
  <section className="tw:flex tw:flex-col tw:gap-3" data-testid={testId}>
    <div>
      <div className="tw:flex tw:items-center tw:gap-2">
        <Typography as="span" size="text-sm" weight="semibold">
          {title}
        </Typography>
        <Badge color="gray" size="sm" type="pill-color">
          {count}
        </Badge>
      </div>
      {hint ? (
        <Typography as="p" className="tw:mt-1 tw:text-tertiary" size="text-xs">
          {hint}
        </Typography>
      ) : null}
    </div>
    {children}
  </section>
);

export default OntologyAiProposalSection;
