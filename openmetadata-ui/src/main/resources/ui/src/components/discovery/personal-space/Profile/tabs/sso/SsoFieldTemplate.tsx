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

import { Badge, useFieldDoc } from '@openmetadata/ui-core-components';
import { FieldTemplateProps } from '@rjsf/utils';
import { useTranslation } from 'react-i18next';
import { DEPRECATED_SSO_PROPERTIES } from '../../../../../../constants/Services.constant';
import { getFormDisplayLabel } from '../../../../../common/FormBuilderV1/formBuilderV1LabelUtils';
import { CoreFieldTemplate } from '../../../../../common/FormBuilderV1/templates/CoreFieldTemplate';
import { FIELD_MAPPINGS } from '../../../../../SettingsSso/SSODocPanel/SSODocPanel.constants';
import type { SsoFormContext } from './SsoConfigureForm.types';

/**
 * Core field template plus the two SSO extras: the field registers its doc
 * section for the "Show hint" popover, and deprecated fields carry a badge.
 */
const SsoFieldTemplate = (props: FieldTemplateProps) => {
  const { t } = useTranslation();
  const { id, label, schema, hidden, formContext } = props;
  const fieldName = id.split('/').pop() ?? '';
  const isObject = schema.type === 'object';
  const isDeprecated =
    Boolean(schema.deprecated) || DEPRECATED_SSO_PROPERTIES.includes(fieldName);

  // Object fields only group their children; the leaves carry the docs.
  const doc =
    hidden || isObject
      ? undefined
      : (formContext as SsoFormContext | undefined)?.fieldDocs?.[
          FIELD_MAPPINGS[fieldName] ?? fieldName
        ];
  const fieldDoc = useFieldDoc({
    name: id,
    label: label || getFormDisplayLabel(fieldName),
    doc,
  });

  if (hidden || isObject) {
    return <CoreFieldTemplate {...props} />;
  }

  return (
    <div className="tw:relative" {...fieldDoc}>
      {isDeprecated && (
        <Badge
          className="tw:absolute tw:top-0 tw:right-0"
          color="warning"
          data-testid={`deprecated-badge-${fieldName}`}
          size="sm"
          type="pill-color">
          {t('label.deprecated')}
        </Badge>
      )}
      <CoreFieldTemplate {...props} />
    </div>
  );
};

export default SsoFieldTemplate;
