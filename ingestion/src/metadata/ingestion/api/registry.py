#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import importlib
import inspect
from typing import Dict, Generic, Type, TypeVar, Union

import pkg_resources
import typing_inspect

from metadata.config.common import ConfigurationError

T = TypeVar("T")


class Registry(Generic[T]):
    def __init__(self):
        self._mapping: Dict[str, Union[Type[T], Exception]] = {}

    def _get_registered_type(self) -> Type[T]:
        cls = typing_inspect.get_generic_type(self)
        tp = typing_inspect.get_args(cls)[0]
        return tp

    def _check_cls(self, cls: Type[T]):
        if inspect.isabstract(cls):
            raise ValueError(
                f"cannot register an abstract type in the registry; got {cls}"
            )
        super_cls = self._get_registered_type()
        if not issubclass(cls, super_cls):
            raise ValueError(f"must be derived from {super_cls}; got {cls}")

    def _register(self, key: str, tp: Union[Type[T], Exception]) -> None:
        if key in self._mapping:
            raise KeyError(f"key already in use - {key}")
        if key.find(".") >= 0:
            raise KeyError(f"key cannot contain '.' - {key}")
        self._mapping[key] = tp

    def register(self, key: str, cls: Type[T]) -> None:
        self._check_cls(cls)
        self._register(key, cls)

    def register_disabled(self, key: str, reason: Exception) -> None:
        self._register(key, reason)

    def is_enabled(self, key: str) -> bool:
        tp = self._mapping[key]
        return not isinstance(tp, Exception)

    def load(self, entry_point_key: str) -> None:
        for entry_point in pkg_resources.iter_entry_points(entry_point_key):
            name = entry_point.name

            try:
                plugin_class = entry_point.load()
            except ImportError as e:
                self.register_disabled(name, e)
                continue

            self.register(name, plugin_class)

    @property
    def mapping(self):
        return self._mapping

    def get(self, key: str) -> Type[T]:
        if key.find(".") >= 0:
            # If the key contains a dot, we treat it as a import path and attempt
            # to load it dynamically.
            module_name, class_name = key.rsplit(".", 1)
            MyClass = getattr(importlib.import_module(module_name), class_name)
            self._check_cls(MyClass)
            return MyClass

        if key not in self._mapping:
            raise KeyError(f"Did not find a registered class for {key}")
        tp = self._mapping[key]
        if isinstance(tp, Exception):
            raise ConfigurationError(
                f'{key} is disabled; try running: pip install ".[{key}]"'
            ) from tp
        else:
            # If it's not an exception, then it's a registered type.
            return tp

    def __str__(self):
        col_width = 15
        return "\n".join(
            f"{key}{'' if self.is_enabled(key) else (' ' * (col_width - len(key))) + '(disabled)'}"
            for key in sorted(self._mapping.keys())
        )
