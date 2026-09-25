import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


@pytest.fixture
def client():
    test_engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        from sqlalchemy.orm import Session

        with Session(test_engine, expire_on_commit=False) as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()


def create_account(client, email="ana@example.com", name="Ana Silva"):
    response = client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": "senha-segura-123"},
    )
    assert response.status_code == 201
    return response.json()
