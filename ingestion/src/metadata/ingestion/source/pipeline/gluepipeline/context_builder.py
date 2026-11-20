#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Pure workflow snapshot and parameter-context builder for AWS Glue lineage.

Separates Glue API collection (`WorkflowSnapshot`, job runs) from argument
precedence, trigger isolation, and workflow-to-job-run correlation so context
construction runs once per workflow snapshot and can be tested without I/O.
"""

from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from metadata.ingestion.source.pipeline.gluepipeline.models import JobNodes
from metadata.ingestion.source.pipeline.gluepipeline.script_evaluator import ParameterContext

GRAPH = "Graph"
NODES = "Nodes"
NAME = "Name"
JOB_TYPE = "JOB"
TRIGGER_TYPE = "TRIGGER"

# ADR:2026-11-13-glue-parameterized-lineage-evaluates-per-run-context
MAX_INSPECTED_RUNS = 10


def clean_str_dict(raw: Any) -> dict[str, str]:
    if not isinstance(raw, Mapping):
        return {}
    return {str(k): str(v) for k, v in raw.items() if k is not None and v is not None}


@dataclass(frozen=True)
class WorkflowSnapshot:
    """Immutable snapshot of a Glue workflow's definition and inspected run history."""

    workflow_name: str | None = None
    default_run_properties: tuple[tuple[str, str], ...] = ()
    runs: tuple[dict[str, Any], ...] = ()
    runs_fetch_ok: bool = True
    graph_nodes: tuple[dict[str, Any], ...] = ()

    @classmethod
    def from_workflow_details(
        cls,
        workflow_details: Mapping[str, Any] | None,
        runs: Iterable[Mapping[str, Any]] = (),
        *,
        runs_fetch_ok: bool = True,
    ) -> "WorkflowSnapshot":
        if not isinstance(workflow_details, Mapping):
            return cls(runs_fetch_ok=runs_fetch_ok)
        raw_name = workflow_details.get(NAME)
        workflow_name = raw_name if isinstance(raw_name, str) and raw_name else None
        default_props = clean_str_dict(workflow_details.get("DefaultRunProperties"))
        graph = workflow_details.get(GRAPH)
        raw_nodes = graph.get(NODES, []) if isinstance(graph, Mapping) else []
        graph_nodes = tuple(dict(n) for n in raw_nodes if isinstance(n, Mapping)) if isinstance(raw_nodes, list) else ()
        collected_runs = [dict(r) for r in list(runs)[:MAX_INSPECTED_RUNS] if isinstance(r, Mapping)]

        last_run = workflow_details.get("LastRun")
        if isinstance(last_run, Mapping):
            last_run_id = last_run.get("WorkflowRunId")
            seen_ids = {r.get("WorkflowRunId") for r in collected_runs if r.get("WorkflowRunId")}
            if (not collected_runs or (last_run_id and last_run_id not in seen_ids)) and len(
                collected_runs
            ) < MAX_INSPECTED_RUNS:
                collected_runs.append(dict(last_run))

        return cls(
            workflow_name=workflow_name,
            default_run_properties=tuple(sorted(default_props.items())),
            runs=tuple(collected_runs[:MAX_INSPECTED_RUNS]),
            runs_fetch_ok=runs_fetch_ok,
            graph_nodes=graph_nodes,
        )


def extract_trigger_arguments(
    job_name: str,
    graph_nodes: Sequence[Mapping[str, Any]],
) -> tuple[dict[str, dict[str, str]], list[dict[str, str]]]:
    """
    Trigger arguments kept per trigger, never merged across triggers: a run started by
    one trigger must not inherit another trigger's arguments.
    """
    by_trigger: dict[str, dict[str, str]] = {}
    ordered_sets: list[dict[str, str]] = []
    for node in graph_nodes:
        if node.get("Type") != TRIGGER_TYPE:
            continue
        trigger_details = node.get("TriggerDetails")
        trigger = trigger_details.get("Trigger") if isinstance(trigger_details, Mapping) else None
        if not isinstance(trigger, Mapping):
            continue
        trigger_name = trigger.get("Name") or node.get(NAME)
        actions = trigger.get("Actions", [])
        if not isinstance(actions, list):
            continue
        trigger_args: dict[str, str] = {}
        has_matching_action = False
        for action in actions:
            if isinstance(action, Mapping) and action.get("JobName") == job_name:
                has_matching_action = True
                trigger_args.update(clean_str_dict(action.get("Arguments")))
        if not has_matching_action:
            continue
        if isinstance(trigger_name, str) and trigger_name:
            if trigger_name in by_trigger:
                by_trigger[trigger_name].update(trigger_args)
            else:
                by_trigger[trigger_name] = trigger_args
                ordered_sets.append(trigger_args)
        else:
            ordered_sets.append(trigger_args)
    deduped_sets: list[dict[str, str]] = []
    seen_sets: set[tuple[tuple[str, str], ...]] = set()
    for arg_set in ordered_sets:
        set_key = tuple(sorted(arg_set.items()))
        if set_key not in seen_sets:
            seen_sets.add(set_key)
            deduped_sets.append(dict(arg_set))
    return by_trigger, deduped_sets


def _extract_workflow_run_job_runs(wf_run: Mapping[str, Any], job_name: str) -> list[dict[str, Any]]:
    graph = wf_run.get(GRAPH)
    nodes = graph.get(NODES, []) if isinstance(graph, Mapping) else []
    if not isinstance(nodes, list):
        return []
    matched: list[dict[str, Any]] = []
    for node in nodes:
        if not isinstance(node, Mapping) or node.get("Type") != JOB_TYPE or node.get(NAME) != job_name:
            continue
        job_details = node.get("JobDetails")
        jr_list = job_details.get("JobRuns", []) if isinstance(job_details, Mapping) else []
        if isinstance(jr_list, list):
            matched.extend(dict(jr) for jr in jr_list if isinstance(jr, Mapping))
    return matched


def _synthetic_workflow_args(workflow_name: str | None, wf_run_id: Any = None) -> dict[str, str]:
    synthetic_args: dict[str, str] = {}
    if isinstance(workflow_name, str) and workflow_name:
        synthetic_args["--WORKFLOW_NAME"] = workflow_name
    if isinstance(wf_run_id, str) and wf_run_id:
        synthetic_args["--WORKFLOW_RUN_ID"] = wf_run_id
    return synthetic_args


def _is_other_workflow_job_run(
    jr_workflow_name: str | None,
    trig_name: Any,
    trigger_args_by_name: Mapping[str, Mapping[str, str]],
    workflow_name: str | None,
) -> bool:
    if not (isinstance(workflow_name, str) and workflow_name):
        return False
    if jr_workflow_name and jr_workflow_name != workflow_name:
        return True
    return bool(
        isinstance(trig_name, str)
        and trig_name
        and trigger_args_by_name
        and trig_name not in trigger_args_by_name
        and jr_workflow_name != workflow_name
    )


def build_parameter_contexts(
    job_name: str,
    job_details: JobNodes,
    workflow_snapshot: WorkflowSnapshot | None = None,
    job_runs: Sequence[Mapping[str, Any]] = (),
) -> list[ParameterContext]:
    """
    Pure builder of up to `MAX_INSPECTED_RUNS` `ParameterContext` instances for `job_name`.

    Precedence:
    - Job arguments: `Job.DefaultArguments` < trigger `Arguments` < `JobRun.Arguments` < `Job.NonOverridableArguments`
    - Workflow run properties: `Workflow.DefaultRunProperties` < `WorkflowRun.WorkflowRunProperties`
    """
    snapshot = workflow_snapshot or WorkflowSnapshot()
    default_job_args = clean_str_dict(job_details.default_arguments)
    non_overridable_args = clean_str_dict(job_details.non_overridable_arguments)
    trigger_args_by_name, trigger_arg_sets = extract_trigger_arguments(job_name, snapshot.graph_nodes)

    default_run_props = dict(snapshot.default_run_properties)
    workflow_name = snapshot.workflow_name
    wf_runs_fetch_ok = snapshot.runs_fetch_ok
    inspected_job_runs = list(job_runs)[:MAX_INSPECTED_RUNS]

    job_runs_by_id = {jr["Id"]: jr for jr in inspected_job_runs if isinstance(jr.get("Id"), str)}
    job_runs_by_wf_run: dict[str, list[Mapping[str, Any]]] = {}
    for jr in inspected_job_runs:
        jr_args = clean_str_dict(jr.get("Arguments"))
        wf_id = jr_args.get("--WORKFLOW_RUN_ID") or jr_args.get("WORKFLOW_RUN_ID")
        if wf_id:
            job_runs_by_wf_run.setdefault(wf_id, []).append(jr)

    contexts: list[ParameterContext] = []
    seen_keys: set[tuple[object, ...]] = set()
    matched_jr_ids: set[str] = set()

    def add_ctx(
        j_args: dict[str, str],
        r_props: dict[str, str],
        *,
        run_props_opaque: bool = False,
        ctx_wf_name: str | None = workflow_name,
        ctx_wf_run_id: str | None = None,
        ctx_jr_id: str | None = None,
        execution_id: str | None = None,
        has_default_workflow_run: bool = False,
    ) -> None:
        if len(contexts) >= MAX_INSPECTED_RUNS:
            return
        ctx = ParameterContext.from_mappings(
            job_args={**j_args, **non_overridable_args},
            run_props=r_props,
            run_props_opaque=run_props_opaque,
            workflow_name=ctx_wf_name,
            workflow_run_id=ctx_wf_run_id,
            job_run_id=ctx_jr_id,
            execution_id=execution_id,
            has_default_workflow_run=has_default_workflow_run,
        )
        dedup_key = ctx.dedup_key()
        if dedup_key not in seen_keys:
            seen_keys.add(dedup_key)
            contexts.append(ctx)

    for wf_idx, wf_run in enumerate(snapshot.runs):
        raw_wf_run_id = wf_run.get("WorkflowRunId")
        wf_run_id = raw_wf_run_id if isinstance(raw_wf_run_id, str) and raw_wf_run_id else None
        wf_run_props = wf_run.get("WorkflowRunProperties") or wf_run.get("RunProperties")
        wf_props = {**default_run_props, **clean_str_dict(wf_run_props)}
        wf_run_props_opaque = not wf_runs_fetch_ok and not isinstance(wf_run_props, Mapping)
        synthetic_args = _synthetic_workflow_args(workflow_name, wf_run_id)

        graph_jrs = _extract_workflow_run_job_runs(wf_run, job_name)
        linked_jrs = graph_jrs or (job_runs_by_wf_run.get(wf_run_id, []) if wf_run_id else [])

        if not linked_jrs and isinstance(wf_run.get(GRAPH), Mapping):
            continue

        if linked_jrs:
            for jr_idx, jr in enumerate(linked_jrs[:MAX_INSPECTED_RUNS]):
                raw_jr_id = jr.get("Id")
                jr_id = raw_jr_id if isinstance(raw_jr_id, str) and raw_jr_id else None
                full_jr = job_runs_by_id.get(jr_id, {}) if jr_id else {}
                if jr_id:
                    matched_jr_ids.add(jr_id)
                trig_name = jr.get("TriggerName") or full_jr.get("TriggerName")
                trig_args = trigger_args_by_name.get(trig_name, {}) if isinstance(trig_name, str) else {}
                jr_args = {**clean_str_dict(full_jr.get("Arguments")), **clean_str_dict(jr.get("Arguments"))}
                effective_args = {**synthetic_args, **default_job_args, **trig_args, **jr_args}
                add_ctx(
                    effective_args,
                    wf_props,
                    run_props_opaque=wf_run_props_opaque,
                    ctx_wf_name=workflow_name,
                    ctx_wf_run_id=wf_run_id,
                    ctx_jr_id=jr_id,
                    execution_id=f"{job_name}:{wf_run_id or f'wfrun_{wf_idx}'}:{jr_id or f'jr_{jr_idx}'}",
                    has_default_workflow_run=wf_run_id is None and bool(workflow_name),
                )
        else:
            for trig_idx, trig_args in enumerate(trigger_arg_sets or [{}]):
                effective_args = {**synthetic_args, **default_job_args, **trig_args}
                add_ctx(
                    effective_args,
                    wf_props,
                    run_props_opaque=wf_run_props_opaque,
                    ctx_wf_name=workflow_name,
                    ctx_wf_run_id=wf_run_id,
                    execution_id=f"{job_name}:{wf_run_id or f'wfrun_{wf_idx}'}:trig_{trig_idx}",
                    has_default_workflow_run=wf_run_id is None and bool(workflow_name),
                )

    _add_unmatched_job_run_contexts(
        add_ctx=add_ctx,
        job_name=job_name,
        job_runs=inspected_job_runs,
        matched_jr_ids=matched_jr_ids,
        default_job_args=default_job_args,
        default_run_props=default_run_props,
        trigger_args_by_name=trigger_args_by_name,
        workflow_name=workflow_name,
        wf_runs_fetch_ok=wf_runs_fetch_ok,
    )

    if not contexts:
        synthetic_default_args = _synthetic_workflow_args(workflow_name)
        for trig_idx, trig_args in enumerate(trigger_arg_sets or [{}]):
            add_ctx(
                {**synthetic_default_args, **default_job_args, **trig_args},
                default_run_props,
                run_props_opaque=not wf_runs_fetch_ok,
                ctx_wf_name=workflow_name,
                ctx_wf_run_id=None,
                execution_id=f"{job_name}:default:trig_{trig_idx}",
                has_default_workflow_run=bool(workflow_name),
            )

    return contexts


def _add_unmatched_job_run_contexts(
    *,
    add_ctx: Callable[..., None],
    job_name: str,
    job_runs: Sequence[Mapping[str, Any]],
    matched_jr_ids: set[str],
    default_job_args: dict[str, str],
    default_run_props: dict[str, str],
    trigger_args_by_name: Mapping[str, dict[str, str]],
    workflow_name: str | None,
    wf_runs_fetch_ok: bool,
) -> None:
    for jr_idx, jr in enumerate(job_runs):
        raw_jr_id = jr.get("Id")
        jr_id = raw_jr_id if isinstance(raw_jr_id, str) and raw_jr_id else None
        if jr_id and jr_id in matched_jr_ids:
            continue
        jr_args = clean_str_dict(jr.get("Arguments"))
        jr_workflow_name = jr_args.get("--WORKFLOW_NAME") or jr_args.get("WORKFLOW_NAME")
        jr_workflow_run_id = jr_args.get("--WORKFLOW_RUN_ID") or jr_args.get("WORKFLOW_RUN_ID")
        trig_name = jr.get("TriggerName")
        if _is_other_workflow_job_run(jr_workflow_name, trig_name, trigger_args_by_name, workflow_name):
            continue
        trig_args = trigger_args_by_name.get(trig_name, {}) if isinstance(trig_name, str) else {}
        effective_args = {**default_job_args, **trig_args, **jr_args}
        effective_wf_name = jr_workflow_name or workflow_name
        exec_id = f"{job_name}:unmatched:{jr_id or f'jr_{jr_idx}'}"
        if jr_workflow_run_id:
            add_ctx(
                effective_args,
                {},
                run_props_opaque=True,
                ctx_wf_name=effective_wf_name,
                ctx_wf_run_id=jr_workflow_run_id,
                ctx_jr_id=jr_id,
                execution_id=exec_id,
            )
        else:
            add_ctx(
                effective_args,
                default_run_props,
                run_props_opaque=not wf_runs_fetch_ok,
                ctx_wf_name=effective_wf_name,
                ctx_wf_run_id=None,
                ctx_jr_id=jr_id,
                execution_id=exec_id,
                has_default_workflow_run=False,
            )
