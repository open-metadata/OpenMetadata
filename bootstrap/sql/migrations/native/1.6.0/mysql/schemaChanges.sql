-- Create Workflow Definition Entity
CREATE TABLE IF NOT EXISTS workflow_definition_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    fqnHash VARCHAR(256) NOT NULL COLLATE ascii_bin,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted') NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (fqnHash),
    INDEX (name)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create Workflow Instance Time Series
  CREATE TABLE IF NOT EXISTS workflow_instance_time_series (
      id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
      workflowDefinitionId varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.workflowDefinitionId'))) STORED NOT NULL,
      json JSON NOT NULL,
      jsonSchema varchar(256) NOT NULL,
      timestamp bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.timestamp'))) STORED NOT NULL,
      startedAt bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.startedAt'))) STORED NOT NULL,
      endedAt bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.endedAt'))) STORED NULL,
      entityFQNHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
      CONSTRAINT workflow_instance_time_series_unique_constraint UNIQUE (id,entityFQNHash),
      PRIMARY KEY (id),
      INDEX (workflowDefinitionId)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Workflow Instance State Time Series
CREATE TABLE IF NOT EXISTS workflow_instance_state_time_series (
  id varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.id'))) STORED NOT NULL,
  workflowInstanceId varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.workflowInstanceId'))) STORED NOT NULL,
  workflowInstanceExecutionId varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.workflowInstanceExecutionId'))) STORED NOT NULL,
  workflowDefinitionId varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.workflowDefinitionId'))) STORED NOT NULL,
  stage varchar(256) GENERATED ALWAYS AS (json_unquote(json_Extract(json, '$.stage.name'))) STORED NOT NULL,
  stageStartedAt bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.stage.startedAt'))) STORED NOT NULL,
  stageEndedAt bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.stage.endedAt'))) STORED NULL,
  timestamp bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.timestamp'))) STORED NOT NULL,
  jsonSchema varchar(256) NOT NULL,
  json json NOT NULL,
  entityFQNHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  CONSTRAINT workflow_instance_state_time_series_unique_constraint UNIQUE (id,entityFQNHash),
  PRIMARY KEY (id),
  INDEX (workflowDefinitionId),
  INDEX (workflowInstanceId)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Flowable Related Tables
create table ACT_GE_PROPERTY (
    NAME_ varchar(64),
    VALUE_ varchar(300),
    REV_ integer,
    primary key (NAME_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_GE_BYTEARRAY (
    ID_ varchar(64),
    REV_ integer,
    NAME_ varchar(255),
    DEPLOYMENT_ID_ varchar(64),
    BYTES_ LONGBLOB,
    GENERATED_ TINYINT,
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

insert into ACT_GE_PROPERTY
values ('common.schema.version', '7.0.1.1', 1);

insert into ACT_GE_PROPERTY
values ('next.dbid', '1', 1);


create table ACT_RU_ENTITYLINK (
    ID_ varchar(64),
    REV_ integer,
    CREATE_TIME_ datetime(3),
    LINK_TYPE_ varchar(255),
    SCOPE_ID_ varchar(255),
    SUB_SCOPE_ID_ varchar(255),
    SCOPE_TYPE_ varchar(255),
    SCOPE_DEFINITION_ID_ varchar(255),
    PARENT_ELEMENT_ID_ varchar(255),
    REF_SCOPE_ID_ varchar(255),
    REF_SCOPE_TYPE_ varchar(255),
    REF_SCOPE_DEFINITION_ID_ varchar(255),
    ROOT_SCOPE_ID_ varchar(255),
    ROOT_SCOPE_TYPE_ varchar(255),
    HIERARCHY_TYPE_ varchar(255),
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create index ACT_IDX_ENT_LNK_SCOPE on ACT_RU_ENTITYLINK(SCOPE_ID_, SCOPE_TYPE_, LINK_TYPE_);
create index ACT_IDX_ENT_LNK_REF_SCOPE on ACT_RU_ENTITYLINK(REF_SCOPE_ID_, REF_SCOPE_TYPE_, LINK_TYPE_);
create index ACT_IDX_ENT_LNK_ROOT_SCOPE on ACT_RU_ENTITYLINK(ROOT_SCOPE_ID_, ROOT_SCOPE_TYPE_, LINK_TYPE_);
create index ACT_IDX_ENT_LNK_SCOPE_DEF on ACT_RU_ENTITYLINK(SCOPE_DEFINITION_ID_, SCOPE_TYPE_, LINK_TYPE_);

insert into ACT_GE_PROPERTY values ('entitylink.schema.version', '7.0.1.1', 1);

create table ACT_HI_ENTITYLINK (
    ID_ varchar(64),
    LINK_TYPE_ varchar(255),
    CREATE_TIME_ datetime(3),
    SCOPE_ID_ varchar(255),
    SUB_SCOPE_ID_ varchar(255),
    SCOPE_TYPE_ varchar(255),
    SCOPE_DEFINITION_ID_ varchar(255),
    PARENT_ELEMENT_ID_ varchar(255),
    REF_SCOPE_ID_ varchar(255),
    REF_SCOPE_TYPE_ varchar(255),
    REF_SCOPE_DEFINITION_ID_ varchar(255),
    ROOT_SCOPE_ID_ varchar(255),
    ROOT_SCOPE_TYPE_ varchar(255),
    HIERARCHY_TYPE_ varchar(255),
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create index ACT_IDX_HI_ENT_LNK_SCOPE on ACT_HI_ENTITYLINK(SCOPE_ID_, SCOPE_TYPE_, LINK_TYPE_);
create index ACT_IDX_HI_ENT_LNK_REF_SCOPE on ACT_HI_ENTITYLINK(REF_SCOPE_ID_, REF_SCOPE_TYPE_, LINK_TYPE_);
create index ACT_IDX_HI_ENT_LNK_ROOT_SCOPE on ACT_HI_ENTITYLINK(ROOT_SCOPE_ID_, ROOT_SCOPE_TYPE_, LINK_TYPE_);
create index ACT_IDX_HI_ENT_LNK_SCOPE_DEF on ACT_HI_ENTITYLINK(SCOPE_DEFINITION_ID_, SCOPE_TYPE_, LINK_TYPE_);


create table ACT_RU_IDENTITYLINK (
    ID_ varchar(64),
    REV_ integer,
    GROUP_ID_ varchar(255),
    TYPE_ varchar(255),
    USER_ID_ varchar(255),
    TASK_ID_ varchar(64),
    PROC_INST_ID_ varchar(64),
    PROC_DEF_ID_ varchar(64),
    SCOPE_ID_ varchar(255),
    SUB_SCOPE_ID_ varchar(255),
    SCOPE_TYPE_ varchar(255),
    SCOPE_DEFINITION_ID_ varchar(255),
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create index ACT_IDX_IDENT_LNK_USER on ACT_RU_IDENTITYLINK(USER_ID_);
create index ACT_IDX_IDENT_LNK_GROUP on ACT_RU_IDENTITYLINK(GROUP_ID_);
create index ACT_IDX_IDENT_LNK_SCOPE on ACT_RU_IDENTITYLINK(SCOPE_ID_, SCOPE_TYPE_);
create index ACT_IDX_IDENT_LNK_SUB_SCOPE on ACT_RU_IDENTITYLINK(SUB_SCOPE_ID_, SCOPE_TYPE_);
create index ACT_IDX_IDENT_LNK_SCOPE_DEF on ACT_RU_IDENTITYLINK(SCOPE_DEFINITION_ID_, SCOPE_TYPE_);

insert into ACT_GE_PROPERTY values ('identitylink.schema.version', '7.0.1.1', 1);

create table ACT_HI_IDENTITYLINK (
    ID_ varchar(64),
    GROUP_ID_ varchar(255),
    TYPE_ varchar(255),
    USER_ID_ varchar(255),
    TASK_ID_ varchar(64),
    CREATE_TIME_ datetime(3),
    PROC_INST_ID_ varchar(64),
    SCOPE_ID_ varchar(255),
    SUB_SCOPE_ID_ varchar(255),
    SCOPE_TYPE_ varchar(255),
    SCOPE_DEFINITION_ID_ varchar(255),
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create index ACT_IDX_HI_IDENT_LNK_USER on ACT_HI_IDENTITYLINK(USER_ID_);
create index ACT_IDX_HI_IDENT_LNK_SCOPE on ACT_HI_IDENTITYLINK(SCOPE_ID_, SCOPE_TYPE_);
create index ACT_IDX_HI_IDENT_LNK_SUB_SCOPE on ACT_HI_IDENTITYLINK(SUB_SCOPE_ID_, SCOPE_TYPE_);
create index ACT_IDX_HI_IDENT_LNK_SCOPE_DEF on ACT_HI_IDENTITYLINK(SCOPE_DEFINITION_ID_, SCOPE_TYPE_);


create table ACT_RU_JOB (
    ID_ varchar(64) NOT NULL,
    REV_ integer,
    CATEGORY_ varchar(255),
    TYPE_ varchar(255) NOT NULL,
    LOCK_EXP_TIME_ timestamp(3) NULL,
    LOCK_OWNER_ varchar(255),
    EXCLUSIVE_ boolean,
    EXECUTION_ID_ varchar(64),
    PROCESS_INSTANCE_ID_ varchar(64),
    PROC_DEF_ID_ varchar(64),
    ELEMENT_ID_ varchar(255),
    ELEMENT_NAME_ varchar(255),
    SCOPE_ID_ varchar(255),
    SUB_SCOPE_ID_ varchar(255),
    SCOPE_TYPE_ varchar(255),
    SCOPE_DEFINITION_ID_ varchar(255),
    CORRELATION_ID_ varchar(255),
    RETRIES_ integer,
    EXCEPTION_STACK_ID_ varchar(64),
    EXCEPTION_MSG_ varchar(4000),
    DUEDATE_ timestamp(3) NULL,
    REPEAT_ varchar(255),
    HANDLER_TYPE_ varchar(255),
    HANDLER_CFG_ varchar(4000),
    CUSTOM_VALUES_ID_ varchar(64),
    CREATE_TIME_ timestamp(3) NULL,
    TENANT_ID_ varchar(255) default '',
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_RU_TIMER_JOB (
    ID_ varchar(64) NOT NULL,
    REV_ integer,
    CATEGORY_ varchar(255),
    TYPE_ varchar(255) NOT NULL,
    LOCK_EXP_TIME_ timestamp(3) NULL,
    LOCK_OWNER_ varchar(255),
    EXCLUSIVE_ boolean,
    EXECUTION_ID_ varchar(64),
    PROCESS_INSTANCE_ID_ varchar(64),
    PROC_DEF_ID_ varchar(64),
    ELEMENT_ID_ varchar(255),
    ELEMENT_NAME_ varchar(255),
    SCOPE_ID_ varchar(255),
    SUB_SCOPE_ID_ varchar(255),
    SCOPE_TYPE_ varchar(255),
    SCOPE_DEFINITION_ID_ varchar(255),
    CORRELATION_ID_ varchar(255),
    RETRIES_ integer,
    EXCEPTION_STACK_ID_ varchar(64),
    EXCEPTION_MSG_ varchar(4000),
    DUEDATE_ timestamp(3) NULL,
    REPEAT_ varchar(255),
    HANDLER_TYPE_ varchar(255),
    HANDLER_CFG_ varchar(4000),
    CUSTOM_VALUES_ID_ varchar(64),
    CREATE_TIME_ timestamp(3) NULL,
    TENANT_ID_ varchar(255) default '',
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_RU_SUSPENDED_JOB (
    ID_ varchar(64) NOT NULL,
    REV_ integer,
    CATEGORY_ varchar(255),
    TYPE_ varchar(255) NOT NULL,
    EXCLUSIVE_ boolean,
    EXECUTION_ID_ varchar(64),
    PROCESS_INSTANCE_ID_ varchar(64),
    PROC_DEF_ID_ varchar(64),
    ELEMENT_ID_ varchar(255),
    ELEMENT_NAME_ varchar(255),
    SCOPE_ID_ varchar(255),
    SUB_SCOPE_ID_ varchar(255),
    SCOPE_TYPE_ varchar(255),
    SCOPE_DEFINITION_ID_ varchar(255),
    CORRELATION_ID_ varchar(255),
    RETRIES_ integer,
    EXCEPTION_STACK_ID_ varchar(64),
    EXCEPTION_MSG_ varchar(4000),
    DUEDATE_ timestamp(3) NULL,
    REPEAT_ varchar(255),
    HANDLER_TYPE_ varchar(255),
    HANDLER_CFG_ varchar(4000),
    CUSTOM_VALUES_ID_ varchar(64),
    CREATE_TIME_ timestamp(3) NULL,
    TENANT_ID_ varchar(255) default '',
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_RU_DEADLETTER_JOB (
    ID_ varchar(64) NOT NULL,
    REV_ integer,
    CATEGORY_ varchar(255),
    TYPE_ varchar(255) NOT NULL,
    EXCLUSIVE_ boolean,
    EXECUTION_ID_ varchar(64),
    PROCESS_INSTANCE_ID_ varchar(64),
    PROC_DEF_ID_ varchar(64),
    ELEMENT_ID_ varchar(255),
    ELEMENT_NAME_ varchar(255),
    SCOPE_ID_ varchar(255),
    SUB_SCOPE_ID_ varchar(255),
    SCOPE_TYPE_ varchar(255),
    SCOPE_DEFINITION_ID_ varchar(255),
    CORRELATION_ID_ varchar(255),
    EXCEPTION_STACK_ID_ varchar(64),
    EXCEPTION_MSG_ varchar(4000),
    DUEDATE_ timestamp(3) NULL,
    REPEAT_ varchar(255),
    HANDLER_TYPE_ varchar(255),
    HANDLER_CFG_ varchar(4000),
    CUSTOM_VALUES_ID_ varchar(64),
    CREATE_TIME_ timestamp(3) NULL,
    TENANT_ID_ varchar(255) default '',
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_RU_HISTORY_JOB (
    ID_ varchar(64) NOT NULL,
    REV_ integer,
    LOCK_EXP_TIME_ timestamp(3) NULL,
    LOCK_OWNER_ varchar(255),
    RETRIES_ integer,
    EXCEPTION_STACK_ID_ varchar(64),
    EXCEPTION_MSG_ varchar(4000),
    HANDLER_TYPE_ varchar(255),
    HANDLER_CFG_ varchar(4000),
    CUSTOM_VALUES_ID_ varchar(64),
    ADV_HANDLER_CFG_ID_ varchar(64),
    CREATE_TIME_ timestamp(3) NULL,
    SCOPE_TYPE_ varchar(255),
    TENANT_ID_ varchar(255) default '',
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_RU_EXTERNAL_JOB (
    ID_ varchar(64) NOT NULL,
    REV_ integer,
    CATEGORY_ varchar(255),
    TYPE_ varchar(255) NOT NULL,
    LOCK_EXP_TIME_ timestamp(3) NULL,
    LOCK_OWNER_ varchar(255),
    EXCLUSIVE_ boolean,
    EXECUTION_ID_ varchar(64),
    PROCESS_INSTANCE_ID_ varchar(64),
    PROC_DEF_ID_ varchar(64),
    ELEMENT_ID_ varchar(255),
    ELEMENT_NAME_ varchar(255),
    SCOPE_ID_ varchar(255),
    SUB_SCOPE_ID_ varchar(255),
    SCOPE_TYPE_ varchar(255),
    SCOPE_DEFINITION_ID_ varchar(255),
    CORRELATION_ID_ varchar(255),
    RETRIES_ integer,
    EXCEPTION_STACK_ID_ varchar(64),
    EXCEPTION_MSG_ varchar(4000),
    DUEDATE_ timestamp(3) NULL,
    REPEAT_ varchar(255),
    HANDLER_TYPE_ varchar(255),
    HANDLER_CFG_ varchar(4000),
    CUSTOM_VALUES_ID_ varchar(64),
    CREATE_TIME_ timestamp(3) NULL,
    TENANT_ID_ varchar(255) default '',
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create index ACT_IDX_JOB_EXCEPTION_STACK_ID on ACT_RU_JOB(EXCEPTION_STACK_ID_);
create index ACT_IDX_JOB_CUSTOM_VALUES_ID on ACT_RU_JOB(CUSTOM_VALUES_ID_);
create index ACT_IDX_JOB_CORRELATION_ID on ACT_RU_JOB(CORRELATION_ID_);

create index ACT_IDX_TIMER_JOB_EXCEPTION_STACK_ID on ACT_RU_TIMER_JOB(EXCEPTION_STACK_ID_);
create index ACT_IDX_TIMER_JOB_CUSTOM_VALUES_ID on ACT_RU_TIMER_JOB(CUSTOM_VALUES_ID_);
create index ACT_IDX_TIMER_JOB_CORRELATION_ID on ACT_RU_TIMER_JOB(CORRELATION_ID_);
create index ACT_IDX_TIMER_JOB_DUEDATE on ACT_RU_TIMER_JOB(DUEDATE_);

create index ACT_IDX_SUSPENDED_JOB_EXCEPTION_STACK_ID on ACT_RU_SUSPENDED_JOB(EXCEPTION_STACK_ID_);
create index ACT_IDX_SUSPENDED_JOB_CUSTOM_VALUES_ID on ACT_RU_SUSPENDED_JOB(CUSTOM_VALUES_ID_);
create index ACT_IDX_SUSPENDED_JOB_CORRELATION_ID on ACT_RU_SUSPENDED_JOB(CORRELATION_ID_);

create index ACT_IDX_DEADLETTER_JOB_EXCEPTION_STACK_ID on ACT_RU_DEADLETTER_JOB(EXCEPTION_STACK_ID_);
create index ACT_IDX_DEADLETTER_JOB_CUSTOM_VALUES_ID on ACT_RU_DEADLETTER_JOB(CUSTOM_VALUES_ID_);
create index ACT_IDX_DEADLETTER_JOB_CORRELATION_ID on ACT_RU_DEADLETTER_JOB(CORRELATION_ID_);

create index ACT_IDX_EXTERNAL_JOB_EXCEPTION_STACK_ID on ACT_RU_EXTERNAL_JOB(EXCEPTION_STACK_ID_);
create index ACT_IDX_EXTERNAL_JOB_CUSTOM_VALUES_ID on ACT_RU_EXTERNAL_JOB(CUSTOM_VALUES_ID_);
create index ACT_IDX_EXTERNAL_JOB_CORRELATION_ID on ACT_RU_EXTERNAL_JOB(CORRELATION_ID_);

alter table ACT_RU_JOB
    add constraint ACT_FK_JOB_EXCEPTION
    foreign key (EXCEPTION_STACK_ID_)
    references ACT_GE_BYTEARRAY (ID_);

alter table ACT_RU_JOB
    add constraint ACT_FK_JOB_CUSTOM_VALUES
    foreign key (CUSTOM_VALUES_ID_)
    references ACT_GE_BYTEARRAY (ID_);

alter table ACT_RU_TIMER_JOB
    add constraint ACT_FK_TIMER_JOB_EXCEPTION
    foreign key (EXCEPTION_STACK_ID_)
    references ACT_GE_BYTEARRAY (ID_);

alter table ACT_RU_TIMER_JOB
    add constraint ACT_FK_TIMER_JOB_CUSTOM_VALUES
    foreign key (CUSTOM_VALUES_ID_)
    references ACT_GE_BYTEARRAY (ID_);

alter table ACT_RU_SUSPENDED_JOB
    add constraint ACT_FK_SUSPENDED_JOB_EXCEPTION
    foreign key (EXCEPTION_STACK_ID_)
    references ACT_GE_BYTEARRAY (ID_);

alter table ACT_RU_SUSPENDED_JOB
    add constraint ACT_FK_SUSPENDED_JOB_CUSTOM_VALUES
    foreign key (CUSTOM_VALUES_ID_)
    references ACT_GE_BYTEARRAY (ID_);

alter table ACT_RU_DEADLETTER_JOB
    add constraint ACT_FK_DEADLETTER_JOB_EXCEPTION
    foreign key (EXCEPTION_STACK_ID_)
    references ACT_GE_BYTEARRAY (ID_);

alter table ACT_RU_DEADLETTER_JOB
    add constraint ACT_FK_DEADLETTER_JOB_CUSTOM_VALUES
    foreign key (CUSTOM_VALUES_ID_)
    references ACT_GE_BYTEARRAY (ID_);

alter table ACT_RU_EXTERNAL_JOB
    add constraint ACT_FK_EXTERNAL_JOB_EXCEPTION
    foreign key (EXCEPTION_STACK_ID_)
    references ACT_GE_BYTEARRAY (ID_);

alter table ACT_RU_EXTERNAL_JOB
    add constraint ACT_FK_EXTERNAL_JOB_CUSTOM_VALUES
    foreign key (CUSTOM_VALUES_ID_)
    references ACT_GE_BYTEARRAY (ID_);

create index ACT_IDX_JOB_SCOPE on ACT_RU_JOB(SCOPE_ID_, SCOPE_TYPE_);
create index ACT_IDX_JOB_SUB_SCOPE on ACT_RU_JOB(SUB_SCOPE_ID_, SCOPE_TYPE_);
create index ACT_IDX_JOB_SCOPE_DEF on ACT_RU_JOB(SCOPE_DEFINITION_ID_, SCOPE_TYPE_);

create index ACT_IDX_TJOB_SCOPE on ACT_RU_TIMER_JOB(SCOPE_ID_, SCOPE_TYPE_);
create index ACT_IDX_TJOB_SUB_SCOPE on ACT_RU_TIMER_JOB(SUB_SCOPE_ID_, SCOPE_TYPE_);
create index ACT_IDX_TJOB_SCOPE_DEF on ACT_RU_TIMER_JOB(SCOPE_DEFINITION_ID_, SCOPE_TYPE_);

create index ACT_IDX_SJOB_SCOPE on ACT_RU_SUSPENDED_JOB(SCOPE_ID_, SCOPE_TYPE_);
create index ACT_IDX_SJOB_SUB_SCOPE on ACT_RU_SUSPENDED_JOB(SUB_SCOPE_ID_, SCOPE_TYPE_);
create index ACT_IDX_SJOB_SCOPE_DEF on ACT_RU_SUSPENDED_JOB(SCOPE_DEFINITION_ID_, SCOPE_TYPE_);

create index ACT_IDX_DJOB_SCOPE on ACT_RU_DEADLETTER_JOB(SCOPE_ID_, SCOPE_TYPE_);
create index ACT_IDX_DJOB_SUB_SCOPE on ACT_RU_DEADLETTER_JOB(SUB_SCOPE_ID_, SCOPE_TYPE_);
create index ACT_IDX_DJOB_SCOPE_DEF on ACT_RU_DEADLETTER_JOB(SCOPE_DEFINITION_ID_, SCOPE_TYPE_);

create index ACT_IDX_EJOB_SCOPE on ACT_RU_EXTERNAL_JOB(SCOPE_ID_, SCOPE_TYPE_);
create index ACT_IDX_EJOB_SUB_SCOPE on ACT_RU_EXTERNAL_JOB(SUB_SCOPE_ID_, SCOPE_TYPE_);
create index ACT_IDX_EJOB_SCOPE_DEF on ACT_RU_EXTERNAL_JOB(SCOPE_DEFINITION_ID_, SCOPE_TYPE_);

insert into ACT_GE_PROPERTY values ('job.schema.version', '7.0.1.1', 1);

create table FLW_RU_BATCH (
    ID_ varchar(64) not null,
    REV_ integer,
    TYPE_ varchar(64) not null,
    SEARCH_KEY_ varchar(255),
    SEARCH_KEY2_ varchar(255),
    CREATE_TIME_ datetime(3) not null,
    COMPLETE_TIME_ datetime(3),
    STATUS_ varchar(255),
    BATCH_DOC_ID_ varchar(64),
    TENANT_ID_ varchar(255) default '',
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table FLW_RU_BATCH_PART (
    ID_ varchar(64) not null,
    REV_ integer,
    BATCH_ID_ varchar(64),
    TYPE_ varchar(64) not null,
    SCOPE_ID_ varchar(64),
    SUB_SCOPE_ID_ varchar(64),
    SCOPE_TYPE_ varchar(64),
    SEARCH_KEY_ varchar(255),
    SEARCH_KEY2_ varchar(255),
    CREATE_TIME_ datetime(3) not null,
    COMPLETE_TIME_ datetime(3),
    STATUS_ varchar(255),
    RESULT_DOC_ID_ varchar(64),
    TENANT_ID_ varchar(255) default '',
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create index FLW_IDX_BATCH_PART on FLW_RU_BATCH_PART(BATCH_ID_);

alter table FLW_RU_BATCH_PART
    add constraint FLW_FK_BATCH_PART_PARENT
    foreign key (BATCH_ID_)
    references FLW_RU_BATCH (ID_);

insert into ACT_GE_PROPERTY values ('batch.schema.version', '7.0.1.1', 1);


create table ACT_RU_TASK (
    ID_ varchar(64),
    REV_ integer,
    EXECUTION_ID_ varchar(64),
    PROC_INST_ID_ varchar(64),
    PROC_DEF_ID_ varchar(64),
    TASK_DEF_ID_ varchar(64),
    SCOPE_ID_ varchar(255),
    SUB_SCOPE_ID_ varchar(255),
    SCOPE_TYPE_ varchar(255),
    SCOPE_DEFINITION_ID_ varchar(255),
    PROPAGATED_STAGE_INST_ID_ varchar(255),
    NAME_ varchar(255),
    PARENT_TASK_ID_ varchar(64),
    DESCRIPTION_ varchar(4000),
    TASK_DEF_KEY_ varchar(255),
    OWNER_ varchar(255),
    ASSIGNEE_ varchar(255),
    DELEGATION_ varchar(64),
    PRIORITY_ integer,
    CREATE_TIME_ timestamp(3) NULL,
    DUE_DATE_ datetime(3),
    CATEGORY_ varchar(255),
    SUSPENSION_STATE_ integer,
    TENANT_ID_ varchar(255) default '',
    FORM_KEY_ varchar(255),
    CLAIM_TIME_ datetime(3),
    IS_COUNT_ENABLED_ TINYINT,
    VAR_COUNT_ integer,
    ID_LINK_COUNT_ integer,
    SUB_TASK_COUNT_ integer,
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create index ACT_IDX_TASK_CREATE on ACT_RU_TASK(CREATE_TIME_);
create index ACT_IDX_TASK_SCOPE on ACT_RU_TASK(SCOPE_ID_, SCOPE_TYPE_);
create index ACT_IDX_TASK_SUB_SCOPE on ACT_RU_TASK(SUB_SCOPE_ID_, SCOPE_TYPE_);
create index ACT_IDX_TASK_SCOPE_DEF on ACT_RU_TASK(SCOPE_DEFINITION_ID_, SCOPE_TYPE_);

insert into ACT_GE_PROPERTY values ('task.schema.version', '7.0.1.1', 1);

create table ACT_HI_TASKINST (
    ID_ varchar(64) not null,
    REV_ integer default 1,
    PROC_DEF_ID_ varchar(64),
    TASK_DEF_ID_ varchar(64),
    TASK_DEF_KEY_ varchar(255),
    PROC_INST_ID_ varchar(64),
    EXECUTION_ID_ varchar(64),
    SCOPE_ID_ varchar(255),
    SUB_SCOPE_ID_ varchar(255),
    SCOPE_TYPE_ varchar(255),
    SCOPE_DEFINITION_ID_ varchar(255),
    PROPAGATED_STAGE_INST_ID_ varchar(255),
    NAME_ varchar(255),
    PARENT_TASK_ID_ varchar(64),
    DESCRIPTION_ varchar(4000),
    OWNER_ varchar(255),
    ASSIGNEE_ varchar(255),
    START_TIME_ datetime(3) not null,
    CLAIM_TIME_ datetime(3),
    END_TIME_ datetime(3),
    DURATION_ bigint,
    DELETE_REASON_ varchar(4000),
    PRIORITY_ integer,
    DUE_DATE_ datetime(3),
    FORM_KEY_ varchar(255),
    CATEGORY_ varchar(255),
    TENANT_ID_ varchar(255) default '',
    LAST_UPDATED_TIME_ datetime(3),
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_HI_TSK_LOG (
    ID_ bigint auto_increment,
    TYPE_ varchar(64),
    TASK_ID_ varchar(64) not null,
    TIME_STAMP_ timestamp(3) not null,
    USER_ID_ varchar(255),
    DATA_ varchar(4000),
    EXECUTION_ID_ varchar(64),
    PROC_INST_ID_ varchar(64),
    PROC_DEF_ID_ varchar(64),
    SCOPE_ID_ varchar(255),
    SCOPE_DEFINITION_ID_ varchar(255),
    SUB_SCOPE_ID_ varchar(255),
    SCOPE_TYPE_ varchar(255),
    TENANT_ID_ varchar(255) default '',
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create index ACT_IDX_HI_TASK_SCOPE on ACT_HI_TASKINST(SCOPE_ID_, SCOPE_TYPE_);
create index ACT_IDX_HI_TASK_SUB_SCOPE on ACT_HI_TASKINST(SUB_SCOPE_ID_, SCOPE_TYPE_);
create index ACT_IDX_HI_TASK_SCOPE_DEF on ACT_HI_TASKINST(SCOPE_DEFINITION_ID_, SCOPE_TYPE_);


create table ACT_RU_VARIABLE (
    ID_ varchar(64) not null,
    REV_ integer,
    TYPE_ varchar(255) not null,
    NAME_ varchar(255) not null,
    EXECUTION_ID_ varchar(64),
    PROC_INST_ID_ varchar(64),
    TASK_ID_ varchar(64),
    SCOPE_ID_ varchar(255),
    SUB_SCOPE_ID_ varchar(255),
    SCOPE_TYPE_ varchar(255),
    BYTEARRAY_ID_ varchar(64),
    DOUBLE_ double,
    LONG_ bigint,
    TEXT_ varchar(4000),
    TEXT2_ varchar(4000),
    META_INFO_ varchar(4000),
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create index ACT_IDX_RU_VAR_SCOPE_ID_TYPE on ACT_RU_VARIABLE(SCOPE_ID_, SCOPE_TYPE_);
create index ACT_IDX_RU_VAR_SUB_ID_TYPE on ACT_RU_VARIABLE(SUB_SCOPE_ID_, SCOPE_TYPE_);

alter table ACT_RU_VARIABLE
    add constraint ACT_FK_VAR_BYTEARRAY
    foreign key (BYTEARRAY_ID_)
    references ACT_GE_BYTEARRAY (ID_);

insert into ACT_GE_PROPERTY values ('variable.schema.version', '7.0.1.1', 1);

create table ACT_HI_VARINST (
    ID_ varchar(64) not null,
    REV_ integer default 1,
    PROC_INST_ID_ varchar(64),
    EXECUTION_ID_ varchar(64),
    TASK_ID_ varchar(64),
    NAME_ varchar(255) not null,
    VAR_TYPE_ varchar(100),
    SCOPE_ID_ varchar(255),
    SUB_SCOPE_ID_ varchar(255),
    SCOPE_TYPE_ varchar(255),
    BYTEARRAY_ID_ varchar(64),
    DOUBLE_ double,
    LONG_ bigint,
    TEXT_ varchar(4000),
    TEXT2_ varchar(4000),
    CREATE_TIME_ datetime(3),
    LAST_UPDATED_TIME_ datetime(3),
    META_INFO_ varchar(4000),
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create index ACT_IDX_HI_PROCVAR_NAME_TYPE on ACT_HI_VARINST(NAME_, VAR_TYPE_);
create index ACT_IDX_HI_VAR_SCOPE_ID_TYPE on ACT_HI_VARINST(SCOPE_ID_, SCOPE_TYPE_);
create index ACT_IDX_HI_VAR_SUB_ID_TYPE on ACT_HI_VARINST(SUB_SCOPE_ID_, SCOPE_TYPE_);


create table ACT_RU_EVENT_SUBSCR (
    ID_ varchar(64) not null,
    REV_ integer,
    EVENT_TYPE_ varchar(255) not null,
    EVENT_NAME_ varchar(255),
    EXECUTION_ID_ varchar(64),
    PROC_INST_ID_ varchar(64),
    ACTIVITY_ID_ varchar(64),
    CONFIGURATION_ varchar(255),
    CREATED_ timestamp(3) not null DEFAULT CURRENT_TIMESTAMP(3),
    PROC_DEF_ID_ varchar(64),
    SUB_SCOPE_ID_ varchar(64),
    SCOPE_ID_ varchar(64),
    SCOPE_DEFINITION_ID_ varchar(64),
    SCOPE_TYPE_ varchar(64),
    LOCK_TIME_ timestamp(3) NULL,
    LOCK_OWNER_ varchar(255),
    TENANT_ID_ varchar(255) default '',
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create index ACT_IDX_EVENT_SUBSCR_CONFIG_ on ACT_RU_EVENT_SUBSCR(CONFIGURATION_);
create index ACT_IDX_EVENT_SUBSCR_SCOPEREF_ on ACT_RU_EVENT_SUBSCR(SCOPE_ID_, SCOPE_TYPE_);

insert into ACT_GE_PROPERTY values ('eventsubscription.schema.version', '7.0.1.1', 1);
create table ACT_RE_DEPLOYMENT (
    ID_ varchar(64),
    NAME_ varchar(255),
    CATEGORY_ varchar(255),
    KEY_ varchar(255),
    TENANT_ID_ varchar(255) default '',
    DEPLOY_TIME_ timestamp(3) NULL,
    DERIVED_FROM_ varchar(64),
    DERIVED_FROM_ROOT_ varchar(64),
    PARENT_DEPLOYMENT_ID_ varchar(255),
    ENGINE_VERSION_ varchar(255),
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_RE_MODEL (
    ID_ varchar(64) not null,
    REV_ integer,
    NAME_ varchar(255),
    KEY_ varchar(255),
    CATEGORY_ varchar(255),
    CREATE_TIME_ timestamp(3) null,
    LAST_UPDATE_TIME_ timestamp(3) null,
    VERSION_ integer,
    META_INFO_ varchar(4000),
    DEPLOYMENT_ID_ varchar(64),
    EDITOR_SOURCE_VALUE_ID_ varchar(64),
    EDITOR_SOURCE_EXTRA_VALUE_ID_ varchar(64),
    TENANT_ID_ varchar(255) default '',
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_RU_EXECUTION (
    ID_ varchar(64),
    REV_ integer,
    PROC_INST_ID_ varchar(64),
    BUSINESS_KEY_ varchar(255),
    PARENT_ID_ varchar(64),
    PROC_DEF_ID_ varchar(64),
    SUPER_EXEC_ varchar(64),
    ROOT_PROC_INST_ID_ varchar(64),
    ACT_ID_ varchar(255),
    IS_ACTIVE_ TINYINT,
    IS_CONCURRENT_ TINYINT,
    IS_SCOPE_ TINYINT,
    IS_EVENT_SCOPE_ TINYINT,
    IS_MI_ROOT_ TINYINT,
    SUSPENSION_STATE_ integer,
    CACHED_ENT_STATE_ integer,
    TENANT_ID_ varchar(255) default '',
    NAME_ varchar(255),
    START_ACT_ID_ varchar(255),
    START_TIME_ datetime(3),
    START_USER_ID_ varchar(255),
    LOCK_TIME_ timestamp(3) NULL,
    LOCK_OWNER_ varchar(255),
    IS_COUNT_ENABLED_ TINYINT,
    EVT_SUBSCR_COUNT_ integer,
    TASK_COUNT_ integer,
    JOB_COUNT_ integer,
    TIMER_JOB_COUNT_ integer,
    SUSP_JOB_COUNT_ integer,
    DEADLETTER_JOB_COUNT_ integer,
    EXTERNAL_WORKER_JOB_COUNT_ integer,
    VAR_COUNT_ integer,
    ID_LINK_COUNT_ integer,
    CALLBACK_ID_ varchar(255),
    CALLBACK_TYPE_ varchar(255),
    REFERENCE_ID_ varchar(255),
    REFERENCE_TYPE_ varchar(255),
    PROPAGATED_STAGE_INST_ID_ varchar(255),
    BUSINESS_STATUS_ varchar(255),
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_RE_PROCDEF (
    ID_ varchar(64) not null,
    REV_ integer,
    CATEGORY_ varchar(255),
    NAME_ varchar(255),
    KEY_ varchar(255) not null,
    VERSION_ integer not null,
    DEPLOYMENT_ID_ varchar(64),
    RESOURCE_NAME_ varchar(4000),
    DGRM_RESOURCE_NAME_ varchar(4000),
    DESCRIPTION_ varchar(4000),
    HAS_START_FORM_KEY_ TINYINT,
    HAS_GRAPHICAL_NOTATION_ TINYINT,
    SUSPENSION_STATE_ integer,
    TENANT_ID_ varchar(255) default '',
    ENGINE_VERSION_ varchar(255),
    DERIVED_FROM_ varchar(64),
    DERIVED_FROM_ROOT_ varchar(64),
    DERIVED_VERSION_ integer not null default 0,
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_EVT_LOG (
    LOG_NR_ bigint auto_increment,
    TYPE_ varchar(64),
    PROC_DEF_ID_ varchar(64),
    PROC_INST_ID_ varchar(64),
    EXECUTION_ID_ varchar(64),
    TASK_ID_ varchar(64),
    TIME_STAMP_ timestamp(3) not null DEFAULT CURRENT_TIMESTAMP(3),
    USER_ID_ varchar(255),
    DATA_ LONGBLOB,
    LOCK_OWNER_ varchar(255),
    LOCK_TIME_ timestamp(3) null,
    IS_PROCESSED_ tinyint default 0,
    primary key (LOG_NR_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_PROCDEF_INFO (
	ID_ varchar(64) not null,
    PROC_DEF_ID_ varchar(64) not null,
    REV_ integer,
    INFO_JSON_ID_ varchar(64),
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_RU_ACTINST (
    ID_ varchar(64) not null,
    REV_ integer default 1,
    PROC_DEF_ID_ varchar(64) not null,
    PROC_INST_ID_ varchar(64) not null,
    EXECUTION_ID_ varchar(64) not null,
    ACT_ID_ varchar(255) not null,
    TASK_ID_ varchar(64),
    CALL_PROC_INST_ID_ varchar(64),
    ACT_NAME_ varchar(255),
    ACT_TYPE_ varchar(255) not null,
    ASSIGNEE_ varchar(255),
    START_TIME_ datetime(3) not null,
    END_TIME_ datetime(3),
    DURATION_ bigint,
    TRANSACTION_ORDER_ integer,
    DELETE_REASON_ varchar(4000),
    TENANT_ID_ varchar(255) default '',
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create index ACT_IDX_EXEC_BUSKEY on ACT_RU_EXECUTION(BUSINESS_KEY_);
create index ACT_IDC_EXEC_ROOT on ACT_RU_EXECUTION(ROOT_PROC_INST_ID_);
create index ACT_IDX_EXEC_REF_ID_ on ACT_RU_EXECUTION(REFERENCE_ID_);
create index ACT_IDX_VARIABLE_TASK_ID on ACT_RU_VARIABLE(TASK_ID_);
create index ACT_IDX_ATHRZ_PROCEDEF on ACT_RU_IDENTITYLINK(PROC_DEF_ID_);
create index ACT_IDX_INFO_PROCDEF on ACT_PROCDEF_INFO(PROC_DEF_ID_);

create index ACT_IDX_RU_ACTI_START on ACT_RU_ACTINST(START_TIME_);
create index ACT_IDX_RU_ACTI_END on ACT_RU_ACTINST(END_TIME_);
create index ACT_IDX_RU_ACTI_PROC on ACT_RU_ACTINST(PROC_INST_ID_);
create index ACT_IDX_RU_ACTI_PROC_ACT on ACT_RU_ACTINST(PROC_INST_ID_, ACT_ID_);
create index ACT_IDX_RU_ACTI_EXEC on ACT_RU_ACTINST(EXECUTION_ID_);
create index ACT_IDX_RU_ACTI_EXEC_ACT on ACT_RU_ACTINST(EXECUTION_ID_, ACT_ID_);
create index ACT_IDX_RU_ACTI_TASK on ACT_RU_ACTINST(TASK_ID_);

alter table ACT_GE_BYTEARRAY
    add constraint ACT_FK_BYTEARR_DEPL
    foreign key (DEPLOYMENT_ID_)
    references ACT_RE_DEPLOYMENT (ID_);

alter table ACT_RE_PROCDEF
    add constraint ACT_UNIQ_PROCDEF
    unique (KEY_,VERSION_, DERIVED_VERSION_, TENANT_ID_);

alter table ACT_RU_EXECUTION
    add constraint ACT_FK_EXE_PROCINST
    foreign key (PROC_INST_ID_)
    references ACT_RU_EXECUTION (ID_) on delete cascade on update cascade;

alter table ACT_RU_EXECUTION
    add constraint ACT_FK_EXE_PARENT
    foreign key (PARENT_ID_)
    references ACT_RU_EXECUTION (ID_) on delete cascade;

alter table ACT_RU_EXECUTION
    add constraint ACT_FK_EXE_SUPER
    foreign key (SUPER_EXEC_)
    references ACT_RU_EXECUTION (ID_) on delete cascade;

alter table ACT_RU_EXECUTION
    add constraint ACT_FK_EXE_PROCDEF
    foreign key (PROC_DEF_ID_)
    references ACT_RE_PROCDEF (ID_);

alter table ACT_RU_IDENTITYLINK
    add constraint ACT_FK_TSKASS_TASK
    foreign key (TASK_ID_)
    references ACT_RU_TASK (ID_);

alter table ACT_RU_IDENTITYLINK
    add constraint ACT_FK_ATHRZ_PROCEDEF
    foreign key (PROC_DEF_ID_)
    references ACT_RE_PROCDEF(ID_);

alter table ACT_RU_IDENTITYLINK
    add constraint ACT_FK_IDL_PROCINST
    foreign key (PROC_INST_ID_)
    references ACT_RU_EXECUTION (ID_);

alter table ACT_RU_TASK
    add constraint ACT_FK_TASK_EXE
    foreign key (EXECUTION_ID_)
    references ACT_RU_EXECUTION (ID_);

alter table ACT_RU_TASK
    add constraint ACT_FK_TASK_PROCINST
    foreign key (PROC_INST_ID_)
    references ACT_RU_EXECUTION (ID_);

alter table ACT_RU_TASK
  	add constraint ACT_FK_TASK_PROCDEF
  	foreign key (PROC_DEF_ID_)
  	references ACT_RE_PROCDEF (ID_);

alter table ACT_RU_VARIABLE
    add constraint ACT_FK_VAR_EXE
    foreign key (EXECUTION_ID_)
    references ACT_RU_EXECUTION (ID_);

alter table ACT_RU_VARIABLE
    add constraint ACT_FK_VAR_PROCINST
    foreign key (PROC_INST_ID_)
    references ACT_RU_EXECUTION(ID_);

alter table ACT_RU_JOB
    add constraint ACT_FK_JOB_EXECUTION
    foreign key (EXECUTION_ID_)
    references ACT_RU_EXECUTION (ID_);

alter table ACT_RU_JOB
    add constraint ACT_FK_JOB_PROCESS_INSTANCE
    foreign key (PROCESS_INSTANCE_ID_)
    references ACT_RU_EXECUTION (ID_);

alter table ACT_RU_JOB
    add constraint ACT_FK_JOB_PROC_DEF
    foreign key (PROC_DEF_ID_)
    references ACT_RE_PROCDEF (ID_);

alter table ACT_RU_TIMER_JOB
    add constraint ACT_FK_TIMER_JOB_EXECUTION
    foreign key (EXECUTION_ID_)
    references ACT_RU_EXECUTION (ID_);

alter table ACT_RU_TIMER_JOB
    add constraint ACT_FK_TIMER_JOB_PROCESS_INSTANCE
    foreign key (PROCESS_INSTANCE_ID_)
    references ACT_RU_EXECUTION (ID_);

alter table ACT_RU_TIMER_JOB
    add constraint ACT_FK_TIMER_JOB_PROC_DEF
    foreign key (PROC_DEF_ID_)
    references ACT_RE_PROCDEF (ID_);

alter table ACT_RU_SUSPENDED_JOB
    add constraint ACT_FK_SUSPENDED_JOB_EXECUTION
    foreign key (EXECUTION_ID_)
    references ACT_RU_EXECUTION (ID_);

alter table ACT_RU_SUSPENDED_JOB
    add constraint ACT_FK_SUSPENDED_JOB_PROCESS_INSTANCE
    foreign key (PROCESS_INSTANCE_ID_)
    references ACT_RU_EXECUTION (ID_);

alter table ACT_RU_SUSPENDED_JOB
    add constraint ACT_FK_SUSPENDED_JOB_PROC_DEF
    foreign key (PROC_DEF_ID_)
    references ACT_RE_PROCDEF (ID_);

alter table ACT_RU_DEADLETTER_JOB
    add constraint ACT_FK_DEADLETTER_JOB_EXECUTION
    foreign key (EXECUTION_ID_)
    references ACT_RU_EXECUTION (ID_);

alter table ACT_RU_DEADLETTER_JOB
    add constraint ACT_FK_DEADLETTER_JOB_PROCESS_INSTANCE
    foreign key (PROCESS_INSTANCE_ID_)
    references ACT_RU_EXECUTION (ID_);

alter table ACT_RU_DEADLETTER_JOB
    add constraint ACT_FK_DEADLETTER_JOB_PROC_DEF
    foreign key (PROC_DEF_ID_)
    references ACT_RE_PROCDEF (ID_);

alter table ACT_RU_EVENT_SUBSCR
    add constraint ACT_FK_EVENT_EXEC
    foreign key (EXECUTION_ID_)
    references ACT_RU_EXECUTION(ID_);

alter table ACT_RE_MODEL
    add constraint ACT_FK_MODEL_SOURCE
    foreign key (EDITOR_SOURCE_VALUE_ID_)
    references ACT_GE_BYTEARRAY (ID_);

alter table ACT_RE_MODEL
    add constraint ACT_FK_MODEL_SOURCE_EXTRA
    foreign key (EDITOR_SOURCE_EXTRA_VALUE_ID_)
    references ACT_GE_BYTEARRAY (ID_);

alter table ACT_RE_MODEL
    add constraint ACT_FK_MODEL_DEPLOYMENT
    foreign key (DEPLOYMENT_ID_)
    references ACT_RE_DEPLOYMENT (ID_);

alter table ACT_PROCDEF_INFO
    add constraint ACT_FK_INFO_JSON_BA
    foreign key (INFO_JSON_ID_)
    references ACT_GE_BYTEARRAY (ID_);

alter table ACT_PROCDEF_INFO
    add constraint ACT_FK_INFO_PROCDEF
    foreign key (PROC_DEF_ID_)
    references ACT_RE_PROCDEF (ID_);

alter table ACT_PROCDEF_INFO
    add constraint ACT_UNIQ_INFO_PROCDEF
    unique (PROC_DEF_ID_);

insert into ACT_GE_PROPERTY
values ('schema.version', '7.0.1.1', 1);

insert into ACT_GE_PROPERTY
values ('schema.history', 'create(7.0.1.1)', 1);

create table ACT_HI_PROCINST (
    ID_ varchar(64) not null,
    REV_ integer default 1,
    PROC_INST_ID_ varchar(64) not null,
    BUSINESS_KEY_ varchar(255),
    PROC_DEF_ID_ varchar(64) not null,
    START_TIME_ datetime(3) not null,
    END_TIME_ datetime(3),
    DURATION_ bigint,
    START_USER_ID_ varchar(255),
    START_ACT_ID_ varchar(255),
    END_ACT_ID_ varchar(255),
    SUPER_PROCESS_INSTANCE_ID_ varchar(64),
    DELETE_REASON_ varchar(4000),
    TENANT_ID_ varchar(255) default '',
    NAME_ varchar(255),
    CALLBACK_ID_ varchar(255),
    CALLBACK_TYPE_ varchar(255),
    REFERENCE_ID_ varchar(255),
    REFERENCE_TYPE_ varchar(255),
    PROPAGATED_STAGE_INST_ID_ varchar(255),
    BUSINESS_STATUS_ varchar(255),
    primary key (ID_),
    unique (PROC_INST_ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_HI_ACTINST (
    ID_ varchar(64) not null,
    REV_ integer default 1,
    PROC_DEF_ID_ varchar(64) not null,
    PROC_INST_ID_ varchar(64) not null,
    EXECUTION_ID_ varchar(64) not null,
    ACT_ID_ varchar(255) not null,
    TASK_ID_ varchar(64),
    CALL_PROC_INST_ID_ varchar(64),
    ACT_NAME_ varchar(255),
    ACT_TYPE_ varchar(255) not null,
    ASSIGNEE_ varchar(255),
    START_TIME_ datetime(3) not null,
    END_TIME_ datetime(3),
    TRANSACTION_ORDER_ integer,
    DURATION_ bigint,
    DELETE_REASON_ varchar(4000),
    TENANT_ID_ varchar(255) default '',
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_HI_DETAIL (
    ID_ varchar(64) not null,
    TYPE_ varchar(255) not null,
    PROC_INST_ID_ varchar(64),
    EXECUTION_ID_ varchar(64),
    TASK_ID_ varchar(64),
    ACT_INST_ID_ varchar(64),
    NAME_ varchar(255) not null,
    VAR_TYPE_ varchar(255),
    REV_ integer,
    TIME_ datetime(3) not null,
    BYTEARRAY_ID_ varchar(64),
    DOUBLE_ double,
    LONG_ bigint,
    TEXT_ varchar(4000),
    TEXT2_ varchar(4000),
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_HI_COMMENT (
    ID_ varchar(64) not null,
    TYPE_ varchar(255),
    TIME_ datetime(3) not null,
    USER_ID_ varchar(255),
    TASK_ID_ varchar(64),
    PROC_INST_ID_ varchar(64),
    ACTION_ varchar(255),
    MESSAGE_ varchar(4000),
    FULL_MSG_ LONGBLOB,
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_HI_ATTACHMENT (
    ID_ varchar(64) not null,
    REV_ integer,
    USER_ID_ varchar(255),
    NAME_ varchar(255),
    DESCRIPTION_ varchar(4000),
    TYPE_ varchar(255),
    TASK_ID_ varchar(64),
    PROC_INST_ID_ varchar(64),
    URL_ varchar(4000),
    CONTENT_ID_ varchar(64),
    TIME_ datetime(3),
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


create index ACT_IDX_HI_PRO_INST_END on ACT_HI_PROCINST(END_TIME_);
create index ACT_IDX_HI_PRO_I_BUSKEY on ACT_HI_PROCINST(BUSINESS_KEY_);
create index ACT_IDX_HI_PRO_SUPER_PROCINST on ACT_HI_PROCINST(SUPER_PROCESS_INSTANCE_ID_);
create index ACT_IDX_HI_ACT_INST_START on ACT_HI_ACTINST(START_TIME_);
create index ACT_IDX_HI_ACT_INST_END on ACT_HI_ACTINST(END_TIME_);
create index ACT_IDX_HI_DETAIL_PROC_INST on ACT_HI_DETAIL(PROC_INST_ID_);
create index ACT_IDX_HI_DETAIL_ACT_INST on ACT_HI_DETAIL(ACT_INST_ID_);
create index ACT_IDX_HI_DETAIL_TIME on ACT_HI_DETAIL(TIME_);
create index ACT_IDX_HI_DETAIL_NAME on ACT_HI_DETAIL(NAME_);
create index ACT_IDX_HI_DETAIL_TASK_ID on ACT_HI_DETAIL(TASK_ID_);
create index ACT_IDX_HI_PROCVAR_PROC_INST on ACT_HI_VARINST(PROC_INST_ID_);
create index ACT_IDX_HI_PROCVAR_TASK_ID on ACT_HI_VARINST(TASK_ID_);
create index ACT_IDX_HI_PROCVAR_EXE on ACT_HI_VARINST(EXECUTION_ID_);
create index ACT_IDX_HI_ACT_INST_PROCINST on ACT_HI_ACTINST(PROC_INST_ID_, ACT_ID_);
create index ACT_IDX_HI_ACT_INST_EXEC on ACT_HI_ACTINST(EXECUTION_ID_, ACT_ID_);
create index ACT_IDX_HI_IDENT_LNK_TASK on ACT_HI_IDENTITYLINK(TASK_ID_);
create index ACT_IDX_HI_IDENT_LNK_PROCINST on ACT_HI_IDENTITYLINK(PROC_INST_ID_);
create index ACT_IDX_HI_TASK_INST_PROCINST on ACT_HI_TASKINST(PROC_INST_ID_);
create table ACT_ID_PROPERTY (
    NAME_ varchar(64),
    VALUE_ varchar(300),
    REV_ integer,
    primary key (NAME_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

insert into ACT_ID_PROPERTY
values ('schema.version', '7.0.1.1', 1);

create table ACT_ID_BYTEARRAY (
    ID_ varchar(64),
    REV_ integer,
    NAME_ varchar(255),
    BYTES_ LONGBLOB,
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_ID_GROUP (
    ID_ varchar(64),
    REV_ integer,
    NAME_ varchar(255),
    TYPE_ varchar(255),
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_ID_MEMBERSHIP (
    USER_ID_ varchar(64),
    GROUP_ID_ varchar(64),
    primary key (USER_ID_, GROUP_ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_ID_USER (
    ID_ varchar(64),
    REV_ integer,
    FIRST_ varchar(255),
    LAST_ varchar(255),
    DISPLAY_NAME_ varchar(255),
    EMAIL_ varchar(255),
    PWD_ varchar(255),
    PICTURE_ID_ varchar(64),
    TENANT_ID_ varchar(255) default '',
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_ID_INFO (
    ID_ varchar(64),
    REV_ integer,
    USER_ID_ varchar(64),
    TYPE_ varchar(64),
    KEY_ varchar(255),
    VALUE_ varchar(255),
    PASSWORD_ LONGBLOB,
    PARENT_ID_ varchar(255),
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_ID_TOKEN (
    ID_ varchar(64) not null,
    REV_ integer,
    TOKEN_VALUE_ varchar(255),
    TOKEN_DATE_ timestamp(3),
    IP_ADDRESS_ varchar(255),
    USER_AGENT_ varchar(255),
    USER_ID_ varchar(255),
    TOKEN_DATA_ varchar(2000),
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_ID_PRIV (
    ID_ varchar(64) not null,
    NAME_ varchar(255) not null,
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

create table ACT_ID_PRIV_MAPPING (
    ID_ varchar(64) not null,
    PRIV_ID_ varchar(64) not null,
    USER_ID_ varchar(255),
    GROUP_ID_ varchar(255),
    primary key (ID_)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

alter table ACT_ID_MEMBERSHIP
    add constraint ACT_FK_MEMB_GROUP
    foreign key (GROUP_ID_)
    references ACT_ID_GROUP (ID_);

alter table ACT_ID_MEMBERSHIP
    add constraint ACT_FK_MEMB_USER
    foreign key (USER_ID_)
    references ACT_ID_USER (ID_);

alter table ACT_ID_PRIV_MAPPING
    add constraint ACT_FK_PRIV_MAPPING
    foreign key (PRIV_ID_)
    references ACT_ID_PRIV (ID_);

create index ACT_IDX_PRIV_USER on ACT_ID_PRIV_MAPPING(USER_ID_);
create index ACT_IDX_PRIV_GROUP on ACT_ID_PRIV_MAPPING(GROUP_ID_);

alter table ACT_ID_PRIV
    add constraint ACT_UNIQ_PRIV_NAME
    unique (NAME_);

CREATE TABLE FLW_EV_DATABASECHANGELOGLOCK (ID INT NOT NULL, `LOCKED` BIT(1) NOT NULL, LOCKGRANTED datetime NULL, LOCKEDBY VARCHAR(255) NULL, CONSTRAINT PK_FLW_EV_DATABASECHANGELOGLOCK PRIMARY KEY (ID));

DELETE FROM FLW_EV_DATABASECHANGELOGLOCK;

INSERT INTO FLW_EV_DATABASECHANGELOGLOCK (ID, `LOCKED`) VALUES (1, 0);

UPDATE FLW_EV_DATABASECHANGELOGLOCK SET `LOCKED` = 1, LOCKEDBY = '192.168.10.1 (192.168.10.1)', LOCKGRANTED = '2022-12-21 18:20:13.507' WHERE ID = 1 AND `LOCKED` = 0;

CREATE TABLE FLW_EV_DATABASECHANGELOG (ID VARCHAR(255) NOT NULL, AUTHOR VARCHAR(255) NOT NULL, FILENAME VARCHAR(255) NOT NULL, DATEEXECUTED datetime NOT NULL, ORDEREXECUTED INT NOT NULL, EXECTYPE VARCHAR(10) NOT NULL, MD5SUM VARCHAR(35) NULL, `DESCRIPTION` VARCHAR(255) NULL, COMMENTS VARCHAR(255) NULL, TAG VARCHAR(255) NULL, LIQUIBASE VARCHAR(20) NULL, CONTEXTS VARCHAR(255) NULL, LABELS VARCHAR(255) NULL, DEPLOYMENT_ID VARCHAR(10) NULL);

CREATE TABLE FLW_EVENT_DEPLOYMENT (ID_ VARCHAR(255) NOT NULL, NAME_ VARCHAR(255) NULL, CATEGORY_ VARCHAR(255) NULL, DEPLOY_TIME_ datetime(3) NULL, TENANT_ID_ VARCHAR(255) NULL, PARENT_DEPLOYMENT_ID_ VARCHAR(255) NULL, CONSTRAINT PK_FLW_EVENT_DEPLOYMENT PRIMARY KEY (ID_));

CREATE TABLE FLW_EVENT_RESOURCE (ID_ VARCHAR(255) NOT NULL, NAME_ VARCHAR(255) NULL, DEPLOYMENT_ID_ VARCHAR(255) NULL, RESOURCE_BYTES_ LONGBLOB NULL, CONSTRAINT PK_FLW_EVENT_RESOURCE PRIMARY KEY (ID_));

CREATE TABLE FLW_EVENT_DEFINITION (ID_ VARCHAR(255) NOT NULL, NAME_ VARCHAR(255) NULL, VERSION_ INT NULL, KEY_ VARCHAR(255) NULL, CATEGORY_ VARCHAR(255) NULL, DEPLOYMENT_ID_ VARCHAR(255) NULL, TENANT_ID_ VARCHAR(255) NULL, RESOURCE_NAME_ VARCHAR(255) NULL, DESCRIPTION_ VARCHAR(255) NULL, CONSTRAINT PK_FLW_EVENT_DEFINITION PRIMARY KEY (ID_));

CREATE UNIQUE INDEX ACT_IDX_EVENT_DEF_UNIQ ON FLW_EVENT_DEFINITION(KEY_, VERSION_, TENANT_ID_);

CREATE TABLE FLW_CHANNEL_DEFINITION (ID_ VARCHAR(255) NOT NULL, NAME_ VARCHAR(255) NULL, VERSION_ INT NULL, KEY_ VARCHAR(255) NULL, CATEGORY_ VARCHAR(255) NULL, DEPLOYMENT_ID_ VARCHAR(255) NULL, CREATE_TIME_ datetime(3) NULL, TENANT_ID_ VARCHAR(255) NULL, RESOURCE_NAME_ VARCHAR(255) NULL, DESCRIPTION_ VARCHAR(255) NULL, CONSTRAINT PK_FLW_CHANNEL_DEFINITION PRIMARY KEY (ID_));

CREATE UNIQUE INDEX ACT_IDX_CHANNEL_DEF_UNIQ ON FLW_CHANNEL_DEFINITION(KEY_, VERSION_, TENANT_ID_);

INSERT INTO FLW_EV_DATABASECHANGELOG (ID, AUTHOR, FILENAME, DATEEXECUTED, ORDEREXECUTED, MD5SUM, `DESCRIPTION`, COMMENTS, EXECTYPE, CONTEXTS, LABELS, LIQUIBASE, DEPLOYMENT_ID) VALUES ('1', 'flowable', 'org/flowable/eventregistry/db/liquibase/flowable-eventregistry-db-changelog.xml', NOW(), 1, '8:1b0c48c9cf7945be799d868a2626d687', 'createTable tableName=FLW_EVENT_DEPLOYMENT; createTable tableName=FLW_EVENT_RESOURCE; createTable tableName=FLW_EVENT_DEFINITION; createIndex indexName=ACT_IDX_EVENT_DEF_UNIQ, tableName=FLW_EVENT_DEFINITION; createTable tableName=FLW_CHANNEL_DEFIN...', '', 'EXECUTED', NULL, NULL, '4.3.5', '1643213577');

ALTER TABLE FLW_CHANNEL_DEFINITION ADD TYPE_ VARCHAR(255) NULL;

ALTER TABLE FLW_CHANNEL_DEFINITION ADD IMPLEMENTATION_ VARCHAR(255) NULL;

INSERT INTO FLW_EV_DATABASECHANGELOG (ID, AUTHOR, FILENAME, DATEEXECUTED, ORDEREXECUTED, MD5SUM, `DESCRIPTION`, COMMENTS, EXECTYPE, CONTEXTS, LABELS, LIQUIBASE, DEPLOYMENT_ID) VALUES ('2', 'flowable', 'org/flowable/eventregistry/db/liquibase/flowable-eventregistry-db-changelog.xml', NOW(), 2, '8:0ea825feb8e470558f0b5754352b9cda', 'addColumn tableName=FLW_CHANNEL_DEFINITION; addColumn tableName=FLW_CHANNEL_DEFINITION', '', 'EXECUTED', NULL, NULL, '4.3.5', '1643213577');

INSERT INTO FLW_EV_DATABASECHANGELOG (ID, AUTHOR, FILENAME, DATEEXECUTED, ORDEREXECUTED, MD5SUM, `DESCRIPTION`, COMMENTS, EXECTYPE, CONTEXTS, LABELS, LIQUIBASE, DEPLOYMENT_ID) VALUES ('3', 'flowable', 'org/flowable/eventregistry/db/liquibase/flowable-eventregistry-db-changelog.xml', NOW(), 3, '8:3c2bb293350b5cbe6504331980c9dcee', 'customChange', '', 'EXECUTED', NULL, NULL, '4.3.5', '1643213577');

UPDATE FLW_EV_DATABASECHANGELOGLOCK SET `LOCKED` = 0, LOCKEDBY = NULL, LOCKGRANTED = NULL WHERE ID = 1;

alter table ACT_RU_EVENT_SUBSCR add column SCOPE_DEFINITION_KEY_ varchar(255);

update ACT_GE_PROPERTY set VALUE_ = '7.0.1.1' where NAME_ = 'common.schema.version';

update ACT_GE_PROPERTY set VALUE_ = '7.0.1.1' where NAME_ = 'entitylink.schema.version';

update ACT_GE_PROPERTY set VALUE_ = '7.0.1.1' where NAME_ = 'identitylink.schema.version';

update ACT_GE_PROPERTY set VALUE_ = '7.0.1.1' where NAME_ = 'job.schema.version';

update ACT_GE_PROPERTY set VALUE_ = '7.0.1.1' where NAME_ = 'batch.schema.version';

alter table ACT_RU_TASK add column (
    STATE_ varchar(255),
    IN_PROGRESS_TIME_ datetime(3),
    IN_PROGRESS_STARTED_BY_ varchar(255),
    CLAIMED_BY_ varchar(255),
    SUSPENDED_TIME_ datetime(3),
    SUSPENDED_BY_ varchar(255),
    IN_PROGRESS_DUE_DATE_ datetime(3));

alter table ACT_HI_TASKINST add column (
    STATE_ varchar(255),
    IN_PROGRESS_TIME_ datetime(3),
    IN_PROGRESS_STARTED_BY_ varchar(255),
    CLAIMED_BY_ varchar(255),
    SUSPENDED_TIME_ datetime(3),
    SUSPENDED_BY_ varchar(255),
    COMPLETED_BY_ varchar(255),
    IN_PROGRESS_DUE_DATE_ datetime(3));

update ACT_GE_PROPERTY set VALUE_ = '7.0.1.1' where NAME_ = 'task.schema.version';

update ACT_GE_PROPERTY set VALUE_ = '7.0.1.1' where NAME_ = 'variable.schema.version';

update ACT_GE_PROPERTY set VALUE_ = '7.0.1.1' where NAME_ = 'schema.version';

update ACT_ID_PROPERTY set VALUE_ = '7.0.1.1' where NAME_ = 'schema.version';
-- ------------------------------------

-- Clean dangling workflows not removed after test connection
truncate automations_workflow;

-- App Data Store
CREATE TABLE IF NOT EXISTS apps_data_store (
    identifier VARCHAR(256) NOT NULL,
    type VARCHAR(256) NOT NULL,
    json JSON NOT NULL
);

-- Add the source column to the consumers_dlq table
ALTER TABLE consumers_dlq ADD COLUMN source VARCHAR(255);

-- Create an index on the source column in the consumers_dlq table
CREATE INDEX idx_consumers_dlq_source ON consumers_dlq (source);


-- Data Insight charts: add metrics field
UPDATE
   di_chart_entity 
SET
   json = JSON_SET( JSON_REMOVE(json, '$.chartDetails.formula', '$.chartDetails.filter', '$.chartDetails.function', '$.chartDetails.field', '$.chartDetails.treeFilter' ), '$.chartDetails.metrics', JSON_ARRAY( (
   SELECT
      JSON_OBJECTAGG(my_key, value) 
   FROM
      (
         SELECT
            my_key,
            value 
         FROM
            (
               SELECT
                  'formula' AS my_key,
                  JSON_UNQUOTE(JSON_EXTRACT(json, '$.chartDetails.formula')) AS value 
               UNION ALL
               SELECT
                  'filter',
                  JSON_UNQUOTE(JSON_EXTRACT(json, '$.chartDetails.filter')) 
               UNION ALL
               SELECT
                  'function',
                  JSON_UNQUOTE(JSON_EXTRACT(json, '$.chartDetails.function')) 
               UNION ALL
               SELECT
                  'field',
                  JSON_UNQUOTE(JSON_EXTRACT(json, '$.chartDetails.field')) 
               UNION ALL
               SELECT
                  'treeFilter',
                  JSON_UNQUOTE(JSON_EXTRACT(json, '$.chartDetails.treeFilter')) 
            )
            AS temp 
         WHERE
            value IS NOT NULL 
      )
      as demo) ) ) 
   WHERE
      JSON_EXTRACT(json, '$.chartDetails.metrics') is NULL;

-- Rename 'offset' to 'currentOffset' and add 'startingOffset'
UPDATE change_event_consumers
SET json = JSON_SET(
    JSON_REMOVE(json, '$.offset'),
    '$.currentOffset', JSON_EXTRACT(json, '$.offset'),
    '$.startingOffset', JSON_EXTRACT(json, '$.offset')
)
WHERE JSON_EXTRACT(json, '$.offset') IS NOT NULL
  AND jsonSchema = 'eventSubscriptionOffset';

-- Create table successful_sent_change_events for storing successfully sent events per alert
CREATE TABLE IF NOT EXISTS successful_sent_change_events (
    change_event_id VARCHAR(36) NOT NULL,
    event_subscription_id VARCHAR(36) NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (change_event_id, event_subscription_id)
);

-- Create an index on the event_subscription_id column in the successful_sent_change_events table
CREATE INDEX idx_event_subscription_id ON successful_sent_change_events (event_subscription_id);

-- Remove Override View Lineage
UPDATE ingestion_pipeline_entity
SET json = JSON_REMOVE(json, '$.sourceConfig.config.overrideViewLineage')
WHERE JSON_EXTRACT(json, '$.pipelineType') = 'metadata';

-- classification and sampling configs from the profiler pipelines
UPDATE ingestion_pipeline_entity
SET json = JSON_REMOVE(json, '$.sourceConfig.config.processPiiSensitive', '$.sourceConfig.config.confidence', '$.sourceConfig.config.generateSampleData', '$.sourceConfig.config.sampleDataCount')
WHERE JSON_EXTRACT(json, '$.pipelineType') = 'profiler';

-- Rename 'jobId' to 'jobIds', set 'jobId' as type array in 'jobIds' , add 'projectIds' for dbt cloud
UPDATE pipeline_service_entity
SET json = JSON_SET(
    JSON_REMOVE(
        json,
        '$.connection.config.jobId'
    ),
    '$.connection.config.jobIds',
    IF(
        JSON_CONTAINS_PATH(json, 'one', '$.connection.config.jobIds'),
        JSON_EXTRACT(json, '$.connection.config.jobIds'),
        IF(
            JSON_EXTRACT(json, '$.connection.config.jobId') IS NOT NULL,
            JSON_ARRAY(JSON_UNQUOTE(JSON_EXTRACT(json, '$.connection.config.jobId'))),
            JSON_ARRAY()
        )
    ),
    '$.connection.config.projectIds',
    IF(
        JSON_CONTAINS_PATH(json, 'one', '$.connection.config.projectIds'),
        JSON_EXTRACT(json, '$.connection.config.projectIds'),
        JSON_ARRAY()
    )
)
WHERE serviceType = 'DBTCloud';

-- Update serviceType in dashboard_entity table
UPDATE dashboard_entity
SET json = JSON_SET(json, '$.serviceType', 'MicroStrategy')
WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.serviceType')) = 'Mstr';

-- Update serviceType in dashboard_service_entity table
UPDATE dashboard_service_entity
SET json = JSON_SET(json, '$.serviceType', 'MicroStrategy')
WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.serviceType')) = 'Mstr';

UPDATE dashboard_service_entity
SET json = JSON_SET(json, '$.connection.config.type', 'MicroStrategy')
WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.connection.config.type')) = 'Mstr';

-- Update serviceType in dashboard_data_model_entity table
UPDATE dashboard_data_model_entity
SET json = JSON_SET(json, '$.serviceType', 'MicroStrategy')
WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.serviceType')) = 'Mstr';

-- Update serviceType in chart_entity table
UPDATE chart_entity
SET json = JSON_SET(json, '$.serviceType', 'MicroStrategy')
WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.serviceType')) = 'Mstr';