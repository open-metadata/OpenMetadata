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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import {
  buildDesignerSchema,
  buildStageMappings,
  buildTransitionForms,
  getDesignerPreviewPayload,
  parseSchemaToDesignerFields,
  parseStageMappings,
  parseTransitionForms,
} from './TaskFormDesignerUtils';

describe('TaskFormDesignerUtils', () => {
  it('builds schemas from designer fields while preserving ui metadata', () => {
    const { formSchema, uiSchema } = buildDesignerSchema(
      [
        {
          key: 'field-1',
          name: 'requestReason',
          label: 'Request Reason',
          description: 'Why this change is needed',
          type: 'longText',
          required: true,
          hidden: false,
          options: [],
          schemaType: 'string',
        },
      ],
      {
        type: 'object',
        additionalProperties: true,
        properties: {},
      },
      {
        'ui:handler': {
          type: 'custom',
        },
      }
    );

    expect(formSchema.properties).toEqual({
      requestReason: {
        description: 'Why this change is needed',
        title: 'Request Reason',
        type: 'string',
      },
    });
    expect(formSchema.required).toEqual(['requestReason']);
    expect(uiSchema).toEqual({
      'ui:handler': {
        type: 'custom',
      },
      'ui:order': ['requestReason'],
      requestReason: {
        'ui:widget': 'textarea',
      },
    });
  });

  it('parses and rebuilds transition forms', () => {
    const transitions = parseTransitionForms({
      approve: {
        formSchema: {
          additionalProperties: true,
          type: 'object',
          properties: {
            reviewerComment: {
              type: 'string',
              title: 'Reviewer Comment',
            },
          },
          required: ['reviewerComment'],
        },
        uiSchema: {
          reviewerComment: {
            'ui:widget': 'textarea',
          },
        },
      },
    });

    expect(transitions[0].transitionId).toBe('approve');
    expect(transitions[0].fields[0]).toMatchObject({
      name: 'reviewerComment',
      label: 'Reviewer Comment',
      required: true,
      type: 'longText',
    });

    expect(buildTransitionForms(transitions)).toEqual({
      approve: {
        formSchema: {
          additionalProperties: true,
          type: 'object',
          properties: {
            reviewerComment: {
              type: 'string',
              title: 'Reviewer Comment',
            },
          },
          required: ['reviewerComment'],
        },
        uiSchema: {
          'ui:order': ['reviewerComment'],
          reviewerComment: {
            'ui:widget': 'textarea',
          },
        },
      },
    });
  });

  it('parses stage mappings into editable rows and rebuilds them', () => {
    const mappings = parseStageMappings({
      open: 'Open',
      resolved: 'Completed',
    });

    expect(mappings).toHaveLength(2);
    expect(buildStageMappings(mappings)).toEqual({
      open: 'Open',
      resolved: 'Completed',
    });
  });

  it('keeps hidden fields hidden when round-tripping the schema', () => {
    const fields = parseSchemaToDesignerFields(
      {
        type: 'object',
        properties: {
          fieldPath: {
            type: 'string',
            title: 'Field Path',
          },
        },
      },
      {
        fieldPath: {
          'ui:widget': 'hidden',
        },
      }
    );

    const { uiSchema } = buildDesignerSchema(fields);

    expect(fields[0]).toMatchObject({
      hidden: true,
      widget: 'hidden',
    });
    expect(uiSchema).toEqual({
      'ui:order': ['fieldPath'],
      fieldPath: {
        'ui:widget': 'hidden',
      },
    });
  });

  it('creates tag label preview payloads for tag selector widgets', () => {
    const preview = getDesignerPreviewPayload([
      {
        key: 'field-1',
        name: 'suggestedValue',
        label: 'Suggested Tags',
        description: 'Tag preview',
        type: 'shortText',
        required: true,
        hidden: false,
        options: [],
        schemaType: 'string',
        widget: 'tagSelector',
      },
    ]);

    expect(preview.suggestedValue).toEqual([
      expect.objectContaining({
        tagFQN: 'SampleClassification.SuggestedTags',
        displayName: 'Suggested Tags',
        name: 'SuggestedTags',
        source: 'Classification',
        state: 'Confirmed',
        labelType: 'Manual',
      }),
    ]);
  });
});
