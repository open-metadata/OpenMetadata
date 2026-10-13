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
"""Unit tests for `RepeatedTimer.stop()` safety.

`RepeatedTimer.stop()` is called from `BaseWorkflow.stop()`, which runs on
every workflow teardown. The timer thread is only started by `trigger()`; if
`trigger()` was never called (standalone `stop()`) or raised before
`Thread.start()` succeeded, `stop()` must not raise on `Thread.join()`.
"""

from metadata.timer.repeated_timer import RepeatedTimer


def test_stop_on_unstarted_timer_does_not_raise():
    """Calling `stop()` without first calling `trigger()` must not raise
    `RuntimeError: cannot join thread before it is started`."""
    timer = RepeatedTimer(interval=30, function=lambda: None)

    timer.stop()  # must not raise

    assert timer.event.is_set()


def test_stop_after_trigger_joins_started_thread():
    """After `trigger()` starts the thread, `stop()` unblocks the worker via
    the event and joins it, so the thread is no longer alive once `stop()`
    returns."""
    timer = RepeatedTimer(interval=30, function=lambda: None)
    timer.trigger()

    assert timer.thread.is_alive()  # confirms the join path is exercised

    timer.stop()  # must not raise; joins the started thread

    assert not timer.thread.is_alive()
    assert timer.event.is_set()


def test_stop_is_idempotent():
    """`stop()` may be called multiple times (e.g. once from `execute()`'s
    finally and again from `execute_workflow`'s finally); it must not raise
    on the second call."""
    timer = RepeatedTimer(interval=30, function=lambda: None)
    timer.trigger()

    timer.stop()
    timer.stop()  # must not raise

    assert not timer.thread.is_alive()
