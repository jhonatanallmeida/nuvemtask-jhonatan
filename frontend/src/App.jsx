import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api.js'

const initialSession = () => {
  try {
    return JSON.parse(sessionStorage.getItem('nuvemtask-session') || 'null')
  } catch {
    return null
  }
}

function App() {
  const [session, setSession] = useState(initialSession)
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [adminUsers, setAdminUsers] = useState([])
  const [view, setView] = useState('projects')
  const [selectedId, setSelectedId] = useState(null)
  const [modal, setModal] = useState(null)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const user = session?.user
  const token = session?.access_token
  const selectedProject = projects.find((project) => project.id === selectedId) || null

  const loadProjects = useCallback(async (activeToken = token) => {
    if (!activeToken) return
    const items = await api('/api/projects', { token: activeToken })
    setProjects(items)
    setSelectedId((current) => (items.some((project) => project.id === current) ? current : items[0]?.id || null))
    return items
  }, [token])

  const loadTasks = useCallback(async (projectId, activeToken = token) => {
    if (!projectId || !activeToken) {
      setTasks([])
      return
    }
    setTasks(await api(`/api/projects/${projectId}/tasks`, { token: activeToken }))
  }, [token])

  useEffect(() => {
    if (!token) return
    loadProjects().catch((problem) => {
      setError(problem.message)
      if (problem.message.includes('Token')) signOut()
    })
  }, [token, loadProjects])

  useEffect(() => {
    if (selectedId) loadTasks(selectedId).catch((problem) => setError(problem.message))
    else setTasks([])
  }, [selectedId, loadTasks])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 2800)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const filteredProjects = useMemo(() => {
    const text = query.trim().toLowerCase()
    return projects.filter((project) => `${project.name} ${project.description}`.toLowerCase().includes(text))
  }, [projects, query])

  const allTasks = tasks.length
  const completedTasks = tasks.filter((task) => task.status === 'concluida').length
  const progress = allTasks ? Math.round((completedTasks / allTasks) * 100) : 0

  function signOut() {
    sessionStorage.removeItem('nuvemtask-session')
    setSession(null)
    setProjects([])
    setTasks([])
    setSelectedId(null)
  }

  function saveSession(value) {
    sessionStorage.setItem('nuvemtask-session', JSON.stringify(value))
    setSession(value)
    setError('')
  }

  async function submitProject(values) {
    setBusy(true)
    try {
      if (modal?.kind === 'edit-project') {
        const updated = await api(`/api/projects/${modal.item.id}`, {
          token, method: 'PATCH', body: JSON.stringify(values),
        })
        setProjects((items) => items.map((item) => item.id === updated.id ? updated : item))
        setNotice('Projeto atualizado.')
      } else {
        const created = await api('/api/projects', {
          token, method: 'POST', body: JSON.stringify(values),
        })
        setProjects((items) => [created, ...items])
        setSelectedId(created.id)
        setNotice('Projeto criado.')
      }
      setModal(null)
    } catch (problem) {
      setError(problem.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeProject(project) {
    if (!window.confirm(`Excluir o projeto “${project.name}” e todas as tarefas?`)) return
    try {
      await api(`/api/projects/${project.id}`, { token, method: 'DELETE' })
      const next = projects.filter((item) => item.id !== project.id)
      setProjects(next)
      setSelectedId(next[0]?.id || null)
      setNotice('Projeto excluído.')
    } catch (problem) {
      setError(problem.message)
    }
  }

  async function submitTask(values) {
    setBusy(true)
    try {
      if (modal?.kind === 'edit-task') {
        await api(`/api/tasks/${modal.item.id}`, {
          token, method: 'PATCH', body: JSON.stringify(values),
        })
        setNotice('Tarefa atualizada.')
      } else {
        await api(`/api/projects/${selectedId}/tasks`, {
          token, method: 'POST', body: JSON.stringify(values),
        })
        setNotice('Tarefa criada.')
      }
      await loadTasks(selectedId)
      setModal(null)
    } catch (problem) {
      setError(problem.message)
    } finally {
      setBusy(false)
    }
  }

  async function changeTaskStatus(task, status) {
    try {
      const updated = await api(`/api/tasks/${task.id}`, {
        token, method: 'PATCH', body: JSON.stringify({ status }),
      })
      setTasks((items) => items.map((item) => item.id === task.id ? updated : item))
    } catch (problem) {
      setError(problem.message)
    }
  }

  async function removeTask(task) {
    if (!window.confirm(`Excluir a tarefa “${task.title}”?`)) return
    try {
      await api(`/api/tasks/${task.id}`, { token, method: 'DELETE' })
      setTasks((items) => items.filter((item) => item.id !== task.id))
      setNotice('Tarefa excluída.')
    } catch (problem) {
      setError(problem.message)
    }
  }

  async function showAdminUsers() {
    setError('')
    setView('admin')
    try {
      setAdminUsers(await api('/api/admin/users', { token }))
    } catch (problem) {
      setError(problem.message)
    }
  }

  if (!session) return <AuthScreen onSuccess={saveSession} />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#inicio" aria-label="NuvemTask início">
          <span className="brand-mark"><span /></span>
          <span>Nuvem<span className="brand-light">Task</span></span>
        </a>
        <div className="workspace-label">ESPAÇO DE TRABALHO</div>
        <div className="workspace-switcher">
          <span className="workspace-icon">N</span>
          <span><strong>Meu espaço</strong><small>Plano pessoal</small></span>
          <span className="switch-caret">⌄</span>
        </div>
        <div className="nav-caption">MENU</div>
        <nav className="side-nav" aria-label="Navegação principal">
          <button className={`nav-link ${view === 'projects' ? 'active' : ''}`} onClick={() => setView('projects')}><span className="nav-icon">▦</span>Projetos<span className="nav-count">{projects.length}</span></button>
          <a className="nav-link" href="#tarefas" onClick={() => setView('projects')}><span className="nav-icon">☷</span>Minhas tarefas</a>
          {user.role === 'admin' && <button className={`nav-link ${view === 'admin' ? 'active' : ''}`} onClick={showAdminUsers}><span className="nav-icon">◈</span>Administração</button>}
        </nav>
        <div className="side-bottom">
          <div className="help-card"><span className="help-spark">✳</span><strong>Um passo de cada vez.</strong><p>Seu próximo projeto começa com uma ideia.</p></div>
          <div className="profile-row">
            <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
            <span className="profile-copy"><strong>{user.name}</strong><small>{user.role === 'admin' ? 'Administrador' : 'Membro'}</small></span>
            <button className="icon-button profile-menu" onClick={signOut} title="Sair" aria-label="Sair">↗</button>
          </div>
        </div>
      </aside>

      <main className="main-area" id="projetos">
        <header className="topbar">
            <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{view === 'admin' ? 'Administração' : 'Projetos'}</strong></div>
          <div className="topbar-right"><span className="today-label">Seu espaço, no seu ritmo</span><span className="avatar avatar-small">{user.name.slice(0, 1).toUpperCase()}</span></div>
        </header>

        <section className="page-content">
          <div className="welcome-row">
            <div><div className="eyebrow"><span className="eyebrow-dot" /> SEU PAINEL DE CONTROLE</div><h1>Olá, {user.name.split(' ')[0]}<span className="wave">✳</span></h1><p className="page-subtitle">Transforme planos em progresso. O que vamos construir hoje?</p></div>
            <button className="primary-button" onClick={() => setModal({ kind: 'new-project' })}><span>＋</span> Novo projeto</button>
          </div>

          {(error || notice) && <div className={`toast ${error ? 'toast-error' : 'toast-success'}`} role="status"><span>{error ? '!' : '✓'}</span>{error || notice}<button onClick={() => { setError(''); setNotice('') }} aria-label="Fechar aviso">×</button></div>}

          <div className="metric-grid">
            <Metric label="Projetos ativos" value={projects.length} note="No seu espaço de trabalho" icon="▦" tone="mint" />
            <Metric label="Tarefas em foco" value={tasks.filter((task) => task.status !== 'concluida').length} note={selectedProject ? `Em ${selectedProject.name}` : 'Selecione um projeto'} icon="◷" tone="peach" />
            <Metric label="Progresso do projeto" value={`${progress}%`} note={`${completedTasks} de ${allTasks} tarefas concluídas`} icon="↗" tone="lavender" />
          </div>

          <div className="section-heading">
            <div><h2>{view === 'admin' ? 'Contas cadastradas' : 'Seus projetos'}</h2><p>{view === 'admin' ? 'Consulta de usuários disponível para o perfil administrador.' : 'Acompanhe as ideias que estão saindo do papel.'}</p></div>
            {view === 'projects' && <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar projeto" aria-label="Buscar projeto" /><kbd>⌘ K</kbd></label>}
          </div>

          {view === 'admin' ? <AdminUsersPanel users={adminUsers} /> : <div className="project-layout">
            <section className="project-list" aria-label="Lista de projetos">
              {filteredProjects.length ? filteredProjects.map((project, index) => (
                <button key={project.id} className={`project-card ${project.id === selectedId ? 'project-selected' : ''}`} onClick={() => setSelectedId(project.id)}>
                  <span className={`project-symbol symbol-${index % 4}`}>{project.name.slice(0, 1).toUpperCase()}</span>
                  <span className="project-card-copy"><strong>{project.name}</strong><small>{project.description || 'Sem descrição por enquanto'}</small></span>
                  <span className="project-arrow">↗</span>
                </button>
              )) : <div className="empty-projects"><span className="empty-icon">✳</span><strong>{query ? 'Nenhum resultado' : 'Tudo começa com uma ideia'}</strong><p>{query ? 'Tente outro termo de busca.' : 'Crie seu primeiro projeto e organize as tarefas por lá.'}</p>{!query && <button className="text-button" onClick={() => setModal({ kind: 'new-project' })}>Criar projeto <span>→</span></button>}</div>}
            </section>

            <section className="detail-panel" id="tarefas">
              {selectedProject ? <>
                <div className="detail-topline"><span className="status-pill"><i /> PROJETO EM FOCO</span><button className="more-button" onClick={() => setModal({ kind: 'edit-project', item: selectedProject })} aria-label="Editar projeto">•••</button></div>
                <div className="detail-title-row"><div><div className="detail-kicker">PROJETO SELECIONADO</div><h2>{selectedProject.name}</h2></div><span className="detail-mark">{selectedProject.name.slice(0, 1).toUpperCase()}</span></div>
                <p className="detail-description">{selectedProject.description || 'Adicione uma descrição para manter o objetivo deste projeto sempre à vista.'}</p>
                <div className="progress-block"><div className="progress-head"><span>Progresso</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><small>{completedTasks} concluídas <span>·</span> {allTasks - completedTasks} restantes</small></div>
                <div className="task-heading"><div><h3>Tarefas</h3><span className="task-count">{allTasks}</span></div><button className="small-add-button" onClick={() => setModal({ kind: 'new-task' })}>＋ Adicionar</button></div>
                <div className="task-list">
                  {tasks.length ? tasks.map((task) => <TaskRow key={task.id} task={task} onStatus={changeTaskStatus} onEdit={() => setModal({ kind: 'edit-task', item: task })} onDelete={() => removeTask(task)} />) : <div className="empty-tasks"><span>✳</span><p>Nenhuma tarefa ainda. Que tal definir o primeiro passo?</p><button className="text-button" onClick={() => setModal({ kind: 'new-task' })}>Adicionar tarefa <span>→</span></button></div>}
                </div>
                <div className="detail-footer"><span>Projeto criado em {formatDate(selectedProject.created_at)}</span><button className="delete-project" onClick={() => removeProject(selectedProject)}>Excluir projeto</button></div>
              </> : <div className="no-selection"><span className="empty-icon">◌</span><h2>Seu próximo capítulo começa aqui.</h2><p>Escolha um projeto para ver os detalhes ou crie um novo para dar forma à sua ideia.</p><button className="primary-button" onClick={() => setModal({ kind: 'new-project' })}>＋ Criar projeto</button></div>}
            </section>
          </div>}
          <footer className="page-footer"><span>NUVEMTASK <i>·</i> ORGANIZE COM LEVEZA</span><span>Feito para boas ideias ganharem espaço.</span></footer>
        </section>
      </main>

      {modal && <EditorModal modal={modal} busy={busy} onClose={() => setModal(null)} onSave={modal.kind.includes('project') ? submitProject : submitTask} />}
    </div>
  )
}

function Metric({ label, value, note, icon, tone }) {
  return <article className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><div className="metric-text"><span>{label}</span><strong>{value}</strong><small>{note}</small></div><span className="metric-arrow">↗</span></article>
}

function AdminUsersPanel({ users }) {
  return <section className="admin-panel" aria-label="Usuários cadastrados">
    <div className="admin-panel-heading"><span className="admin-panel-mark">◈</span><div><strong>Usuários da plataforma</strong><p>Dados básicos das contas cadastradas.</p></div><span className="admin-total">{users.length} {users.length === 1 ? 'conta' : 'contas'}</span></div>
    <div className="admin-user-list">{users.length ? users.map((account) => <article className="admin-user-row" key={account.id}><span className="avatar">{account.name.slice(0, 1).toUpperCase()}</span><div className="admin-user-copy"><strong>{account.name}</strong><small>{account.email}</small></div><span className={`role-badge ${account.role === 'admin' ? 'role-admin' : ''}`}>{account.role === 'admin' ? 'Administrador' : 'Usuário'}</span><small className="admin-joined">Desde {formatDate(account.created_at)}</small></article>) : <div className="admin-empty">Nenhuma conta cadastrada.</div>}</div>
    <p className="admin-note">A lista omite credenciais. Senhas nunca são exibidas pela API.</p>
  </section>
}

function TaskRow({ task, onStatus, onEdit, onDelete }) {
  const done = task.status === 'concluida'
  return <article className={`task-row ${done ? 'task-done' : ''}`}>
    <button className={`task-check ${done ? 'checked' : ''}`} onClick={() => onStatus(task, done ? 'pendente' : 'concluida')} aria-label={done ? 'Reabrir tarefa' : 'Concluir tarefa'}>{done ? '✓' : ''}</button>
    <div className="task-copy"><strong>{task.title}</strong>{task.description && <small>{task.description}</small>}<span className={`task-status status-${task.status}`}>{statusLabel(task.status)}</span></div>
    <div className="task-actions"><button className="icon-button" onClick={onEdit} aria-label="Editar tarefa">✎</button><button className="icon-button" onClick={onDelete} aria-label="Excluir tarefa">×</button></div>
  </article>
}

function AuthScreen({ onSuccess }) {
  const [mode, setMode] = useState('login')
  const [values, setValues] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login'
      const session = await api(endpoint, { method: 'POST', body: JSON.stringify(values) })
      onSuccess(session)
    } catch (problem) {
      setError(problem.message)
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-shell">
    <section className="auth-story">
      <a className="brand auth-brand" href="#inicio"><span className="brand-mark"><span /></span><span>Nuvem<span className="brand-light">Task</span></span></a>
      <div className="story-content"><span className="story-overline">UM ESPAÇO PARA SUAS IDEIAS</span><h1>Menos correria.<br /><em>Mais caminho.</em></h1><p>Um lugar tranquilo para dar clareza aos seus projetos e avançar um passo de cada vez.</p><div className="story-orbit"><span className="orbit-line orbit-one" /><span className="orbit-line orbit-two" /><span className="orbit-center">✳</span><span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" /><span className="orbit-dot dot-three" /></div></div>
      <div className="story-note"><span>✦</span> Toda grande entrega começou com uma pequena tarefa.</div>
    </section>
    <section className="auth-form-side"><div className="auth-form-wrap"><div className="auth-mobile-brand"><span className="brand-mark"><span /></span> NuvemTask</div><span className="auth-kicker">BEM-VINDO DE VOLTA</span><h2>{mode === 'login' ? 'Bom ter você por aqui.' : 'Vamos começar juntos.'}</h2><p className="auth-subtitle">{mode === 'login' ? 'Entre para continuar de onde parou.' : 'Crie sua conta e tire a primeira ideia do papel.'}</p>
      <div className="auth-tabs"><button className={mode === 'login' ? 'tab-active' : ''} onClick={() => { setMode('login'); setError('') }}>Entrar</button><button className={mode === 'register' ? 'tab-active' : ''} onClick={() => { setMode('register'); setError('') }}>Criar conta</button></div>
      <form className="auth-form" onSubmit={submit}>{mode === 'register' && <label>Seu nome<input required minLength="2" maxLength="80" autoComplete="name" placeholder="Como podemos chamar você?" value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} /></label>}<label>E-mail<input required type="email" autoComplete="email" placeholder="voce@exemplo.com" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} /></label><label>Senha<input required minLength="8" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Mínimo de 8 caracteres" value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })} /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="auth-submit" disabled={busy}>{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar no meu espaço' : 'Criar minha conta'}<span>→</span></button></form>
      <div className="auth-security"><span>◇</span> Seus projetos são privados e protegidos.</div><div className="auth-legal">Ao continuar, você concorda em usar o NuvemTask com responsabilidade.</div></div></section>
  </main>
}

function EditorModal({ modal, busy, onClose, onSave }) {
  const editingProject = modal.kind.includes('project')
  const item = modal.item || {}
  const [values, setValues] = useState(editingProject
    ? { name: item.name || '', description: item.description || '' }
    : { title: item.title || '', description: item.description || '', status: item.status || 'pendente', due_date: item.due_date || '' })

  function submit(event) {
    event.preventDefault()
    const result = { ...values }
    if (!editingProject && !result.due_date) result.due_date = null
    onSave(result)
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={onClose} aria-label="Fechar">×</button><span className="modal-kicker">{editingProject ? 'ORGANIZE SUA VISÃO' : 'UM PASSO DE CADA VEZ'}</span><h2 id="modal-title">{modal.kind === 'edit-project' ? 'Ajustar projeto' : modal.kind === 'new-project' ? 'Novo projeto' : modal.kind === 'edit-task' ? 'Editar tarefa' : 'Nova tarefa'}</h2><p>{editingProject ? 'Dê um nome e um contexto para esta ideia.' : 'Defina o próximo movimento deste projeto.'}</p>
    <form onSubmit={submit} className="editor-form">{editingProject ? <><label>Nome do projeto<input autoFocus required minLength="2" maxLength="100" value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} placeholder="Ex.: Portfólio de projetos" /></label><label>Descrição<textarea maxLength="600" rows="3" value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} placeholder="Qual é o objetivo deste projeto?" /></label></> : <><label>Título da tarefa<input autoFocus required minLength="2" maxLength="120" value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} placeholder="Ex.: Definir as próximas etapas" /></label><label>Descrição<textarea maxLength="1000" rows="3" value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} placeholder="Detalhes que ajudam a começar…" /></label><div className="form-two-cols"><label>Status<select value={values.status} onChange={(event) => setValues({ ...values, status: event.target.value })}><option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option><option value="concluida">Concluída</option></select></label><label>Prazo<input type="date" value={values.due_date} onChange={(event) => setValues({ ...values, due_date: event.target.value })} /></label></div></>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button></div></form>
    </section></div>
}

function statusLabel(status) {
  return ({ pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída' })[status] || status
}

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

export default App
