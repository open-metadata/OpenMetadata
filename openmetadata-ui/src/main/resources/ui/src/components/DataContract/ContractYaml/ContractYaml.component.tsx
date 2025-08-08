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
import yaml from 'js-yaml';
import { useMemo } from 'react';
import { CSMode } from '../../../enums/codemirror.enum';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { getUpdatedContractDetails } from '../../../utils/DataContract/DataContractUtils';
import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';
import './contract-yaml.less';

const ContractYaml = ({ contract }: { contract: DataContract }) => {
  const schemaEditorValue = useMemo(() => {
    return yaml.dump(getUpdatedContractDetails(contract, contract));
  }, [contract]);

  return (
    <div className="contract-yaml-container">
      <SchemaEditor
        className="contract-yaml-schema-editor"
        editorClass="custom-entity-schema"
        mode={{ name: CSMode.YAML }}
        value={schemaEditorValue}
      />
    </div>
  );
};

export default ContractYaml;
