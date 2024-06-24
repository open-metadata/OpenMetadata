from typing import Callable, List

import pytest
from pandas import DataFrame, Series


class Assumption:
    def __init__(self):
        self.not_ = False

    def validate(self, df: DataFrame):
        if self.not_:
            self.assume_false(df)
        else:
            self.assume_positive(df)

    def __invert__(self):
        return self.copy(not_=not self.not_)

    def assume_positive(self, df: DataFrame):
        raise NotImplementedError

    def assume_false(self, df: DataFrame):
        with pytest.raises(AssertionError):
            self.assume_positive(df)

    def copy(self, **kwargs):
        new = self.__class__.__new__(self.__class__)
        new.__dict__.update(self.__dict__)
        new.__dict__.update(kwargs)
        return new


class AssumeUnqiue(Assumption):
    def __init__(self, column: str):
        super().__init__()
        self.column = column

    def assume_positive(self, df: DataFrame):
        assert df[self.column].nunique() == len(df)


class AssumeNotNull(Assumption):
    def __init__(self, column: str):
        super().__init__()
        self.column = column

    def assume_positive(self, df: DataFrame):
        assert df[self.column].notnull().all()


class AssumeMatchRegex(Assumption):
    def __init__(self, column: str, regex: str):
        super().__init__()
        self.column = column
        self.regex = regex

    def assume_positive(self, df: DataFrame):
        assert df[self.column].str.match(self.regex).all()


class AssumeBetween(Assumption):
    def __init__(self, column: str, min_value: int, max_value: int):
        super().__init__()
        self.column = column
        self.min_value = min_value
        self.max_value = max_value

    def assume_positive(self, df: DataFrame):
        assert (df[self.column] >= self.min_value).all()
        assert (df[self.column] <= self.max_value).all()


class AssumeLengthBetween(Assumption):
    def __init__(self, column: str, min_length: int, max_length: int):
        super().__init__()
        self.column = column
        self.min_length = min_length
        self.max_length = max_length

    def assume_positive(self, df: DataFrame):
        assert (df[self.column].str.len() >= self.min_length).all()
        assert (df[self.column].str.len() <= self.max_length).all()


class AssumeColumnValuesIn(Assumption):
    def __init__(self, column: str, allowed_values: List[str]):
        super().__init__()
        self.column = column
        self.allowed_values = allowed_values

    def assume_positive(self, df: DataFrame):
        assert df[self.column].isin(self.allowed_values).all()


class AssumeArbitrary(Assumption):
    def __init__(self, column: str, fn: Callable[[Series], Series]):
        super().__init__()
        self.column = column
        self.fn = fn

    def assume_positive(self, df: DataFrame):
        assert self.fn(
            df[self.column]
        ).all(), f"failed test {self.__class__.__name__} for column {self.column}"


class Assumptions:
    notnull = AssumeNotNull
    unique = AssumeUnqiue
    match_regex = AssumeMatchRegex
    between = AssumeBetween
    length_between = AssumeLengthBetween
    column_values_in = AssumeColumnValuesIn
    arbitrary = AssumeArbitrary


assume = Assumptions()
