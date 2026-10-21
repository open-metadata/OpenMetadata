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

/**
 * The FQN of a contract's asset. Contracts stored their asset reference as
 * sent, often only `{ id, type }`, so it is read from the contract's own FQN
 * when missing: the server builds that as `<asset FQN>.dataContract_<name>`.
 */
export const getContractAssetFqn = (
  contractFqn: string,
  contractName: string,
  assetFqn?: string
): string => {
  const suffix = `.dataContract_${contractName}`;

  return (
    assetFqn ||
    (contractFqn.endsWith(suffix) ? contractFqn.slice(0, -suffix.length) : '')
  );
};
