# Imagem Leve

Aplicação web para otimização de imagens. A pessoa cria uma conta ou entra com e-mail e senha ou
Google, envia uma imagem, compara o tamanho antes e depois e baixa em **JPEG, PNG ou WebP**.

O processamento é feito no servidor com [sharp](https://sharp.pixelplumbing.com/): a imagem é
redimensionada para no máximo 1600 px de largura e recomprimida. Nenhum arquivo é salvo em disco —
o resultado fica disponível em memória por 30 minutos apenas para o download.

## Funcionalidades

- Cadastro e login com e-mail e senha protegida com bcrypt.
- Login Google Identity Services com verificação da assinatura, audiência e e-mail verificado do ID
  token no servidor.
- Sessão em cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção, assinada com JWT.
- Limite de tentativas nos endpoints de autenticação.
- Upload de JPEG, PNG, WebP ou AVIF de até 15 MB.
- Redução automática de dimensões e de peso, com prévia do resultado.
- Download em JPEG, PNG ou WebP, escolhido na hora de baixar.
- Interface em português, responsiva e sem framework.

## Tecnologias

- **Node.js 20+** e **Express 5** — servidor e API.
- **sharp** — redimensionamento e conversão de imagens.
- **google-auth-library** — validação do ID token do Google.
- **better-sqlite3** — persistência local de contas com consultas parametrizadas.
- **bcrypt** — hash de senhas; senhas em texto puro nunca são armazenadas.
- **express-rate-limit** — limite de tentativas nos endpoints de acesso.
- **multer** — upload em memória com limite de tamanho.
- **JWT**, **cookie-parser** e **Helmet** — sessão, cookie e cabeçalhos de segurança.
- **HTML, CSS e JavaScript puro** — interface.

As senhas são armazenadas somente como hashes bcrypt. A identidade Google é validada no servidor; se
o e-mail verificado já pertencer a uma conta local, as identidades são vinculadas à mesma conta. O
Client ID identifica o aplicativo e o segredo de sessão fica apenas no ambiente do servidor.

## Como executar

1. Instale o Node.js 20 ou superior.
2. Instale as dependências:

   ```bash
   npm install
   ```

3. Crie o arquivo `.env` a partir do exemplo:

   ```bash
   cp .env.example .env
   ```

   No PowerShell, use `Copy-Item .env.example .env`.

4. Gere um segredo para assinar a sessão:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

5. Cole o valor em `SESSION_SECRET` no `.env`, preencha `GOOGLE_CLIENT_ID` (veja abaixo) e inicie:

   ```bash
   npm run dev
   ```

   Para iniciar sem modo de observação, use `npm start`.

6. Acesse <http://localhost:3000>.

O servidor não sobe se `SESSION_SECRET` estiver ausente ou tiver menos de 32 caracteres. Sem
`GOOGLE_CLIENT_ID`, o cadastro e o login por e-mail continuam funcionando; o botão Google mostra que
precisa de configuração. O banco SQLite é criado automaticamente em `data/users.db`, ignorado pelo
Git. A senha deve ter ao menos 12 caracteres e no máximo 72 bytes.

Execute `npm test` para rodar os testes de autenticação.

## Configurando o login com Google

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e crie (ou selecione) um projeto.
2. Em **APIs e serviços → Tela de consentimento OAuth**, configure um app externo com nome, e-mail de
   suporte e dados básicos. Em modo de teste, adicione seu e-mail em **Usuários de teste**.
3. Em **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**, escolha
   **Aplicativo da Web**.
4. Em **Origens JavaScript autorizadas**, adicione:

   ```text
   http://localhost:3000
   ```

   Não é necessário cadastrar URI de redirecionamento: o botão usa o fluxo de ID token do Google.
5. Copie o **Client ID** gerado para `GOOGLE_CLIENT_ID` no `.env` e reinicie o servidor.

Para publicar em outro domínio, adicione a origem HTTPS correspondente nas origens autorizadas e
configure no ambiente de produção `NODE_ENV=production`, `GOOGLE_CLIENT_ID` e um `SESSION_SECRET`
aleatório com pelo menos 32 caracteres (o cookie passa a ser `Secure`, exigindo HTTPS). Não publique
o arquivo `.env` nem o segredo da sessão no repositório.

## Publicação com GitHub

O repositório pode ficar no GitHub como portfólio, mas o **GitHub Pages não executa Node.js**.
Como esta aplicação depende do Express para validar o login e processar imagens, publicar apenas a
pasta `public` no Pages não disponibiliza essas funções. Para uma demonstração funcional, hospede o
projeto completo em uma plataforma que execute Node.js e configure nela as variáveis de ambiente
acima. Configure também um disco persistente para o arquivo SQLite e cadastre o domínio HTTPS dessa
aplicação nas origens JavaScript autorizadas do cliente OAuth do Google.

## API

| Método | Rota                             | Acesso | Descrição                                    |
| ------ | -------------------------------- | ------ | -------------------------------------------- |
| GET    | `/api/auth/config`               | Público | Informa o Client ID configurado              |
| POST   | `/api/auth/register`              | Público | Cria conta e inicia sessão                   |
| POST   | `/api/auth/login`                 | Público | Autentica com e-mail e senha                 |
| POST   | `/api/auth/google`               | Público | Valida a credencial Google e inicia a sessão |
| POST   | `/api/auth/logout`               | Público | Encerra a sessão                             |
| GET    | `/api/auth/me`                   | Sessão | Retorna o usuário autenticado                |
| POST   | `/api/images/compress`           | Sessão | Recebe `image` (multipart) e devolve o resultado |
| GET    | `/api/images/:id/download?format=jpeg\|png\|webp` | Sessão | Baixa a imagem no formato escolhido |

## Organização do código

```text
src/
  app.js                     Configuração do Express, CSP e middlewares
  server.js                  Inicialização e encerramento do servidor
  config/env.js              Leitura e validação das variáveis de ambiente
  routes/                    Rotas de autenticação e de imagens
  controllers/               Tratamento das requisições e respostas HTTP
  services/                  Login, validação Google e processamento com sharp
  middleware/                Autenticação, rate limit, upload, 404 e erros
  store/user.store.js        Contas locais e vinculação com Google em SQLite
  store/image.store.js       Resultados temporários em memória
  utils/                     JWT de sessão e erro da aplicação
public/
  index.html                 Estrutura da interface
  styles.css                 Estilos
  app.js                     Login, upload, prévia e download
```

## Decisões de implementação

- O navegador envia ao servidor o ID token emitido pelo Google; a assinatura e a audiência são
  verificadas no backend antes de criar a sessão.
- A sessão usa cookie `HttpOnly` e `SameSite=Lax`, com JWT `HS256`; em produção também `Secure`.
- O ID token do Google só é aceito após validação no servidor e confirmação de e-mail verificado.
- Senhas exigem 12 caracteres, são limitadas a 72 bytes e passam por bcrypt antes de serem salvas.
- Login, cadastro e Google compartilham um limite de tentativas por IP.
- Upload em memória (sem gravar arquivos), limite de 15 MB e validação do tipo MIME.
- A imagem é redimensionada com orientação EXIF corrigida; o download é gerado a partir da versão já
  otimizada no formato pedido.
- Cada usuário só consegue baixar os próprios resultados, que expiram em 30 minutos.
- CSP restritiva liberando apenas o necessário para o script e o iframe do Google.

## Limitações

- Resultados ficam em memória: reiniciar o servidor os apaga e um deploy com várias instâncias
  exigiria um armazenamento compartilhado.
- O SQLite atende a demonstrações com uma instância e exige disco persistente no deploy. Para escalar
  horizontalmente, migre para PostgreSQL e um limitador de tentativas compartilhado.
- Não há verificação de e-mail nem recuperação de senha; configure um provedor de e-mail antes de
  disponibilizar contas para usuários reais.
- Não há histórico de imagens ou cobrança; as contas guardam apenas os dados básicos de acesso.
