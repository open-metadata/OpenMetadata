/*
 *  Copyright 2022 Collate.
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
import RichTextEditorPreviewer from '../../common/RichTextEditor/RichTextEditorPreviewer';

type Props = {
  data: { [name: string]: string };
};

const ChangeLogs = ({ data }: Props) => {
  const logKeys: Array<string> = Object.keys(data);

  return (
    <div>
      {logKeys.map((log) => (
        <div className="mb-4" key={log}>
          <div className="border-bottom mb-2.5 border-text">
            <p className="text-base font-medium mb-2.5 log-title">
              <RichTextEditorPreviewer
                enableSeeMoreVariant={false}
                markdown={log}
              />
            </p>
          </div>
          <RichTextEditorPreviewer
            enableSeeMoreVariant={false}
            markdown={data[log]}
          />
        </div>
      ))}
    </div>
  );
};

export default ChangeLogs;
