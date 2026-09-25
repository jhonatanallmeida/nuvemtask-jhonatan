import logging
import time
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .config import settings
from .database import Base, engine, get_db
from .models import Project, Task, User
from .schemas import (
    LoginInput,
    ProjectInput,
    ProjectPatch,
    ProjectPublic,
    TaskInput,
    TaskPatch,
    TaskPublic,
    TokenOutput,
    UserCreate,
    UserPublic,
)
from .security import create_access_token, decode_access_token, hash_password, verify_password


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("nuvemtask.api")
bearer = HTTPBearer(auto_error=False)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="NuvemTask API",
    description="API REST para gerenciar projetos e tarefas com perfis usuário e administrador.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def access_log(request: Request, call_next):
    request_id = str(uuid4())
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            "request_error request_id=%s method=%s path=%s",
            request_id,
            request.method,
            request.url.path,
        )
        response = JSONResponse(
            status_code=500,
            content={"detail": "Ocorreu um erro interno. Tente novamente."},
        )
    elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "request request_id=%s method=%s path=%s status=%s duration_ms=%s",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = decode_access_token(credentials.credentials)
    user = db.get(User, user_id) if user_id else None
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def accessible_project(db: Session, project_id: str, user: User) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")
    if user.role != "admin" and project.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Você não tem acesso a este projeto.")
    return project


def accessible_task(db: Session, task_id: str, user: User) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada.")
    accessible_project(db, task.project_id, user)
    return task


@app.get("/healthz", tags=["Operação"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post(
    "/api/auth/register",
    response_model=TokenOutput,
    status_code=status.HTTP_201_CREATED,
    tags=["Autenticação"],
    summary="Criar conta",
)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> TokenOutput:
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status_code=409, detail="Este e-mail já possui uma conta.")
    role = "admin" if settings.admin_email and payload.email == settings.admin_email else "user"
    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=role,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Este e-mail já possui uma conta.")
    db.refresh(user)
    return TokenOutput(access_token=create_access_token(user.id), user=user)


@app.post(
    "/api/auth/login",
    response_model=TokenOutput,
    tags=["Autenticação"],
    summary="Entrar",
)
def login(payload: LoginInput, db: Session = Depends(get_db)) -> TokenOutput:
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")
    return TokenOutput(access_token=create_access_token(user.id), user=user)


@app.get("/api/me", response_model=UserPublic, tags=["Autenticação"])
def read_me(user: User = Depends(current_user)) -> User:
    return user


@app.get("/api/admin/users", response_model=list[UserPublic], tags=["Administração"])
def list_users(
    user: User = Depends(current_user), db: Session = Depends(get_db)
) -> list[User]:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso exclusivo para administradores.")
    return list(db.scalars(select(User).order_by(User.created_at.desc())).all())


@app.get("/api/projects", response_model=list[ProjectPublic], tags=["Projetos"])
def list_projects(
    user: User = Depends(current_user), db: Session = Depends(get_db)
) -> list[Project]:
    query = select(Project).order_by(Project.created_at.desc())
    if user.role != "admin":
        query = query.where(Project.owner_id == user.id)
    return list(db.scalars(query).all())


@app.post(
    "/api/projects",
    response_model=ProjectPublic,
    status_code=status.HTTP_201_CREATED,
    tags=["Projetos"],
)
def create_project(
    payload: ProjectInput,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Project:
    project = Project(owner_id=user.id, name=payload.name, description=payload.description)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@app.get("/api/projects/{project_id}", response_model=ProjectPublic, tags=["Projetos"])
def get_project(
    project_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Project:
    return accessible_project(db, project_id, user)


@app.patch("/api/projects/{project_id}", response_model=ProjectPublic, tags=["Projetos"])
def update_project(
    project_id: str,
    payload: ProjectPatch,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Project:
    project = accessible_project(db, project_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


@app.delete(
    "/api/projects/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Projetos"],
)
def delete_project(
    project_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> None:
    project = accessible_project(db, project_id, user)
    db.delete(project)
    db.commit()


@app.get(
    "/api/projects/{project_id}/tasks", response_model=list[TaskPublic], tags=["Tarefas"]
)
def list_tasks(
    project_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[Task]:
    accessible_project(db, project_id, user)
    query = select(Task).where(Task.project_id == project_id).order_by(Task.created_at.desc())
    return list(db.scalars(query).all())


@app.post(
    "/api/projects/{project_id}/tasks",
    response_model=TaskPublic,
    status_code=status.HTTP_201_CREATED,
    tags=["Tarefas"],
)
def create_task(
    project_id: str,
    payload: TaskInput,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Task:
    accessible_project(db, project_id, user)
    task = Task(project_id=project_id, **payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.get("/api/tasks/{task_id}", response_model=TaskPublic, tags=["Tarefas"])
def get_task(
    task_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Task:
    return accessible_task(db, task_id, user)


@app.patch("/api/tasks/{task_id}", response_model=TaskPublic, tags=["Tarefas"])
def update_task(
    task_id: str,
    payload: TaskPatch,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Task:
    task = accessible_task(db, task_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None or field == "due_date":
            setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task


@app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Tarefas"])
def delete_task(
    task_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> None:
    task = accessible_task(db, task_id, user)
    db.delete(task)
    db.commit()
