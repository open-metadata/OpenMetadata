import ast
import inspect
import textwrap
from functools import wraps
from os import name
from typing import Any, Dict, List, Optional

from opentelemetry import trace
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from opentelemetry.trace.span import Span
from opentelemetry.trace.status import Status, StatusCode

from metadata.telemetry.openmetadata_telemetry import openmetadata_telemetry

trace_context_propagator = TraceContextTextMapPropagator()
trace_context_carrier = {}

tracer = trace.get_tracer_provider().get_tracer(__name__)


def get_decorators(function):
    decorators = {}

    def visit_FunctionDef(node):
        decorators[node.name] = {}
        for n in node.decorator_list:
            print(ast.dump(n))
            name = ""
            if isinstance(n, ast.Call):
                group = n.func.value.id
                name = n.func.attr if isinstance(n.func, ast.Attribute) else n.func.id

                for a in n.args:
                    print(ast.dump(a))
            else:
                group = n.attr if isinstance(n, ast.Attribute) else n.id
                name = None

            if group not in decorators[node.name]:
                decorators[node.name][group] = []

            if name:
                decorators[node.name][group].append({name})

    node_iter = ast.NodeVisitor()
    node_iter.visit_FunctionDef = visit_FunctionDef
    node_iter.visit(ast.parse(textwrap.dedent(inspect.getsource(function))))
    return decorators


def openmetadata_trace(fn: callable):
    def _before_exec(span: Span, fn: callable):
        span.set_attribute("user_cookie_id", openmetadata_telemetry.user_cookie_id)

    def _after_exec(span: Span, error: Optional[BaseException] = None):
        if str(error) == "0":
            pass
            # This is an OK cli exit state
            span.set_status(Status(StatusCode.OK))
        else:
            span.set_status(Status(StatusCode.ERROR))
            span.add_event("error", {"error": str(error)})

    @wraps(fn)
    def wrapper(*original_args, **original_kwargs):
        current_span = trace.get_current_span()
        if hasattr(current_span, "context"):
            print(current_span.context.span_id)
        ctx = trace_context_propagator.extract(carrier=trace_context_carrier)
        with tracer.start_as_current_span(
            f"{fn.__module__}.{fn.__name__}", context=ctx
        ) as span:
            trace_context_propagator.inject(carrier=trace_context_carrier)
            result = None
            try:
                _before_exec(span, fn)
                result = fn(*original_args, **original_kwargs)
                span.set_status(Status(StatusCode.OK))
                _after_exec(span)
            except BaseException as e:
                _after_exec(span, e)
        return result

    return wrapper


def span_setup_function_args(args: Dict):
    for prefix, values in args.items():
        for key, value in values.items():
            openmetadata_telemetry.set_attribute(f"{prefix}_{key}", value or "")
