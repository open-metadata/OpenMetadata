package org.openmetadata.service.governance.workflows.system;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.FlowableListener;
import org.flowable.bpmn.model.IntermediateCatchEvent;
import org.flowable.bpmn.model.Message;
import org.flowable.bpmn.model.MessageEventDefinition;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.TimerEventDefinition;
import org.openmetadata.service.governance.workflows.WorkflowInstanceStageUpdaterListener;
import org.openmetadata.service.governance.workflows.system.impl.TriggerWorkflowImpl;

public class PeriodicTriggerWorkflow {
    private final BpmnModel model;
    private final String modelId = "SystemPeriodicTriggerWorkflow";

    public PeriodicTriggerWorkflow() {
        // Model
        BpmnModel model = new BpmnModel();

        // Process
        Process process = new Process();
        process.setId(modelId);
        process.setName(modelId);
        model.addProcess(process);

        // StartEvent
        Message message = new Message();
        message.setId("periodicTriggerWorkflow");
        message.setName("periodicTriggerWorkflow");
        model.addMessage(message);

        MessageEventDefinition messageEventDefinition = new MessageEventDefinition();
        messageEventDefinition.setMessageRef("periodicTriggerWorkflow");

        StartEvent startEvent = new StartEvent();
        startEvent.setId("startEvent");
        startEvent.addEventDefinition(messageEventDefinition);
        process.addFlowElement(startEvent);

        // Workflow Start Listener
        FlowableListener startListener = new FlowableListener();
        startListener.setEvent("start");
        startListener.setImplementationType("class");
        startListener.setImplementation(WorkflowInstanceStageUpdaterListener.class.getName());
        process.getExecutionListeners().add(startListener);

        // Intermediate Time Catch Event
        TimerEventDefinition timerEventDefinition = new TimerEventDefinition();
        timerEventDefinition.setTimeDuration("${timeToTrigger}");

        IntermediateCatchEvent timerEvent = new IntermediateCatchEvent();
        timerEvent.setId("waitEvent");
        timerEvent.addEventDefinition(timerEventDefinition);
        process.addFlowElement(timerEvent);

        // Trigger Workflow
        ServiceTask triggerWorkflow = new ServiceTask();
        triggerWorkflow.setId("triggerWorkflowTask");
        triggerWorkflow.setName("triggerWorkflowTask");
        triggerWorkflow.setImplementationType("class");
        triggerWorkflow.setImplementation(TriggerWorkflowImpl.class.getName());
        process.addFlowElement(triggerWorkflow);

        // End Event
        EndEvent endEvent = new EndEvent();
        endEvent.setId("endEvent");
        process.addFlowElement(endEvent);

        // Sequence Flow
        process.addFlowElement(new SequenceFlow("startEvent", "timerEvent"));
        process.addFlowElement(new SequenceFlow("timerEvent", "triggerWorkflow"));
        process.addFlowElement(new SequenceFlow("triggerWorkflow", "endEvent"));

        this.model = model;
    }
}
