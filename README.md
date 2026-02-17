# Campo Branco

O **Campo Branco** é uma aplicação web moderna e progressiva (PWA) desenvolvida para digitalizar e otimizar a gestão de territórios, visitas e testemunho público para congregações. Focada em usabilidade, privacidade (LGPD) e performance, a aplicação serve desde a administração central da congregação até o uso diário pelos publicadores no campo.

> 🚀 Construído com **Vibe Coding Google Antigravity**

---

### ⚠️ Aviso Importante

Este aplicativo é uma iniciativa **independente e open source**. Ele **não** é uma ferramenta oficial da organização religiosa das Testemunhas de Jeová, embora seja projetado especificamente para ser útil e compatível com as atividades locais das congregações.

---

## ✨ Funcionalidades Principais

### 🗺️ Gestão de Territórios
- **Mapas Interativos:** Visualização clara de territórios com indicadores de status.
- **Cartões Digitais:** Compartilhamento seguro de territórios via links únicos (sem necessidade de login para visualização básica).
- **Geocodificação:** Integração com APIs de mapas para localização precisa.
- **Histórico:** Registro detalhado de designações, conclusões e devoluções.

### 🔒 Privacidade e Segurança (LGPD)
- **Compliance LGPD:** Estrutura desenvolvida com foco na Lei Geral de Proteção de Dados.
- **Definição de Papéis:** Clara distinção entre Operador (Software) e Controlador (Congregação Local).
- **Minimização de Dados:** Coleta apenas do estritamente necessário para a atividade pastoral.
- **Dados Sensíveis:** Tratamento especial e protegido para informações sensíveis.

### 👥 Controle de Acesso
- **Super Admin:** Gestão global do sistema.
- **Anciãos:** Gestão de territórios e campanhas.
- **Servos:** Manutenção e distribuição.
- **Publicadores:** Acesso restrito aos seus próprios territórios.

### 📱 Experiência Mobile (PWA)
- **Instalável:** Funciona como app nativo em Android e iOS.
- **Offline First:** Funcionalidades essenciais disponíveis mesmo sem conexão.
- **Dark Mode:** Tema escuro integrado.

## 🚀 Tecnologias

- **Frontend:** [Next.js 15](https://nextjs.org/) (App Router), React 19
- **Estilização:** [Tailwind CSS](https://tailwindcss.com/)
- **Mapas:** [Leaflet](https://leafletjs.com/) & OpenStreetMap
- **Banco de Dados & Auth:** [Supabase](https://supabase.com/) (PostgreSQL)
- **Hospedagem:** [Firebase Hosting](https://firebase.google.com/hosting)
- **PWA:** `@ducanh2912/next-pwa`

## 🛠️ Configuração e Instalação

### 1. Pré-requisitos
- Node.js 18+
- Projeto no Supabase (Banco de Dados e Auth configurados)

### 2. Instalação
```bash
git clone https://github.com/paulojacomelli/campo-branco.git
cd campo-branco
npm install
```

### 3. Configuração de Ambiente
Crie um arquivo `.env.local` na raiz do projeto:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-publica
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role-privada
```

### 4. Rodando o Projeto
```bash
npm run dev
# Acesse http://localhost:3000
```

## 🔥 Firebase Hosting

Embora o banco de dados tenha sido migrado para o Supabase, o **Firebase Hosting** continua sendo utilizado para hospedagem estática e PWA.

1.  Certifique-se de estar logado: `firebase login`
2.  Faça o deploy: `npm run build && firebase deploy`

### Redirects Customizados

Se desejar configurar redirecionamentos de domínio (ex: de um domínio antigo para o novo), você deve editar o arquivo `firebase.json` manualmente. Adicione a chave `redirects` dentro de `hosting`. Consulte a [documentação do Firebase](https://firebase.google.com/docs/hosting/full-config#redirects) para mais detalhes.

##  Testes e QA

O projeto possui scripts automatizados para garantir a qualidade do código.

### Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run test:unit` | Executa testes unitários (Jest). Valida lógica isolada. |
| `npm run test:e2e` | Executa testes End-to-End (Playwright). Simula o usuário real. |
| `npm run test:all` | Roda Lint, Unitários e E2E em sequência. |

### 🔍 Recomendação para QA Manual
Para validação completa antes de releases:
1.  **Limpeza**: Teste em aba anônima ou limpe o Storage.
2.  **Fluxo Crítico**:
    *   Criar Conta / Login
    *   Criar Território e Designar
    *   Devolver Território
3.  **Mobile**: Verifique a responsividade e o modo offline (PWA).

## �🤝 Contribuição e Suporte

Desenvolvido por **Paulo Jacomelli**.
- E-mail: `campobranco@paulojacomelli.com.br`
- Contribuições são bem-vindas via Pull Requests.

## 📄 Licença
Este projeto está licenciado sob a licença MIT.
