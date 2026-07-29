# Camada de sincronização — My Skin Ritual V3

## Implementado

- leitura e gravação no Firestore para produtos, dispositivos e rotina;
- sincronização em tempo real com `onSnapshot`;
- atualização automática da interface quando a nuvem muda;
- fila local de alterações quando o aparelho fica sem internet;
- reenvio automático da fila quando a conexão retorna;
- consolidação de operações repetidas no mesmo item para evitar duplicidade;
- indicador visual de estado: local, sincronizando, online, offline, pendente ou erro;
- migração inicial preservada;
- `localStorage` mantido como cache e contingência offline;
- remoção dos campos técnicos do Firestore antes de salvar no cache local.

## Observação importante

A autenticação anônima mantém o mesmo usuário apenas no navegador em que foi criada. Para sincronizar notebook, iPad e celular sob a mesma conta, a próxima etapa de autenticação deve usar Google Sign-In (ou outro provedor de conta) em todos os aparelhos.
