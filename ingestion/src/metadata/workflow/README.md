# Base Workflow

The goal of the `BaseWorkflow` is to define a unique class that that controls the logic flow of executions. This means:
- Having a consensus on how our executions are organized (steps)
- Centralizing in a single place all the exception management. We don't want individual - and wrongly uncaught - exceptions
  to blow up the full executions.
- Centralizing the `Status` handling: how do we report processed assets & failures and send them back to the `IngestionPipeline`.

## Steps

Each `Workflow` can be built by using `Steps` as lego pieces. Each of these pieces - steps - are a generic abstraction
on which operations we can expect to happen inside. Currently, the `BaseWorkflow` accepts any number of sequential `Steps`,
each of them taking care of a specific part of the business logic.

![base-workflow.steps.drawio.png](https://raw.githubusercontent.com/open-metadata/docs-v1/refs/heads/main/public/images/readme/ingestion/base-workflow.steps.drawio.png)

We mainly have four types of steps, iterative steps and return steps:

1. `IterStep`s are in charge of starting the workflow. They will read data from the external world and `yield` the elements
  that need to be processed down the pipeline.
2. `ReturnStep`s accept one input, which they will further process and return one output.
3. `StageStep`s accept one input, and they will write - stage - them somewhere. They are expected to be used together with the `BulkStep`.
4. `BulkStep`s iterate over an input - produced by the `StageStep` - and will return nothing.

These names might be explanatory, but harder to imagine/read. Therefore, we have specific classes based on these steps
that help us discuss better on the Workflow structure:

1. `IterStep` -> `Source`
2. `ReturnStep` -> `Processor` & `Sink`
3. `StageStep` -> `Step`
4. `BulkStep` -> `BulkSink`

When developing each of this steps, we'll just need to implement their execution method (either `_iter` or `_run`), where in
the `IterStep` the method is expected to `yield` results, and the rest to `return`.

We'll explain specific examples of these `Step`s in the next section.

## Workflows

Now that we have our pieces, we can define the `Workflow` structures. While the `Steps` could be joined together
somewhat arbitrarily, there are specific recipes that we follow depending on our goals. 

Each `Workflow` then can be build by defining its steps (starting with a `Source`, adding `Processor`s, etc.) and
registering the steps in the `BaseWorkflow.set_steps` method.

The `BaseWorkflow` will take care of common logic, such as initializing the `metadata` object, the `timer` logger and
sending the status to the `IngestionPipeline` when needed.

A couple of examples:

### Metadata Ingestion

Here we have two steps:
- `Source`: that will list the metadata of the origin (Dashboards, Tables, Pipelines,...), and translate them to the OpenMetadata
  standard.
- `REST Sink`: that will pick up the Create Requests of the above entities and send them to the OpenMetadata server.

What does the workflow do here? Group together the steps and streamline the execution. The workflow itself is the one
that will know how to get each of the elements produced on the `Source` and pass them to the `Sink`.

### Profiler Ingestion

In this case we have 4 steps:
- `Source`: that will pick up the tables from the OpenMetadata API that need to be profiled.
- `Profiler Processor`: to execute the metrics and gather the results for each table.
- `PII Processor`: that will get the result of the profiler, and add any classification that needs to be applied to the tables using NLP models.
- `REST Sink`: to send the results to the OpenMetadata API.

Here again, the `Workflow` class will move the elements from `Source` -> `Profiler Processor` -> `PII processor` -> `REST Sink`.

## Status & Exceptions

While the `Workflow` controls the execution flow, the most important part is in terms of status handling & exception management.

### Status

Each `Step` has its own `Status`, storing what has been processed and what has failed. The overall `Workflow` Status is based
on the statuses of the individual steps.

### Exceptions

To ensure that all the exception are caught, each `Step` executes its `run` methods of inside a `try/catch` block. It will
only blow things up if we encounter a `WorkflowFatalError`. Any other exception will just be logged.

However, how do we want to handle exceptions that can happen in every different component? By treating exceptions as data.

Each `Step` will `yield` or `return` an `Either` object, meaning that processing a single element can either be `right` -
and contain the expected results - or `left` - and contain the raised exception.

This consensus helps us ensure that we are keeping notes of the logged exceptions in the `Status` of each `Step`, so that
all the errors can properly be logged at the end of the execution.

For example, this is the `run` method of the `IterStep`:

```python
def run(self) -> Iterable[Optional[Entity]]:
    """
    Run the step and handle the status and exceptions

    Note that we are overwriting the default run implementation
    in order to create a generator with `yield`.
    """
    try:
        for result in self._iter():
            if result.left is not None:
                self.status.failed(result.left)
                yield None

            if result.right is not None:
                self.status.scanned(result.right)
                yield result.right
    except WorkflowFatalError as err:
        logger.error(f"Fatal error running step [{self}]: [{err}]")
        raise err
    except Exception as exc:
        error = f"Encountered exception running step [{self}]: [{exc}]"
        logger.warning(error)
        self.status.failed(
            StackTraceError(
                name="Unhandled", error=error, stack_trace=traceback.format_exc()
            )
        )
```

By tracking `Unhandled` exceptions, we then know which pieces of the code need to be treated more carefully to control
scenarios that we might not be aware of.

Then each `Step` control its own `Status` and exceptions (wrapped in the `Either`), and just push down the workflow
the actual `right` response.

> OBS: We can think of this `Workflow` execution as a `flatMap` implementation.

![base-workflow.workflow.drawio.png](https://raw.githubusercontent.com/open-metadata/docs-v1/refs/heads/main/public/images/readme/ingestion/base-workflow.workflow.drawio.png)

Note how in theory, we can keep building the steps together.
