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

/* eslint-disable max-len */

import axios from 'axios';
import React, { useEffect, useState } from 'react';
import RichTextEditorPreviewer from '../../common/RichTextEditor/RichTextEditorPreviewer';

type Props = {
  data: { [name: string]: string };
};

const ChangeLogs: React.FC<Props> = () => {
  const [changeLogs, setChangeLogs] = useState<string>('');

  useEffect(() => {
    axios
      .get(
        'http://localhost:8000/storage/2/8bc1c66a-6b4c-42a6-b5ed-e475139bdef7.md'
      )
      .then((response) => {
        setChangeLogs(response.data);
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error(error);
      });
  }, []);

  return (
    <div>
      <RichTextEditorPreviewer
        enableSeeMoreVariant={false}
        markdown={changeLogs}
      />
    </div>
  );
};

export default ChangeLogs;
