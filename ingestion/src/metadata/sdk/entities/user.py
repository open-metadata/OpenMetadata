"""
User entity with fluent API
"""
import asyncio
from typing import ClassVar, Dict, Iterator, List, Optional, Union

from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.teams.user import User as UserEntity
from metadata.ingestion.ometa.ometa_api import OpenMetadata as OMeta
from metadata.sdk.client import OpenMetadata


class User:
    """User entity with static fluent API methods"""

    _default_client: ClassVar[Optional[OMeta]] = None

    @classmethod
    def set_default_client(cls, client: Union[OpenMetadata, OMeta]):
        """Set the default client for static methods"""
        if isinstance(client, OpenMetadata):
            cls._default_client = client.ometa
        else:
            cls._default_client = client

    @classmethod
    def _get_client(cls) -> OMeta:
        """Get the default client"""
        if cls._default_client is None:
            cls._default_client = OpenMetadata.get_default_client()
        return cls._default_client

    @classmethod
    def create(cls, request: CreateUserRequest) -> UserEntity:
        """Create a new user"""
        client = cls._get_client()
        return client.create_or_update(request)

    @classmethod
    def retrieve(cls, user_id: str, fields: Optional[List[str]] = None) -> UserEntity:
        """Retrieve a user by ID"""
        client = cls._get_client()
        return client.get_by_id(entity=UserEntity, entity_id=user_id, fields=fields)

    @classmethod
    def retrieve_by_name(
        cls, name: str, fields: Optional[List[str]] = None
    ) -> UserEntity:
        """Retrieve a user by name"""
        client = cls._get_client()
        return client.get_by_name(entity=UserEntity, fqn=name, fields=fields)

    @classmethod
    def list(cls, params: Optional["UserListParams"] = None) -> "UserCollection":
        """List users with optional parameters"""
        return UserCollection(cls._get_client(), params)

    @classmethod
    def update(cls, user_id: str, user: UserEntity) -> UserEntity:
        """Update a user"""
        client = cls._get_client()
        user.id = user_id
        return client.create_or_update(user)

    @classmethod
    def patch(cls, user_id: str, json_patch: List[Dict]) -> UserEntity:
        """Apply JSON patch to a user"""
        client = cls._get_client()
        return client.patch(entity=UserEntity, entity_id=user_id, json_patch=json_patch)

    @classmethod
    def delete(cls, user_id: str, recursive: bool = False, hard_delete: bool = False):
        """Delete a user"""
        client = cls._get_client()
        client.delete(entity=UserEntity, entity_id=user_id, recursive=recursive, hard_delete=hard_delete)

    @classmethod
    async def create_async(cls, request: CreateUserRequest) -> UserEntity:
        """Async create a user"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls.create, request)

    @classmethod
    async def retrieve_async(
        cls, user_id: str, fields: Optional[List[str]] = None
    ) -> UserEntity:
        """Async retrieve a user"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls.retrieve, user_id, fields)

    @classmethod
    async def delete_async(
        cls, user_id: str, recursive: bool = False, hard_delete: bool = False
    ):
        """Async delete a user"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls.delete, user_id, recursive, hard_delete)


class UserCollection:
    """Collection of users with iteration support"""

    def __init__(self, client: OMeta, params: Optional["UserListParams"] = None):
        self.client = client
        self.params = params or UserListParams()

    def get_data(self) -> List[UserEntity]:
        """Get the current page of data"""
        return self.client.list_entities(
            entity=UserEntity,
            limit=self.params.limit,
            before=self.params.before,
            after=self.params.after,
            fields=self.params.fields,
            params=self.params.to_dict(),
        ).entities

    def auto_paging_iterable(self) -> Iterator[UserEntity]:
        """Return an iterator that automatically pages through results"""
        after = self.params.after
        while True:
            response = self.client.list_entities(
                entity=UserEntity,
                limit=self.params.limit,
                before=self.params.before,
                after=after,
                fields=self.params.fields,
                params=self.params.to_dict(),
            )
            
            for entity in response.entities:
                yield entity
            
            if not response.paging or not response.paging.after:
                break
            
            after = response.paging.after


class UserListParams:
    """Parameters for listing users"""

    def __init__(
        self,
        limit: int = 10,
        before: Optional[str] = None,
        after: Optional[str] = None,
        fields: Optional[List[str]] = None,
        team: Optional[str] = None,
        is_admin: Optional[bool] = None,
        is_bot: Optional[bool] = None,
    ):
        self.limit = limit
        self.before = before
        self.after = after
        self.fields = fields
        self.team = team
        self.is_admin = is_admin
        self.is_bot = is_bot

    @classmethod
    def builder(cls):
        """Create a parameters builder"""
        return UserListParamsBuilder()

    def to_dict(self) -> Dict:
        """Convert to dictionary for API call"""
        params = {}
        if self.team:
            params["team"] = self.team
        if self.is_admin is not None:
            params["isAdmin"] = self.is_admin
        if self.is_bot is not None:
            params["isBot"] = self.is_bot
        return params


class UserListParamsBuilder:
    """Builder for user list parameters"""

    def __init__(self):
        self._limit = 10
        self._before = None
        self._after = None
        self._fields = None
        self._team = None
        self._is_admin = None
        self._is_bot = None

    def limit(self, limit: int):
        """Set result limit"""
        self._limit = limit
        return self

    def before(self, before: str):
        """Set before cursor"""
        self._before = before
        return self

    def after(self, after: str):
        """Set after cursor"""
        self._after = after
        return self

    def fields(self, fields: List[str]):
        """Set fields to include"""
        self._fields = fields
        return self

    def team(self, team: str):
        """Filter by team"""
        self._team = team
        return self

    def is_admin(self, is_admin: bool):
        """Filter by admin status"""
        self._is_admin = is_admin
        return self

    def is_bot(self, is_bot: bool):
        """Filter by bot status"""
        self._is_bot = is_bot
        return self

    def build(self) -> UserListParams:
        """Build parameters"""
        return UserListParams(
            limit=self._limit,
            before=self._before,
            after=self._after,
            fields=self._fields,
            team=self._team,
            is_admin=self._is_admin,
            is_bot=self._is_bot,
        )