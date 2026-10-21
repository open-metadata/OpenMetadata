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
import {
  Box,
  Card,
  RadioButton,
  RadioGroup,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { VersionBump } from '../../../../generated/api/data/captureOntologyRelease';
import { nextSemanticVersion } from './OntologyReleasePanel.utils';

interface OntologyVersionEditorProps {
  baseVersion?: string;
  bump: VersionBump;
  notes: string;
  isDisabled: boolean;
  onBumpChange: (bump: VersionBump) => void;
  onNotesChange: (notes: string) => void;
}

const OntologyVersionEditor = ({
  baseVersion,
  bump,
  notes,
  isDisabled,
  onBumpChange,
  onNotesChange,
}: OntologyVersionEditorProps) => {
  const { t } = useTranslation();

  return (
    <Box direction="col" gap={4}>
      <Typography as="h3" size="text-sm" weight="semibold">
        {t('label.version')}
      </Typography>
      <RadioGroup
        aria-label={t('label.version')}
        isDisabled={isDisabled}
        value={bump}
        onChange={(value) => {
          const selected = Object.values(VersionBump).find(
            (candidate) => candidate === value
          );
          if (selected) {
            onBumpChange(selected);
          }
        }}>
        <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:sm:grid-cols-3">
          {[VersionBump.Patch, VersionBump.Minor, VersionBump.Major].map(
            (option) => (
              <Card isSelected={bump === option} key={option} size="sm">
                <Card.Content>
                  <RadioButton
                    data-testid={`ontology-version-${option}`}
                    hint={nextSemanticVersion(baseVersion, option)}
                    label={t(`label.version-${option}`)}
                    value={option}
                  />
                  <Typography color="secondary" size="text-xs">
                    {t(`message.ontology-version-${option}`)}
                  </Typography>
                </Card.Content>
              </Card>
            )
          )}
        </div>
      </RadioGroup>
      <TextArea
        hideRequiredIndicator
        data-testid="ontology-release-notes"
        isDisabled={isDisabled}
        label={t('label.release-notes')}
        maxLength={16384}
        rows={4}
        value={notes}
        onChange={onNotesChange}
      />
    </Box>
  );
};

export default OntologyVersionEditor;
