# Dívida Técnica: Regras de Firestore Temporariamente Relaxadas

## Problema Identificado

Durante a implementação de Custom Claims para otimização de performance, descobrimos que a comparação direta de `request.auth.token.congregationId` com `resource.data.congregationId` nas regras do Firestore está falhando de forma inconsistente, mesmo quando ambos os valores são idênticos (`'lscatanduva'`).

## Regras Afetadas

### Addresses (Leitura)
**Regra Ideal (Não Funciona):**
```javascript
allow read: if isAuthenticated() && (
    isSuperAdmin() ||
    request.auth.token.congregationId == resource.data.congregationId
);
```

**Regra Temporária (Atual):**
```javascript
allow read: if isAuthenticated();
```

### Shared Lists Subcollections (Escrita)
**Regra Ideal (Não Funciona):**
```javascript
allow write: if isAuthenticated() && (
    isSuperAdmin() ||
    (request.resource.data.congregationId == request.auth.token.congregationId &&
     request.resource.data.createdBy == request.auth.uid)
);
```

**Regra Temporária (Atual):**
```javascript
allow write: if isAuthenticated();
```

## Impacto de Segurança

⚠️ **CRÍTICO**: As regras atuais permitem que qualquer usuário autenticado:
- Leia TODOS os endereços (independente da congregação)
- Escreva em QUALQUER subcoleção de `shared_lists`

Isso viola o princípio de isolamento de dados entre congregações.

## Próximos Passos

1. **Investigar** por que a comparação de Custom Claims falha:
   - Verificar tipo de dado (string vs outro)
   - Testar em ambiente isolado
   - Reportar bug ao Firebase se necessário

2. **Alternativas**:
   - Voltar a usar `belongsToUserCongregation` (mas resolver o problema de `getUserData`)
   - Usar Cloud Functions para validação adicional
   - Implementar validação no cliente (não recomendado)

3. **Migração de Dados**:
   - Script `scripts/migrate-addresses.js` já criado
   - Todos os 138 endereços já têm `congregationId` correto

## Histórico

- **2026-01-07**: Implementados Custom Claims (`scripts/set-custom-claims.js`)
- **2026-01-07**: Descoberto problema de comparação nas regras
- **2026-01-07**: Regras temporariamente relaxadas (versão 0.4.14-beta)

## Referências

- Firestore Rules: `firestore.rules` (linhas 134-169)
- Custom Claims Script: `scripts/set-custom-claims.js`
- Migration Script: `scripts/migrate-addresses.js`
