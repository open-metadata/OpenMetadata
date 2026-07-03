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

import '@fontsource/source-code-pro'; // Font 400

// Variable Inter aliased under the "Inter" family name. Loads one woff2 per
// Unicode subset covering the full 100–900 weight axis, replacing the prior
// 6 weight-specific woff2 files per subset (~30 → ~7 fetches). See the file
// header in {@link ./inter-variable.css} for context.
import './inter-variable.css';

// reactflow CSS is co-located with the runtime in LineageProvider so it only
// loads when the lineage canvas mounts. Previously imported here, which kept
// `vendor-reactflow` in the entry chunk's modulepreload list even after the
// 11 util/hook files were converted to `import type` (see PR-1 of bundle-size
// follow-up). Side-effect CSS imports count as runtime dependencies for
// Rollup's chunk-graph analysis.
import './antd-master.less';
import './app.less';
import './components/add-edit-form-steps.less';
import './components/badge.less';
import './components/code-mirror.less';
import './components/drawer.less';
import './components/entity-version-time-line.less';
import './components/glossary.less';
import './components/menu.less';
import './components/pagination.less';
import './components/profile-picture.less';
import './components/profiler.less';
import './components/radio.less';
import './components/react-awesome-query.less';
import './components/rechart.less';
import './components/resizable-panels-component.less';
import './components/rjsf.less';
import './components/select.less';
import './components/size.less';
import './components/slider.less';
import './components/step.less';
import './components/tags.less';
import './fonts.less';
import './knowledge-center.less';
import './modal.less';
import './tailwind.css';
import './temp.css';
import './tree.less';
