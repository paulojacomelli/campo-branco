# Plano de Migração: Supabase → Firebase

## Objetivo
Remover todas as dependências do Supabase e migrar o backend completo para Firebase (Auth, Firestore, Admin SDK). Manter Firebase Hosting e FCM, que já estavam configurados.

## Estrutura de Dados: Supabase (SQL) → Firestore (NoSQL)

| Supabase (tabelas)          | Firestore (coleções)              |
|-----------------------------|-----------------------------------|
| `users`                     | `users/{uid}`                     |
| `congregations`             | `congregations/{id}`              |
| `cities`                    | `cities/{id}`                     |
| `territories`               | `territories/{id}`                |
| `addresses`                 | `addresses/{id}`                  |
| `visits`                    | `visits/{id}`                     |
| `shared_lists`              | `sharedLists/{id}`                |
| `witnessing_points`         | `witnessingPoints/{id}`           |
| `bug_reports`               | `bugReports/{id}`                 |

## Fases da Migração

### FASE 1 — Fundação (Firebase SDK)
- [x] Instalar `firebase` e `firebase-admin`
- [x] Criar `lib/firebase.ts` (client SDK, já existe base)
- [x] Criar `lib/firebase-admin.ts` (Admin SDK servidor)
- [x] Criar `lib/firestore.ts` (helpers de acesso ao Firestore)
- [x] Remover `lib/supabase.ts`, `lib/supabase-server.ts`, `lib/supabase-admin.ts`

### FASE 2 — Autenticação
- [x] Migrar `app/context/AuthContext.tsx` → Firebase Auth
- [x] Migrar `app/login/LoginClient.tsx` → `signInWithPopup` Google
- [x] Migrar `app/auth/callback/` → remoção (Firebase Auth não usa callback de rota)
- [x] Migrar `lib/auth.ts` → verificação via Firebase Admin SDK

### FASE 3 — API Routes (Backend)
- [x] `app/api/addresses/*`
- [x] `app/api/cities/*`
- [x] `app/api/territories/*`
- [x] `app/api/shared_lists/*`
- [x] `app/api/visits/*`
- [x] `app/api/witnessing/*`
- [x] `app/api/users/*`
- [x] `app/api/admin/*`
- [x] `app/api/reports/*`

### FASE 4 — Páginas e Componentes (Frontend)
- [x] Migrar subscriptions (Supabase Realtime → Firestore `onSnapshot`)
- [x] Todas as páginas que usam `supabase` diretamente

### FASE 5 — Limpeza
- [x] Remover pacotes Supabase do `package.json`
- [x] Remover `supabase/` directory (ou manter como histórico)
- [x] Atualizar `.env` com variáveis Firebase

## Variáveis de Ambiente Necessárias
```env
# Firebase Client (já existem)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (NOVO - apenas server-side)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
```
