package org.openmetadata.schema.governance.workflows.elements;

import com.fasterxml.jackson.annotation.JsonIgnore;
import org.openmetadata.common.utils.CommonUtil;

import java.util.List;
import java.util.Map;

public interface WorkflowNodeDefinitionInterface {
    String getType();

    String getSubType();

    String getName();

    String getDisplayName();

    String getDescription();

    default Object getConfig() { return null; };

    default List<String> getInputs() { return null; };

    default List<String> getOutputs(){ return null; };

    void setType(String type);

    void setSubType(String subType);

    void setName(String name);

    void setDisplayName(String displayName);

    void setDescription(String description);

    default void setConfig(Map<String, Object> config) {
        /* no-op implementation to be overridden */
    }

    default void setInputs(List<String> inputs) {
        /* no-op implementation to be overridden */
    }

    default void setOutputs(List<String> outputs) {
        /* no-op implementation to be overridden */
    }

    @JsonIgnore
    default String getNodeDisplayName() {
        return CommonUtil.nullOrEmpty(getDisplayName()) ? getName() : getDisplayName();
    }
    @JsonIgnore
    default NodeType getNodeType() {
        return NodeType.fromValue(getType());
    }
    @JsonIgnore
    default NodeSubType getNodeSubType() {
        return NodeSubType.fromValue(getSubType());
    }
}
