import pytest

from metadata.utils.collaborative_super import Root


def test_collaborative_super():
    class A(Root):
        pass

    class B(A):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.b = 2

    class C(B):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.num = kwargs["num"]

    c = C(num=10)
    assert c.num == 10


def test_without_collaborative_super():
    class A:
        pass

    class B(A):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.b = 2

    class C(B):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.num = kwargs["num"]

    with pytest.raises(TypeError):
        C(num=10)
