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
import { Badge, Box, Typography } from '@openmetadata/ui-core-components';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Requirement } from '../../../generated/entity/governance/onboardingPlaybook';
import { requirementLabelKey } from '../../../utils/governance/onboarding/OnboardingField.utils';

interface Props {
  title: string;
  fieldPath: string;
  dtypeLabelKey: string;
  requirement?: Requirement;
  guidance?: string;
  children: ReactNode;
}

/** The mono chip the design uses wherever a field path is shown, so a check is traceable to a field. */
export const FieldPathChip = ({ fieldPath }: { fieldPath: string }) => (
  <Typography className="tw:font-mono tw:text-quaternary" size="text-xs">
    {fieldPath}
  </Typography>
);

/**
 * One check of the Creation gate: what it is called, which field it fills, what shape that field
 * takes and how hard it pushes - then the control itself, then the author's guidance.
 */
export const CreationCheckBlock = ({
  title,
  fieldPath,
  dtypeLabelKey,
  requirement,
  guidance,
  children,
}: Props) => {
  const { t } = useTranslation();

  return (
    <Box
      className="tw:gap-1.5"
      data-testid={`creation-check-${fieldPath}`}
      direction="col">
      <Box align="center" className="tw:gap-2" wrap="wrap">
        <Typography size="text-xs" weight="semibold">
          {title}
        </Typography>
        <FieldPathChip fieldPath={fieldPath} />
        <Typography className="tw:text-quaternary" size="text-xs">
          {t(dtypeLabelKey)}
        </Typography>
        <Badge
          color={requirement === Requirement.Blocking ? 'brand' : 'gray'}
          size="sm"
          type="pill-color">
          {t(requirementLabelKey(requirement))}
        </Badge>
      </Box>
      {/* The block's own row names the field, so the control's label is kept for screen readers only. */}
      <div className="tw:[&_span:has(>[data-testid=form-item-label])]:sr-only tw:[&_label]:sr-only">
        {children}
      </div>
      {guidance && (
        <Typography className="tw:text-quaternary" size="text-xs">
          {guidance}
        </Typography>
      )}
    </Box>
  );
};
