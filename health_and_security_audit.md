# Relatório de Saúde, Segurança e Diagnóstico de Falhas

Este documento apresenta uma análise profunda da arquitetura do Campo Branco, identificando riscos críticos e propondo medidas preventivas.

## 1. Segurança de Autenticação e Sessão
**Status:** ✅ **Seguro**

- **O que foi feito:** O sistema foi reconstruído usando **Firebase Session Cookies** (HTTP-only).
- **Resiliência:** As chaves de API e Admin SDK possuem tratamento de erros para evitar quedas do servidor em caso de falha de configuração.
- **Diagnóstico:** A rota `/api/auth/status` permite verificar a saúde do Admin SDK em tempo real.

## 2. Segurança de Dados (Firestore)
**Status:** ⚠️ **Risco Alto (Atenção)**

- **Vulnerabilidade Identificada:** As regras de segurança atuais permitem que **qualquer usuário logado** leia e escreva em qualquer coleção (territórios, endereços, visitas), independentemente da congregação.
- **Risco:** Um usuário da "Congregação A" pode, via console do navegador ou modificação de URL, ver e deletar dados da "Congregação B".
- **Ação Necessária:** Atualizar `firestore.rules` para validar se o `congregationId` do documento corresponde ao `congregationId` no perfil do usuário no Firestore.

## 3. Integridade de Dados e Persistência
**Status:** ❌ **Crítico (Ponto de Falha)**

- **Problema de "Cérebro Dividido":** O app usa **Firestore** para territórios e **SQLite (Prisma)** para Pontos de Testemunho.
- **Risco de Perda de Dados:** O Firebase Hosting/Functions é **stateless**. O arquivo `dev.db` do SQLite é resetado a cada novo deploy ou reinicialização da função. **Todos os dados de Testemunho Público serão perdidos.**
- **Ação Necessária:** Migrar o modelo `WitnessingPoint` do Prisma para o Firestore, unificando a base de dados.

## 4. Diagnóstico de Infraestrutura
**Status:** ✅ **Operacional**

- **Configuração de Headers:** O app está configurado com `COOP: unsafe-none` para garantir que o login do Google funcione em todos os ambientes.
- **CORS:** As rotas de API possuem tratamento de exceção básico.

---

## Plano de Ação (Resiliência Total)

### Fase 1: Blindagem do Firestore
1.  Refatorar `firestore.rules` para implementar multi-tenancy real.
2.  Garantir que usuários só vejam documentos onde `congregationId == user.congregationId`.

### Fase 2: Unificacção de Persistência
1.  Migrar `app/actions/witnessing.ts` para usar o SDK do Firestore em vez do Prisma.
2.  Remover dependência de SQLite para dados de produção.

### Fase 3: Hardening de API
1.  Mover IDs de projeto e chaves fixas do reCAPTCHA para variáveis de ambiente.
2.  Implementar detecção de ambiente (Dev vs Prod) nos logs.
