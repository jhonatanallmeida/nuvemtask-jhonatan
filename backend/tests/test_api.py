from dataclasses import replace

from app.main import settings


def create_account(client, email="ana@example.com", name="Ana Silva"):
    response = client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": "senha-segura-123"},
    )
    assert response.status_code == 201
    return response.json()


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_register_login_and_read_profile(client):
    account = create_account(client)
    assert account["user"]["email"] == "ana@example.com"
    assert account["user"]["role"] == "user"

    login = client.post(
        "/api/auth/login",
        json={"email": " ANA@example.com ", "password": "senha-segura-123"},
    )
    assert login.status_code == 200
    profile = client.get("/api/me", headers=auth(login.json()["access_token"]))
    assert profile.status_code == 200
    assert profile.json()["name"] == "Ana Silva"


def test_project_and_task_crud(client):
    account = create_account(client)
    headers = auth(account["access_token"])

    created_project = client.post(
        "/api/projects",
        headers=headers,
        json={"name": "Projeto Aurora", "description": "Planejamento do semestre"},
    )
    assert created_project.status_code == 201
    project_id = created_project.json()["id"]
    assert len(client.get("/api/projects", headers=headers).json()) == 1

    updated_project = client.patch(
        f"/api/projects/{project_id}",
        headers=headers,
        json={"name": "Projeto Aurora 2"},
    )
    assert updated_project.json()["name"] == "Projeto Aurora 2"

    created_task = client.post(
        f"/api/projects/{project_id}/tasks",
        headers=headers,
        json={"title": "Mapear requisitos", "description": "Revisar a proposta"},
    )
    assert created_task.status_code == 201
    task_id = created_task.json()["id"]
    assert len(client.get(f"/api/projects/{project_id}/tasks", headers=headers).json()) == 1

    updated_task = client.patch(
        f"/api/tasks/{task_id}",
        headers=headers,
        json={"status": "concluida"},
    )
    assert updated_task.json()["status"] == "concluida"
    assert client.get(f"/api/tasks/{task_id}", headers=headers).status_code == 200
    assert client.delete(f"/api/tasks/{task_id}", headers=headers).status_code == 204
    assert client.delete(f"/api/projects/{project_id}", headers=headers).status_code == 204
    assert client.get("/api/projects", headers=headers).json() == []


def test_authentication_validation_and_project_privacy(client):
    owner = create_account(client)
    outsider = create_account(client, "bia@example.com", "Bia Costa")
    project = client.post(
        "/api/projects",
        headers=auth(owner["access_token"]),
        json={"name": "Projeto privado"},
    ).json()

    assert client.get("/api/projects").status_code == 401
    assert client.get(
        f"/api/projects/{project['id']}", headers=auth(outsider["access_token"])
    ).status_code == 403
    assert client.post(
        "/api/auth/register",
        json={"name": "Inválido", "email": "sem-email", "password": "12345678"},
    ).status_code == 422
    assert client.post(
        "/api/auth/register",
        json={"name": "Ana Silva", "email": "ana@example.com", "password": "senha-segura-123"},
    ).status_code == 409


def test_admin_role_can_list_users_and_projects(client, monkeypatch):
    monkeypatch.setattr(
        "app.main.settings", replace(settings, admin_email="admin@example.com")
    )
    regular = create_account(client)
    admin = create_account(client, "admin@example.com", "Conta Admin")
    assert admin["user"]["role"] == "admin"
    assert client.get("/api/admin/users", headers=auth(regular["access_token"])).status_code == 403

    client.post(
        "/api/projects",
        headers=auth(regular["access_token"]),
        json={"name": "Projeto da Ana"},
    )
    users = client.get("/api/admin/users", headers=auth(admin["access_token"]))
    projects = client.get("/api/projects", headers=auth(admin["access_token"]))
    assert users.status_code == 200 and len(users.json()) == 2
    assert projects.status_code == 200 and len(projects.json()) == 1
