# Como ativar a sincronização entre aparelhos

## Visual novo
Apliquei o conceito "botica antiga" no app inteiro: verde-garrafa, dourado e pergaminho, títulos em Playfair Display, rótulos em mono, e a moldura dourada dupla no topo do cabeçalho e dos painéis principais. Nenhum comportamento mudou — só a casca.

## O que mudou
- `firebase-config.js`: preenchido com a configuração real do seu projeto (`my-skin-ritual`).
- `cloud-sync.js`: trocado o login anônimo por **login com Google**. Agora, ao entrar com a mesma conta Google no iPad, notebook e celular, os três leem e escrevem os mesmos dados no Firestore.
- `index.html` + `style.css`: novo botão "Entrar com Google" e um selo com seu nome/foto quando conectada.
- `app.js`: liga o botão de entrar/sair à sincronização.
- `service-worker.js`: versão do cache atualizada, para os aparelhos que já tinham o app instalado baixarem os arquivos novos.

## Antes de subir os arquivos, configure 3 coisas no Firebase Console (console.firebase.google.com → projeto "My Skin Ritual")

### 1) Ativar o login com Google
Menu lateral → **Authentication** → aba **Sign-in method** → clique em **Google** → **Ativar** → selecione um e-mail de suporte → **Salvar**.

### 2) Criar o Firestore (se ainda não existir)
Menu lateral → **Firestore Database** → **Criar banco de dados** → localização perto do Brasil (ex.: `southamerica-east1`) → **Iniciar em modo de produção**.

Depois, na aba **Regras**, cole isto e clique em **Publicar**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Isso garante que só você (autenticada) pode ler e escrever os seus próprios dados.

### 3) Autorizar o domínio do GitHub Pages
Menu lateral → **Authentication** → aba **Settings** (Configurações) → **Authorized domains** (Domínios autorizados) → **Add domain** → digite:

```
belenas-create.github.io
```

Sem isso, o login com Google é bloqueado nesse endereço.

## Subindo os arquivos no GitHub
No repositório `belenas-create/my-skin-ritual`, para cada um destes arquivos, clique nele → ícone de lápis (editar) → apague o conteúdo → cole o conteúdo do arquivo correspondente aqui → **Commit changes**:

- `firebase-config.js`
- `cloud-sync.js`
- `index.html`
- `style.css`
- `app.js`
- `service-worker.js`

(Ou: página inicial do repositório → **Add file → Upload files** → arraste todos os arquivos desta pasta de uma vez → confirme que vai **substituir** os existentes → **Commit changes**.)

## Testando
1. Espere 1-2 minutos após o commit (o GitHub Pages leva um tempinho para publicar).
2. Abra o app em **um** aparelho, dê um "hard refresh" (no celular: feche e abra o app/aba de novo) e clique em **"Entrar com Google"**.
3. Os produtos que já existiam localmente nesse aparelho serão enviados para a nuvem automaticamente.
4. Repita em cada aparelho (iPad, notebook, celular), sempre entrando com a **mesma conta Google**. Os produtos de todos eles vão se juntar na mesma coleção — nada é apagado, tudo é somado.
5. A partir daí, qualquer produto adicionado em um aparelho aparece nos outros em poucos segundos (com internet ligada).

## Observação
Se cada aparelho tiver produtos diferentes hoje (bem provável, já que nunca sincronizaram), na primeira vez que você entrar com o Google em cada um deles, os produtos desse aparelho serão enviados e **somados** aos que já estavam na nuvem — não há risco de perder nada, e duplicatas só aconteceriam se o mesmo produto tivesse sido cadastrado manualmente em mais de um aparelho com nomes idênticos (nesse caso, é só apagar a cópia repetida depois).
