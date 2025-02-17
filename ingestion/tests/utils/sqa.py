"""SQLAlchemy utilities for testing purposes."""

from typing import Sequence

from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import Session, declarative_base
from sqlalchemy.orm.decl_api import DeclarativeMeta

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    fullname = Column(String(256))
    nickname = Column(String(256))
    age = Column(Integer)


class UserWithLongName(Base):
    __tablename__ = "u" * 63  # Keep a max length name of 63 chars (max for Postgres)
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    fullname = Column(String(256))
    nickname = Column(String(256))
    age = Column(Integer)


class SQATestUtils:
    def __init__(self, connection_url: str):
        self.connection_url = connection_url
        self.engine = create_engine(connection_url)
        self.session = Session(self.engine)

    def load_data(self, data: Sequence[DeclarativeMeta]):
        """load data into the database using sqlalchemy ORM

        Args:
            data List[DeclarativeMeta]: list of ORM objects to load
        """
        self.session.add_all(data)
        self.session.commit()

    def load_user_data(self):
        for clz in (User, UserWithLongName):
            data = [
                clz(name="John", fullname="John Doe", nickname="johnny b goode", age=30),  # type: ignore
                clz(name="Jane", fullname="Jone Doe", nickname=None, age=31),  # type: ignore
            ] * 20
            self.load_data(data)

    def create_user_table(self):
        User.__table__.create(bind=self.session.get_bind())
        UserWithLongName.__table__.create(bind=self.session.get_bind())

    def close(self):
        self.session.close()
        self.engine.dispose()
