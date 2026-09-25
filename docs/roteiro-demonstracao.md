# Roteiro da demonstração em vídeo

**Duração alvo:** 5 a 6 minutos (limite da proposta: 7 minutos)  
**Antes de gravar:** publicar o repositório, provisionar no Render e substituir os trechos entre colchetes pelas URLs reais.

## Sequência

1. **Abertura e arquitetura — 0:00–0:45**  
   Apresente o NuvemTask e explique o caminho React → API FastAPI em Docker → PostgreSQL gerenciado. Mostre o diagrama do relatório.

2. **Código e arquitetura — 0:45–1:30**  
   Mostre as pastas `frontend`, `backend/app`, `backend/tests`, `render.yaml` e `.github/workflows/ci.yml`. Aponte que os segredos são definidos no provedor.

3. **Cadastro e uso — 1:30–3:30**  
   Crie uma conta comum, cadastre um projeto, inclua duas tarefas, altere uma tarefa para concluída e edite o projeto. Mostre o indicador de progresso.

4. **Autorização — 3:30–4:15**  
   Entre com o e-mail admin definido em `ADMIN_EMAIL` e mostre a rota protegida `/api/admin/users` no Swagger. Se houver tempo, demonstre que a conta comum recebe `403` nessa rota.

5. **Nuvem e pipeline — 4:15–5:30**  
   Abra `[URL do front-end]`, `[URL da API]/healthz` e `[URL da API]/docs`. No GitHub, mostre a execução verde do workflow e o deploy correspondente no Render.

6. **Fechamento — 5:30–5:50**  
   Resuma o CRUD, a separação das camadas, a persistência gerenciada e a contribuição individual nos papéis técnicos.

## Checklist antes de gravar

- [ ] Substituir `[preencher nome]` no relatório.
- [ ] Publicar o repositório como público e confirmar que não há arquivos `.env` ou segredos.
- [ ] Provisionar Render e registrar as URLs do site, da API e do Swagger.
- [ ] Criar a conta admin depois de definir `ADMIN_EMAIL`.
- [ ] Criar uma conta comum e dados de demonstração.
- [ ] Confirmar os testes e o build verdes na pipeline.
- [ ] Gravar e revisar o vídeo com no máximo 7 minutos.
