# My Skin Ritual V3 — revisão de arquitetura

## Estado encontrado

O aplicativo original é uma PWA estática, sem framework, formada por `index.html`, `style.css`, `app.js`, catálogo JSON e Service Worker. Produtos personalizados, dispositivos e rotinas eram gravados exclusivamente no `localStorage` do navegador.

## Pontos positivos preservados

- PWA leve e instalável.
- Funcionamento offline.
- Catálogo base separado em `data/products.json`.
- Interface sem dependência de servidor próprio.
- Dados personalizados identificados por IDs estáveis.

## Fragilidades identificadas

- `app.js` concentra interface, regras, persistência e dispositivos em um único arquivo.
- `localStorage` não sincroniza entre aparelhos e pode ser apagado pelo navegador.
- Fotos em base64 podem aumentar rapidamente o armazenamento.
- Não havia estado visual de sincronização nem tratamento de falha da nuvem.
- A autenticação anônima depende da persistência do navegador; futuramente, login Google é mais seguro para uso em vários aparelhos.

## Arquitetura implementada nesta etapa

- `firebase-config.js`: configuração isolada do projeto Firebase.
- `cloud-sync.js`: autenticação anônima, migração inicial, leitura e gravação no Firestore.
- `app.js`: permanece responsável pela interface, mas chama a camada de nuvem nas alterações.
- `localStorage`: mantido como cache local e fallback offline.
- Firestore organizado por usuário:
  - `users/{uid}/products/{productId}`
  - `users/{uid}/devices/{deviceId}`
  - `users/{uid}/settings/routine`
  - `users/{uid}/settings/migration`
- Indicador de estado da nuvem adicionado ao cabeçalho.
- Service Worker atualizado para incluir os novos módulos.

## Migração

No primeiro acesso com o Firebase configurado, os produtos, dispositivos e rotinas existentes no `localStorage` são enviados para o Firestore. Uma marca de migração impede repetição desnecessária. Em seguida, o aplicativo baixa os dados da nuvem para o cache local.

## Ponto pendente para ativação real

É necessário preencher `firebase-config.js` com os dados do app Web fornecidos pelo Firebase Console. Sem esses valores, o aplicativo continua funcionando em modo local e informa isso no cabeçalho.
