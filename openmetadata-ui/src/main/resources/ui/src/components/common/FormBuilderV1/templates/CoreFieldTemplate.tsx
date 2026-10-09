/*
 *  Copyright 2025 Collate.
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
import { FieldTemplateProps, getTemplate, getUiOptions } from '@rjsf/utils';
import { createContext, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { getFormDisplayLabel } from '../formBuilderV1LabelUtils';

/**
 * Field docs (markdown keyed by field name) for `FormBuilderV1`'s `fieldDocs`
 * prop. A context rather than `formContext`: RJSF skips re-rendering fields
 * when only `formContext` changes, so docs that load after the first render
 * would never reach them.
 */
export const FieldDocsContext = createContext<
  Record<string, string> | undefined
>(undefined);

export const CoreFieldTemplate = ({
  children,
  hidden = false,
  registry,
  uiSchema,
  ...props
}: FieldTemplateProps) => {
  const { t } = useTranslation();
  const { id, label, schema } = props;
  const fieldDocs = useContext(FieldDocsContext);
  const uiOptions = getUiOptions(uiSchema);
  const WrapIfAdditionalTemplate = getTemplate(
    'WrapIfAdditionalTemplate',
    registry,
    uiOptions
  );
  const fieldName = id.split('/').pop() ?? '';
  // Object fields only group their children; the leaves carry the docs.
  const doc =
    hidden || schema.type === 'object' ? undefined : fieldDocs?.[fieldName];
  const fieldDoc = useFieldDoc({
    name: id,
    label: label || getFormDisplayLabel(fieldName),
    doc,
  });

  if (hidden) {
    return <div className="tw:hidden">{children}</div>;
  }

  const field = (
    <WrapIfAdditionalTemplate
      {...props}
      registry={registry}
      uiSchema={uiSchema}>
      {children}
    </WrapIfAdditionalTemplate>
  );

  // Forms without docs keep their exact DOM (layout and tests rely on direct
  // children). A form that passes `fieldDocs` gets the wrapper from its first
  // render, even before the docs load, so the field never remounts mid-edit.
  if (!fieldDocs && !schema.deprecated) {
    return field;
  }

  return (
    <div className="tw:relative" {...fieldDoc}>
      {schema.deprecated && (
        <Badge
          className="tw:absolute tw:top-0 tw:right-0"
          color="warning"
          data-testid={`deprecated-badge-${fieldName}`}
          size="sm">
          {t('label.deprecated')}
        </Badge>
      )}
      {field}
    </div>
  );
};
