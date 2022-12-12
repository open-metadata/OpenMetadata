#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Helper that implements custom dispatcher logic
"""

from collections import namedtuple
from functools import update_wrapper
from types import MappingProxyType
from typing import Any, Callable, Type, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


def enum_register():
    """
    Helps us register custom function for enum values
    """
    registry = {}

    def add(name: str):
        def inner(fn):
            registry[name] = fn
            return fn

        return inner

    Register = namedtuple("Register", ["add", "registry"])
    return Register(add, registry)


def class_register():
    """
    Helps us register custom functions for classes based on their name
    """
    registry = {}

    def add(entity_type: Type[T]):
        def inner(fn):
            _name = entity_type.__name__
            registry[_name] = fn
            return fn

        return inner

    Register = namedtuple("Register", ["add", "registry"])
    return Register(add, registry)


def valuedispatch(func) -> Callable:
    """Value dispatch for methods and functions

    Args:
        func (_type_): function to run

    Returns:
        Callable: wrapper
    """

    registry = {}

    def _is_valid_dispatch(value):
        return isinstance(value, str)

    def dispatch(value: str) -> Callable:
        try:
            impl = registry[value]
        except KeyError:
            impl = registry[object]
        return impl

    def register(value, func=None) -> Callable:
        if _is_valid_dispatch(value):
            if func is None:
                return lambda f: register(value, f)
        else:
            raise TypeError(
                "Invalid first argument to reigister()." f"{value} is not a string."
            )

        registry[value] = func
        return func

    def wrapper(*args, **kwargs) -> Any:
        if not args:
            raise TypeError(f"{func_name} requires at least 1 argument")
        if isinstance(args[0], str):
            return dispatch(args[0])(*args, **kwargs)
        return dispatch(args[1])(*args, **kwargs)

    func_name = getattr(func, "__name__", "method value dispatch")
    registry[object] = func
    wrapper.register = register
    wrapper.dispatch = dispatch
    wrapper.registry = MappingProxyType(registry)  # making registry read only
    update_wrapper(wrapper, func)
    return wrapper
