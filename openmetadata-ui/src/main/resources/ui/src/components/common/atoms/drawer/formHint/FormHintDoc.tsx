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
import RichTextEditorPreviewerV1 from '../../../RichTextEditor/RichTextEditorPreviewerV1';

interface FormHintDocProps {
  markdown: string;
}

/**
 * A field's hint markdown. `form-hint-doc` carries the hint typography; the
 * column scrolls, so the whole doc renders without a "see more" toggle.
 */
export const FormHintDoc = ({ markdown }: Readonly<FormHintDocProps>) => (
  <div className="form-hint-doc">
    <RichTextEditorPreviewerV1
      enableSeeMoreVariant={false}
      markdown={markdown}
    />
  </div>
);
