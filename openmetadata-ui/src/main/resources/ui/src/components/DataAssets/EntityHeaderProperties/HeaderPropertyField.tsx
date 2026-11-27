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
  Button,
  ButtonUtility,
  Dot,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit01, Plus } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { isCustomHeaderProperty } from '../../../utils/EntityHeaderProperties.utils';
import { HeaderProperty } from './EntityHeaderProperties.types';

const HeaderPropertyField = ({ property }: { property: HeaderProperty }) => {
  const { t } = useTranslation();
  const { label, isEmpty, content, renderEditor, editorTestId, testId } =
    property;

  const renderValue = () => {
    if (!isEmpty) {
      return content;
    }

    return renderEditor
      ? renderEditor(
          <Button
            aria-label={t('label.add-entity', { entity: label })}
            color="secondary"
            data-testid={editorTestId}
            iconLeading={Plus}
            size="xs">
            {t('label.add')}
          </Button>
        )
      : NO_DATA_PLACEHOLDER;
  };

  return (
    <Box className="tw:min-w-0" data-testid={testId} direction="col" gap={1}>
      <Box align="center" className="tw:min-h-5" gap={1}>
        {isCustomHeaderProperty(property) && (
          <Dot aria-hidden className="tw:text-utility-purple-500" size="xs" />
        )}
        <Typography
          as="span"
          className="tw:whitespace-nowrap"
          color="quaternary"
          size="text-xs"
          weight="medium">
          {label}
        </Typography>
        {renderEditor &&
          !isEmpty &&
          renderEditor(
            <ButtonUtility
              data-testid={editorTestId}
              icon={Edit01}
              size="xs"
              tooltip={t('label.edit-entity', { entity: label })}
            />
          )}
      </Box>
      <Box
        align="center"
        className="tw:min-h-6 tw:max-w-60 tw:min-w-0 tw:text-sm tw:font-medium tw:text-primary">
        {renderValue()}
      </Box>
    </Box>
  );
};

export default HeaderPropertyField;
