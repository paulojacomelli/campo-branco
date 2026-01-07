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
- **Backend & Auth:** [Firebase](https://firebase.google.com/) (Firestore, Auth, Functions)
- **Segurança:** Autenticação via Tokens JWT (Jose) e Middleware de proteção.
- **PWA:** `@ducanh2912/next-pwa`

## 🛠️ Configuração e Instalação

### 1. Pré-requisitos
- Node.js 18+
- Conta no Firebase (Projeto Blaze recomendado)

### 2. Instalação
```bash
git clone https://github.com/paulojacomelli/campo-branco.git
cd campo-branco
npm install
```

### 3. Configuração de Ambiente
Crie um arquivo `.env.local` na raiz do projeto:

```env
# Firebase Client SDK
NEXT_PUBLIC_FIREBASE_API_KEY=seu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu_projeto
...
```

### 4. Rodando o Projeto
```bash
npm run dev
# Acesse http://localhost:3000
```

## 🤝 Contribuição e Suporte

Desenvolvido por **Paulo Jacomelli**.
- E-mail: `campobranco@paulojacomelli.com.br`
- Contribuições são bem-vindas via Pull Requests.

## 📄 Licença
Este projeto está licenciado sob a licença MIT.
