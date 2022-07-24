/*
 *  Copyright 2021 Collate
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

import { Layout } from 'antd';
import React, { FC, HTMLAttributes } from 'react';
import { background, contentStyles } from '../TaskPage.styles';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Props extends HTMLAttributes<HTMLDivElement> {}

const TaskPageLayout: FC<Props> = ({ children }) => {
  const { Content, Sider } = Layout;

  return (
    <Layout style={{ ...background, height: '100vh' }}>
      <Sider data-testid="left-sider" style={background} width={180} />
      <Content style={contentStyles}>{children}</Content>
      <Sider data-testid="right-sider" style={background} width={180} />
    </Layout>
  );
};

export default TaskPageLayout;
