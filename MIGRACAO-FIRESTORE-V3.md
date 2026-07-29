# Migração localStorage → Firestore — V3

## O que foi implementado

- Migração automática na primeira conexão válida com o Firebase.
- Produtos personalizados (`skinCustomV2`) para `users/{uid}/products`.
- Dispositivos (`skinRitualDevicesV1`) para `users/{uid}/devices`.
- Rotinas (`skinRoutineV2`) para `users/{uid}/settings/routine`.
- Backup completo antes da migração em `skinMigrationBackupV3`.
- Registro do resultado em `skinMigrationStateV3` e no documento `users/{uid}/settings/migration`.
- Migração idempotente e versionada: pode recarregar a página sem criar duplicidades.
- Escrita em lotes para respeitar limites do Firestore.
- Preservação de dados que já estejam mais novos na nuvem.
- `localStorage` mantido como cache offline após a migração.

## Segurança dos dados

A migração não apaga os dados locais. Depois de concluída, o Firestore vira a fonte principal e o `localStorage` passa a funcionar como cache para uso offline.

Documentos maiores que o limite seguro do Firestore são preservados no backup local e registrados como aviso. Fotos em Base64 muito grandes devem futuramente ser movidas para o Firebase Storage.

## Ativação

Preencha `firebase-config.js` com a configuração real do projeto Firebase. Depois, abra o aplicativo com internet. O processo ocorre automaticamente após a autenticação.

## Estrutura criada no Firestore

```text
users/{uid}/products/{productId}
users/{uid}/devices/{deviceId}
users/{uid}/settings/routine
users/{uid}/settings/migration
```
