import { Form, Input, Modal, Select } from 'antd';
import { EditorContentRef } from 'Models';
import React, { useMemo, useRef } from 'react';
import RichTextEditor from '../../components/common/rich-text-editor/RichTextEditor';
import { TeamType } from '../../generated/entity/teams/team';

type AddTeamFormType = {
  visible: boolean;
  onCancel: () => void;
};

const AddTeamForm: React.FC<AddTeamFormType> = ({ visible, onCancel }) => {
  const markdownRef = useRef<EditorContentRef>();

  const teamTypeOptions = useMemo(() => {
    return Object.values(TeamType).map((type) => ({
      label: type,
      value: type,
    }));
  }, []);

  return (
    <Modal
      centered
      title="Add Team"
      visible={visible}
      width={650}
      onCancel={onCancel}>
      <Form initialValues={{ teamType: TeamType.Department }} layout="vertical">
        <Form.Item label="Name" name="name">
          <Input data-testid="name" placeholder="Enter name" />
        </Form.Item>
        <Form.Item label="Display Name" name="displayName">
          <Input data-testid="display-name" placeholder="Enter display name" />
        </Form.Item>
        <Form.Item label="Team type" name="teamType">
          <Select
            options={teamTypeOptions}
            placeholder="Please select a team type"
          />
        </Form.Item>
        <Form.Item label="Description">
          <RichTextEditor
            data-testid="description"
            initialValue=""
            ref={markdownRef}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddTeamForm;
