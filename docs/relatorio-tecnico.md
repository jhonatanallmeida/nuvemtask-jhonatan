# Relatório técnico NuvemTask

**Curso:** Análise e Desenvolvimento de Sistemas / IA (EAD — Unifor)  
**Atividade:** Desenvolvimento de Software em Nuvem  
**Integrante:** Jhonatan Almeida  
**Data:** setembro de 2026

## 1. Visão geral

O NuvemTask é uma aplicação web para organizar projetos e acompanhar tarefas por status. A pessoa usuária cria uma conta, mantém projetos privados e registra tarefas com descrição, prazo e situação. O perfil administrador pode consultar os usuários e os projetos cadastrados. O sistema foi construído em camadas: interface React, API REST FastAPI e banco PostgreSQL gerenciado. A aplicação está publicada no Render desde 25/09/2026; o repositório público e as URLs de produção são apresentados na seção de implantação.

## 2. Arquitetura em nuvem

```mermaid
flowchart LR
  U[Usuário] -->|HTTPS| FE[React + Vite<br/>Render Static Site]
  FE -->|REST / JSON + JWT| API[FastAPI<br/>Docker / Render Web Service]
  API -->|SQLAlchemy + psycopg| DB[(PostgreSQL<br/>Render Postgres gerenciado)]
  GH[GitHub Actions<br/>testes + build] -->|checksPass| FE
  GH -->|checksPass| API
```

O front-end e a API são serviços separados. A API não guarda sessão nem dados no filesystem do container; ela valida o token de cada chamada e consulta o banco externo pela conexão interna do Render. Esse desenho permite substituir ou ampliar instâncias da API sem mover os registros. A configuração define uma instância inicial; a escala efetiva depende do plano do provedor.

O modelo relacional possui três entidades: `User` tem vários `Project`, e cada projeto tem várias `Task`. Chaves estrangeiras ligam os registros e a camada da API verifica o proprietário antes de ler ou alterar um projeto ou tarefa. O perfil `admin` tem acesso de consulta ampliado.

## 3. Tecnologias e serviços

| Camada | Tecnologia | Responsabilidade |
|---|---|---|
| Front-end | React 19 e Vite | Login, painel responsivo, CRUD de projetos e tarefas |
| Back-end | FastAPI e SQLAlchemy 2 | API REST, validação, regras de acesso e OpenAPI |
| Autenticação | JWT HS256 e scrypt | Token com expiração e armazenamento de senha por hash com salt |
| Banco de dados | PostgreSQL gerenciado | Persistência externa ao container da aplicação |
| Container | Docker | Empacotar e executar a API |
| CI/CD | GitHub Actions e Render Blueprint | Testar e compilar; deploy automático após checks aprovados |
| Logs | logging do Python | Registrar rota, método, status, duração e erros com ID de requisição |

## 4. Segurança e qualidade

O cadastro não aceita um perfil arbitrário enviado pelo navegador. O endereço definido em `ADMIN_EMAIL` recebe perfil administrativo no cadastro; demais contas são criadas como `user`. As rotas protegidas exigem bearer token assinado e com validade de 60 minutos. A senha é derivada com scrypt e salt aleatório, e nunca é devolvida pela API.

O back-end valida formato e tamanho de dados, aplica autorização por proprietário e limita CORS às origens configuradas. Segredos e a URL do banco são variáveis de ambiente, fora do código versionado. Erros internos retornam mensagem genérica, enquanto o log mantém a exceção para diagnóstico. A documentação OpenAPI está disponível em `/docs`.

Os testes de API cobrem cadastro, login, consulta de perfil, CRUD de projetos e tarefas, validação de entrada, isolamento entre usuários e autorização do administrador. Um teste de interface confirma o fluxo de alternar para o formulário de cadastro. A pipeline executa esses testes e o build do front-end em pushes e pull requests.

## 5. Implantação e CI/CD

O `render.yaml` descreve a API Docker, o front-end estático e o PostgreSQL. A conexão do banco é fornecida ao serviço da API pelo próprio Render. O segredo JWT é gerado pelo provedor; o e-mail do administrador é solicitado na configuração inicial. O front-end recebe `VITE_API_URL` durante o build e a API permite a origem do site por CORS.

O workflow `.github/workflows/ci.yml` instala dependências, executa `pytest`, executa o teste de interface e gera o build Vite. No commit `c3bae6e`, os testes da API e o build do front-end passaram no GitHub Actions. O Render usa `autoDeployTrigger: checksPass`, então os deploys aguardam as verificações aprovadas.

O Blueprint foi sincronizado com o branch `master` e os três serviços foram provisionados. Repositório: https://github.com/jhonatanallmeida/nuvemtask-jhonatan. Front-end: https://nuvemtask-web.onrender.com. API: https://nuvemtask-api.onrender.com. O endpoint `/healthz` respondeu HTTP 200; a documentação OpenAPI está em https://nuvemtask-api.onrender.com/docs. O PostgreSQL aparece como disponível no plano gratuito, com expiração informada pelo Render para 25/10/2026. Em produção, o cadastro administrativo, a criação de um projeto e três tarefas foram validados; falta cadastrar uma conta comum e conferir o isolamento dos dados entre contas.

O serviço da API usa a URL interna do PostgreSQL. No painel Render, a regra atual de entrada do banco permite conexões de qualquer origem IPv4 (0.0.0.0/0); as conexões continuam exigindo credenciais, mas essa regra deve ser restringida antes de usar dados reais.

## 6. Papéis e contribuições

| Papel da proposta | Responsabilidade assumida pelo integrante único |
|---|---|
| Arquitetura em nuvem | Definição das camadas, banco externo, variáveis e blueprint |
| Back-end | Modelos, autenticação, autorização, CRUD, validação e logs |
| Front-end | Interface React, formulários, painel e integração com a API |
| DevOps | Docker, Compose, GitHub Actions e configuração Render |
| Qualidade e testes | Testes automatizados da API e fluxo de cadastro |
| Documentação e integração | README, relatório e roteiro da demonstração |

## 7. Dificuldades e soluções

A proposta pressupõe equipes de quatro a seis pessoas, enquanto esta entrega foi realizada individualmente por Jhonatan Almeida. Para manter rastreabilidade, as responsabilidades foram reunidas em um quadro individual e descritas sem atribuir contribuições inexistentes. Outra decisão foi manter a API stateless e a persistência em serviço separado, para evitar a perda de dados quando um container é recriado. A configuração de nuvem automatiza as conexões e gera o segredo de assinatura; o plano gratuito limita a disponibilidade e o período de vida do banco.

**Referência técnica:** [Render Blueprint Specification](https://render.com/docs/blueprint-spec), consultada para configurar serviços, banco, variáveis e deploy após verificações.
