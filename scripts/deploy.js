const fs = require('fs');
const { execSync, exec } = require('child_process');
const path = require('path');
const http = require('http');
const https = require('https');
const url = require('url');

// Main Entry Point
(async () => {
    await startWizard();
})();

async function startWizard() {
    const envPath = path.join(__dirname, '..', '.env.local');
    const packagePath = path.join(__dirname, '..', 'package.json');

    let hasEnv = false;
    let currentProjectId = '';
    let currentAuthDomain = '';
    let localVersion = '0.0.0';

    // Read Package Version
    try {
        if (fs.existsSync(packagePath)) {
            const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            localVersion = pkg.version;
        }
    } catch (e) { console.error('Error reading package.json', e); }

    // Read Env Config (Check both .env.local and .env)
    const envPaths = [envPath, path.join(__dirname, '..', '.env')];
    envPaths.forEach(p => {
        if (fs.existsSync(p)) {
            hasEnv = true;
            try {
                const envContent = fs.readFileSync(p, 'utf8');
                const matchId = envContent.match(/NEXT_PUBLIC_FIREBASE_PROJECT_ID=["']?([^"'\n\r]+)["']?/);
                if (matchId && !currentProjectId) currentProjectId = matchId[1].trim();

                const matchDomain = envContent.match(/NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=["']?([^"'\n\r]+)["']?/);
                if (matchDomain && !currentAuthDomain) currentAuthDomain = matchDomain[1].trim();
            } catch (e) { }
        }
    });

    // Handle remote version and domain
    let publicDomain = currentProjectId ? `${currentProjectId}.web.app` : '(Não definido)';
    let remoteVersion = '(Buscando...)';

    // Dynamic Action Buttons
    const actionButtons = hasEnv ?
        `
        <div class="grid grid-cols-2 gap-4 w-full">
            <button onclick="openConfirmation()" class="group bg-white/5 text-white hover:bg-white/10 font-bold py-5 rounded-2xl border border-white/10 transition-all flex flex-col items-center justify-center p-4 text-center">
                <div class="mb-2 bg-white/10 p-2 rounded-lg"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg></div>
                <span class="text-sm">Atualizar (Deploy)</span>
            </button>
            <button onclick="triggerPreview()" class="group bg-orange-500/10 text-orange-400 hover:bg-orange-500 hover:text-white font-bold py-5 rounded-2xl border border-orange-500/20 transition-all flex flex-col items-center justify-center p-4 text-center">
                <div class="mb-2 bg-orange-500/20 group-hover:bg-white/20 p-2 rounded-lg"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg></div>
                <span class="text-sm">Preview Local</span>
            </button>
        </div>
        ` :
        `
        <div class="opacity-50 pointer-events-none group w-full bg-white/5 text-slate-500 font-bold py-4 rounded-xl border border-white/5 flex items-center justify-between px-6">
            <span>Atualizar (Não configurado)</span>
        </div>
        `;

    const htmlTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configuração Campo Branco</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: { sans: ['Inter', 'sans-serif'] },
                    colors: {
                        primary: { DEFAULT: '#16a34a', dark: '#15803d' },
                        secondary: { DEFAULT: '#64748b', dark: '#0f172a' },
                        background: '#0f172a'
                    }
                }
            }
        }
    </script>
    <style>
        body { font-family: 'Inter', sans-serif; height: 100vh; overflow: hidden; }
        .carousel-track { display: flex; transition: transform 0.5s cubic-bezier(0.25, 1, 0.5, 1); height: 100%; }
        .carousel-slide { min-width: 100%; padding: 3rem; display: flex; flex-direction: column; justify-content: center; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
        .modal { opacity: 0; visibility: hidden; transition: all 0.3s; }
        .modal.active { opacity: 1; visibility: visible; }
    </style>
</head>
<body class="bg-background text-white m-0 p-0">
    <div class="w-full h-full flex flex-col lg:flex-row">
        <!-- Sidebar Guide -->
        <div id="left-panel" class="w-full lg:w-full bg-secondary-dark relative flex flex-col justify-between transition-all duration-500 border-r border-white/5">
            <div class="p-8 pb-0 flex items-center gap-3 relative z-10">
                <div class="w-10 h-10 flex items-center justify-center">
                    <svg viewBox="0 0 1000 1000" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <style>.st0{fill:#fff}.st1{fill:url(#Gradiente_sem_nome)}</style>
                            <linearGradient id="Gradiente_sem_nome" x1="161.8" y1="856.28" x2="839.8" y2="146.34" gradientTransform="translate(0 1002) scale(1 -1)" gradientUnits="userSpaceOnUse">
                                <stop offset="0" stop-color="#00db82"/>
                                <stop offset="1" stop-color="#00a441"/>
                            </linearGradient>
                        </defs>
                        <path class="st1" d="M552.87,64.05c-.82,2.69,26.49,1.6,35.36,2.18l19.19,1.27c59.89,3.96,119.01,11.9,174.08,35.02,53.33,22.39,93.57,62.64,115.97,115.95,23.18,55.17,31.09,114.11,35.03,174.09l1.27,19.33c.56,8.56-.5,36.13,2.18,35.23v105.56l-2.44,35.51-1,19.03c-1.34,25.53-4.32,50.08-8.07,75.31-13.93,93.69-50.27,175.33-141.78,214.26-71.52,30.43-153.29,35.41-230.43,38.19-35.21,1.27-69.05,1.28-104.27,0-80.04-2.92-172.2-8.39-244.65-44.95-40.89-20.63-72.69-52.45-93.33-93.35-36.61-72.53-42.01-164.5-44.96-244.65-1.29-35.22-1.28-69.05,0-104.27,2.79-77.3,7.72-158.78,38.19-230.43,50.48-118.68,171.19-141.72,287.88-149.74l20.65-1.42c12.28-.84,24.59.83,35.58-2.14h105.56v.02Z"/>
                        <path class="st0" d="M727.75,380.6c2.89,10.63,7.69,40.95,8.06,52.86,1.29,41.88-9.05,76.64-25.94,114.26-24.54,54.65-65.03,108.03-102.69,154.27l-5.86,7.19c-7.06,8.67-14.01,17.43-22.04,25.17-3.26,3.14-5.23,6.12-8.12,9.51-17.25,20.18-35.33,39.11-53.78,58.17-6.21,6.42-13.47,8.24-22.2,7.14-7.24-.92-12.12-5.35-17.46-11.6-11.74-13.72-26.83-25.05-33.41-39.36-13.85-30.16-16.82-54.1-13.83-87.74,1.47-16.6,5.62-31.77,12-46.75,5.46-12.81,14.19-22.26,25.04-30.46,22.55-17.05,36.86-5.83,66.62-7.37,17.91-.93,34.92-5.53,49.9-15.43,17.58-11.63,31.1-27.75,40.87-46.19,1.42-2.68.22-6-2.45-6.84-19.01-6.06-38.36-7.93-58.14-5.64-20.83,2.41-39,10.82-54.37,24.99-16.67,15.38-23.17,31.64-46.94,37.48,1.19-4.69,3.13-8.72,5.4-13.15l36.38-70.95,7.18-17.86c9.57-23.82,18.51-48.24,23.02-74.28,6.01-34.71,6.39-70.26-13.95-100.09-4.19-6.14-21.17-27.87-27.52-27.78-1.37.02-3.21,1.17-4.24,2.89-17.75,29.87-25.65,64.77-11.94,98.11,5.16,12.54,12.41,23.04,20.71,33.59,9.7,12.34,12.3,27.98,6.12,42.41-2.27,5.29-3.14,11.27-5.53,15.9-10.34,20.03-21.95,39.11-33.9,58.87l-28.39,46.96c-8.23-12.64-4.51-26.04-7.01-36.39.54-1.3-.06-3.33-.06-4.71,0-.78,0-1.58-.04-2.36-.02-.4-.26-.78-.33-1.18-1.36-7.64-3.2-15.11-5.82-22.4-4.57-12.73-11.19-25.22-21.03-35.46-14.83-15.43-33.61-25.67-53.96-32.05-2.1-.66-4.58.34-5.54,1.37-.68.73-1.53,2.21-1.73,3.98-4.85,42.16,4.63,75.77,37.95,103.23,9.57,7.89,27.47,16,31.45,21.41,15.92,21.67,7.51,51.1-4.32,73.38-5.93,11.18-17.37,18.02-29.19,18.61-12.12.61-24.61-5.4-31.2-15.41l-28.44-43.2c-26.72-40.59-52.53-102.8-52.98-152.48-.25-27.9,4.47-55.11,13.44-81.21,9.32-27.11,26.83-57.24,45.55-77.78,13.31-14.61,26.72-27.43,42.89-38.34,26.85-18.12,55.84-31.81,87.86-37.13l10.73-1.78c44.95-7.47,90.4-.62,132.17,17.99,54.35,24.22,97.19,68.85,120.2,123.87,4.28,10.23,8.11,19.74,10.83,29.75h-.02ZM559.35,403.18c44.29-1.14,75.95-27.96,79.68-70.93.87-10.06-32.51,1.85-37.34,3.92-12.56,5.4-22.12,14.11-30.05,25.03-5.51,7.59-15.34,31.18-12.29,41.97h0ZM467.12,478.83c8.04-20.25,6.88-51.1-1.97-68.15-4.89-19.78-34.67-43.62-53.68-48.68-5.12.28-5.45,8.85-5.86,12.39-3.09,26.92-.58,52.33,17.96,73.13,11.85,13.29,26.05,24.54,43.54,31.31h0ZM617.42,469.53c13.48-10.2,23.69-23.2,30.82-38.46.68-1.45.19-3.61-.41-4.53-.52-.78-1.71-1.79-3.41-2.12-30.78-6.04-55.07-6.42-81.38,13.38-12.79,9.62-22.51,22.09-29.46,36.46-1.28,2.66.3,5.54,3.13,6.23,28.17,6.87,56.63,7.25,80.71-10.96h0Z"/>
                    </svg>
                </div>
                <h1 class="font-bold text-lg tracking-tight">Campo Branco <span class="text-[10px] text-slate-500 ml-1">v${localVersion}</span></h1>
            </div>

            <div class="flex-1 overflow-hidden relative">
                <div class="carousel-track" id="track">
                    <!-- Slide 0: Welcome -->
                    <div class="carousel-slide items-center text-center">
                        <div class="w-32 h-32 bg-white/5 rounded-[2.5rem] flex items-center justify-center text-6xl shadow-2xl border border-white/10 mb-8 animate-bounce">🚀</div>
                        <h2 class="text-5xl font-bold mb-4">Olá!</h2>
                        <p class="text-slate-400 text-xl max-w-md font-light">Pronto para colocar o Campo Branco no ar? Vamos configurar seu projeto Firebase.</p>
                        <div class="mt-12 w-full max-w-sm flex flex-col gap-4">
                            <button onclick="goToSlide(1)" class="w-full bg-white text-black font-bold py-5 rounded-2xl hover:bg-primary hover:text-white transition-all transform hover:scale-105">Começar Instalação</button>
                            ${actionButtons}
                        </div>
                    </div>

                    <!-- Slide 1: Firebase Project -->
                    <div class="carousel-slide">
                        <span class="text-primary font-bold text-xs uppercase tracking-widest mb-2">Passo 1</span>
                        <h2 class="text-4xl font-bold mb-6">Crie seu Projeto</h2>
                        <div class="space-y-6 text-slate-300">
                            <div class="flex gap-4">
                                <div class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">1</div>
                                <p>Acesse o <a href="https://console.firebase.google.com/" target="_blank" class="text-primary hover:underline font-bold">Console do Firebase</a>.</p>
                            </div>
                            <div class="flex gap-4">
                                <div class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">2</div>
                                <p>Clique em <strong>Adicionar Projeto</strong> e dê o nome de "Campo Branco".</p>
                            </div>
                            <div class="flex gap-4">
                                <div class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">3</div>
                                <p>Recomendamos <strong>desativar o Google Analytics</strong> para simplificar.</p>
                            </div>
                        </div>
                    </div>

                    <!-- Slide 2: Web App Configuration -->
                    <div class="carousel-slide">
                        <span class="text-primary font-bold text-xs uppercase tracking-widest mb-2">Passo 2</span>
                        <h2 class="text-4xl font-bold mb-6">Registre seu Web App</h2>
                        <div class="bg-black/30 rounded-2xl p-6 border border-white/10 mb-6">
                            <p class="text-sm leading-relaxed text-slate-300">No painel do projeto, clique no ícone <strong>&lt;/&gt; (Web)</strong> para registrar um novo aplicativo. Escolha um apelido e clique em "Registrar".</p>
                        </div>
                        <div class="flex items-center gap-4 text-amber-400 text-sm italic">
                            <span>💡</span>
                            <p>Não precisa configurar o Hosting por lá agora, nós faremos isso automaticamente!</p>
                        </div>
                    </div>

                    <!-- Slide 3: Copy and Paste Magic -->
                    <div class="carousel-slide">
                        <span class="text-primary font-bold text-xs uppercase tracking-widest mb-2">Passo Final</span>
                        <h2 class="text-4xl font-bold mb-6">A Ciência Mágica ✨</h2>
                        <p class="text-slate-400 mb-8">Após registrar seu app, você verá um bloco de código como "firebaseConfig".</p>
                        <p class="text-sm text-primary font-bold mb-4">Para funções avançadas (Backup/Import):</p>
                        <div class="bg-black/30 p-4 rounded-xl border border-white/5 text-xs text-slate-300">
                           Vá em <strong>Configurações do Projeto > Contas de Serviço</strong> e gere uma nova chave privada (JSON). Você pode colar esse JSON aqui também!
                        </div>
                    </div>
                </div>
            </div>

            <!-- Navigation Controls -->
            <div id="nav-bar" class="p-8 border-t border-white/5 flex items-center justify-between opacity-0 pointer-events-none transition-opacity">
                <button onclick="moveSlide(-1)" class="p-3 rounded-xl hover:bg-white/5 text-slate-500 hover:text-white transition-all">← Voltar</button>
                <div class="flex gap-2" id="dots"></div>
                <button id="nextBtn" onclick="moveSlide(1)" class="bg-primary px-6 py-3 rounded-xl font-bold hover:bg-primary-dark transition-all">Próximo →</button>
            </div>
        </div>

        <!-- Right Panel Form -->
        <div id="right-panel" class="lg:w-6/12 bg-white text-slate-800 overflow-y-auto hidden">
            <div class="p-10 lg:p-16 max-w-xl mx-auto">
                <header class="mb-10">
                    <h2 class="text-3xl font-bold tracking-tight">Configurar App</h2>
                    <p class="text-slate-500 mt-2">Cole os dados do console e nós cuidamos do resto.</p>
                </header>

                <form action="/save" method="POST" class="space-y-8" id="mainForm">
                    <div class="space-y-6">
                        <div class="group">
                            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Bloco de Configuração (Copy & Paste)</label>
                            <textarea id="magicBox" placeholder="Cole o código 'const firebaseConfig = { ... }' aqui..." 
                                     class="w-full h-48 p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all font-mono text-xs leading-relaxed"
                                     oninput="parseInput()"></textarea>
                        </div>

                        <!-- Feedback Box -->
                        <div id="statusBox" class="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                            <div class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                <span>Verificação de Dados</span>
                            </div>
                            <div class="grid grid-cols-2 gap-3" id="fieldChecks">
                                <div data-field="apiKey" class="flex items-center gap-2 text-xs text-slate-300 transition-colors"><div class="w-2 h-2 rounded-full bg-current shrink-0"></div> API Key</div>
                                <div data-field="projectId" class="flex items-center gap-2 text-xs text-slate-300 transition-colors"><div class="w-2 h-2 rounded-full bg-current shrink-0"></div> Project ID</div>
                                <div data-field="authDomain" class="flex items-center gap-2 text-xs text-slate-300 transition-colors"><div class="w-2 h-2 rounded-full bg-current shrink-0"></div> Auth Domain</div>
                                <div data-field="appId" class="flex items-center gap-2 text-xs text-slate-300 transition-colors"><div class="w-2 h-2 rounded-full bg-current shrink-0"></div> App ID</div>
                                <div data-field="clientEmail" class="flex items-center gap-2 text-xs text-slate-300 transition-colors"><div class="w-2 h-2 rounded-full bg-current shrink-0"></div> Admin Email</div>
                                <div data-field="privateKey" class="flex items-center gap-2 text-xs text-slate-300 transition-colors"><div class="w-2 h-2 rounded-full bg-current shrink-0"></div> Private Key</div>
                            </div>
                        </div>

                        <!-- Admin Mail -->
                        <div class="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                            <label class="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-3">Login do Administrador</label>
                            <input required name="adminEmail" type="email" placeholder="seu.email@gmail.com" 
                                   pattern=".*@gmail\.com$" title="Por favor, use uma conta do Google (@gmail.com)"
                                   class="w-full p-4 rounded-xl bg-white border border-blue-200 focus:border-primary outline-none transition-all text-sm font-medium">
                        </div>
                    </div>

                    <!-- Hidden Fields -->
                    <input type="hidden" name="apiKey" id="val_apiKey">
                    <input type="hidden" name="projectId" id="val_projectId">
                    <input type="hidden" name="authDomain" id="val_authDomain">
                    <input type="hidden" name="storageBucket" id="val_storageBucket">
                    <input type="hidden" name="messagingSenderId" id="val_messagingSenderId">
                    <input type="hidden" name="appId" id="val_appId">
                    <input type="hidden" name="measurementId" id="val_measurementId">
                    <input type="hidden" name="clientEmail" id="val_clientEmail">
                    <input type="hidden" name="privateKey" id="val_privateKey">

                    <button type="submit" id="submitBtn" disabled class="w-full bg-slate-100 text-slate-400 py-5 rounded-2xl font-bold text-lg select-none transition-all">
                        Preencha os Campos
                    </button>
                </form>
            </div>
        </div>
    </div>

    <!-- Modal Update -->
    <div id="confirmModal" class="modal fixed inset-0 z-50 flex items-center justify-center p-6">
        <div class="absolute inset-0 bg-slate-900/95 backdrop-blur-sm" onclick="closeConfirmation()"></div>
        <div class="bg-white text-slate-800 w-full max-w-lg rounded-3xl overflow-hidden relative shadow-2xl">
            <div class="bg-amber-50 p-6 border-b border-amber-100 flex items-center gap-4">
                <div class="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center text-2xl shrink-0">⚠️</div>
                <div>
                    <h3 class="text-lg font-bold text-amber-900">Atualizar Sistema</h3>
                    <p class="text-amber-700 text-xs">Esta ação substituirá a versão que está no ar.</p>
                </div>
            </div>
            
            <div class="p-6 space-y-6">
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Projeto Destino</p>
                        <p class="font-mono text-sm font-bold text-primary truncate">${currentProjectId || '...'}</p>
                    </div>
                    <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Domínio App</p>
                        <p class="font-mono text-sm font-bold text-primary truncate">${publicDomain}</p>
                    </div>
                </div>

                <div class="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 flex justify-between items-center">
                    <div>
                        <p class="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Nova Versão (Local)</p>
                        <p class="text-xl font-bold text-blue-600">v${localVersion}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Versão no Ar</p>
                        <p id="remoteVersionVal" class="text-sm font-bold text-slate-500 opacity-40">${remoteVersion}</p>
                    </div>
                </div>

                <div class="flex gap-3 pt-2">
                    <button onclick="closeConfirmation()" class="flex-1 py-4 font-bold text-slate-400 hover:bg-slate-50 rounded-2xl transition-all">Cancelar</button>
                    <button onclick="triggerUpdate()" class="flex-1 bg-primary text-white py-4 rounded-2xl font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all">Confirmar Update</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        function fetchRemoteVersion() {
             const el = document.getElementById('remoteVersionVal');
             el.innerText = '(Buscando...)';
             fetch('/remote-version').then(r => r.text()).then(v => {
                 el.innerText = v;
             }).catch(() => {
                 el.innerText = '(Erro)';
             });
        }
        window.onload = fetchRemoteVersion;
        let slide = 0;
        const total = document.querySelectorAll('.carousel-slide').length;
        
        function updateLayout() {
            document.getElementById('track').style.transform = 'translateX(-' + (slide * 100) + '%)';
            const lp = document.getElementById('left-panel');
            const rp = document.getElementById('right-panel');
            const nav = document.getElementById('nav-bar');
            
            if (slide === 0) {
                lp.classList.replace('lg:w-6/12', 'lg:w-full');
                rp.classList.add('hidden');
                nav.classList.replace('opacity-100', 'opacity-0');
                nav.classList.add('pointer-events-none');
            } else {
                lp.classList.replace('lg:w-full', 'lg:w-6/12');
                rp.classList.remove('hidden');
                nav.classList.replace('opacity-0', 'opacity-100');
                nav.classList.remove('pointer-events-none');
            }

            // Update Dots
            const dots = document.getElementById('dots');
            dots.innerHTML = '';
            for(let i=1; i<total; i++) {
                const dot = document.createElement('div');
                dot.className = 'w-1.5 h-1.5 rounded-full transition-all ' + (i === slide ? 'bg-primary w-4' : 'bg-white/20');
                dots.appendChild(dot);
            }
        }

        function moveSlide(d) { slide = Math.max(0, Math.min(total-1, slide + d)); updateLayout(); }
        function goToSlide(i) { slide = i; updateLayout(); }

        function parseInput() {
            const raw = document.getElementById('magicBox').value;
            const keys = ['apiKey', 'projectId', 'authDomain', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId', 'clientEmail', 'privateKey'];
            let found = 0;

            // Try parsing as raw JSON first (for Service Account)
            try {
                const json = JSON.parse(raw);
                if (json.private_key) {
                    document.getElementById('val_privateKey').value = json.private_key;
                    const elCheck = document.querySelector('[data-field="privateKey"]');
                    if (elCheck) { elCheck.classList.remove('text-slate-300'); elCheck.classList.add('text-green-500', 'font-bold'); }
                }
                if (json.client_email) {
                    document.getElementById('val_clientEmail').value = json.client_email;
                    const elCheck = document.querySelector('[data-field="clientEmail"]');
                    if (elCheck) { elCheck.classList.remove('text-slate-300'); elCheck.classList.add('text-green-500', 'font-bold'); }
                }
                if (json.project_id && !document.getElementById('val_projectId').value) {
                     document.getElementById('val_projectId').value = json.project_id;
                     const elCheck = document.querySelector('[data-field="projectId"]');
                     if (elCheck) { elCheck.classList.remove('text-slate-300'); elCheck.classList.add('text-green-500', 'font-bold'); }
                }
            } catch(e) {}

            keys.forEach(k => {
                // Map camelCase to snake_case for regex check if needed, but mostly we look for keys in JS block
                let searchKey = k;
                if (k === 'clientEmail') searchKey = 'client_email';
                if (k === 'privateKey') searchKey = 'private_key';

                const re = new RegExp(searchKey + ':\\\\s*["\\']([^"\\']+)["\\']', 'i');
                const m = raw.match(re);
                const elField = document.getElementById('val_' + k);
                const elCheck = document.querySelector('[data-field="' + k + '"]');

                if (m) {
                    elField.value = m[1].replace(/\\\\n/g, '\\\\n'); // Support literal \\n in private keys
                    if (elCheck) {
                        elCheck.classList.remove('text-slate-300');
                        elCheck.classList.add('text-green-500', 'font-bold');
                    }
                    found++;
                } else if (!elField.value) { // Don't wipe if already set by JSON parse
                    if (elCheck) {
                        elCheck.classList.add('text-slate-300');
                        elCheck.classList.remove('text-green-500', 'font-bold');
                    }
                } else if (elField.value) {
                    found++;
                }
            });

            const btn = document.getElementById('submitBtn');
            if (found >= 6) {
                btn.disabled = false;
                btn.innerText = 'Instalar Agora 🚀';
                btn.className = 'w-full bg-primary text-white py-5 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] cursor-pointer transition-all';
            } else {
                btn.disabled = true;
                btn.innerText = 'Preencha os Campos';
                btn.className = 'w-full bg-slate-100 text-slate-400 py-5 rounded-2xl font-bold text-lg select-none transition-all';
            }
        }

        function openConfirmation() { document.getElementById('confirmModal').classList.add('active'); }
        function closeConfirmation() { document.getElementById('confirmModal').classList.remove('active'); }
        function triggerUpdate() {
             document.getElementById('confirmModal').innerHTML = '<div class="p-12 text-center text-slate-800"><div class="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p class="font-bold">Iniciando...</p></div>';
             fetch('/trigger-update', { method: 'POST' }).then(r => r.text()).then(h => { document.open(); document.write(h); document.close(); });
        }
        function triggerPreview() {
             fetch('/trigger-preview', { method: 'POST' }).then(r => r.text()).then(h => { document.open(); document.write(h); document.close(); });
        }
    </script>
</body>
</html>
    `;

    const appIconSvg = `<svg id="Camada_1" xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:serif="http://www.serif.com/" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1000 1000"><defs><style>.st0{fill:#fff}.st1{fill:url(#Gradiente_sem_nome)}</style><linearGradient id="Gradiente_sem_nome" data-name="Gradiente sem nome" x1="161.8" y1="856.28" x2="839.8" y2="146.34" gradientTransform="translate(0 1002) scale(1 -1)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#00db82"/><stop offset="1" stop-color="#00a441"/></linearGradient></defs><path class="st1" d="M552.87,64.05c-.82,2.69,26.49,1.6,35.36,2.18l19.19,1.27c59.89,3.96,119.01,11.9,174.08,35.02,53.33,22.39,93.57,62.64,115.97,115.95,23.18,55.17,31.09,114.11,35.03,174.09l1.27,19.33c.56,8.56-.5,36.13,2.18,35.23v105.56l-2.44,35.51-1,19.03c-1.34,25.53-4.32,50.08-8.07,75.31-13.93,93.69-50.27,175.33-141.78,214.26-71.52,30.43-153.29,35.41-230.43,38.19-35.21,1.27-69.05,1.28-104.27,0-80.04-2.92-172.2-8.39-244.65-44.95-40.89-20.63-72.69-52.45-93.33-93.35-36.61-72.53-42.01-164.5-44.96-244.65-1.29-35.22-1.28-69.05,0-104.27,2.79-77.3,7.72-158.78,38.19-230.43,50.48-118.68,171.19-141.72,287.88-149.74l20.65-1.42c12.28-.84,24.59.83,35.58-2.14h105.56v.02Z"/><path class="st0" d="M727.75,380.6c2.89,10.63,7.69,40.95,8.06,52.86,1.29,41.88-9.05,76.64-25.94,114.26-24.54,54.65-65.03,108.03-102.69,154.27l-5.86,7.19c-7.06,8.67-14.01,17.43-22.04,25.17-3.26,3.14-5.23,6.12-8.12,9.51-17.25,20.18-35.33,39.11-53.78,58.17-6.21,6.42-13.47,8.24-22.2,7.14-7.24-.92-12.12-5.35-17.46-11.6-11.74-13.72-26.83-25.05-33.41-39.36-13.85-30.16-16.82-54.1-13.83-87.74,1.47-16.6,5.62-31.77,12-46.75,5.46-12.81,14.19-22.26,25.04-30.46,22.55-17.05,36.86-5.83,66.62-7.37,17.91-.93,34.92-5.53,49.9-15.43,17.58-11.63,31.1-27.75,40.87-46.19,1.42-2.68.22-6-2.45-6.84-19.01-6.06-38.36-7.93-58.14-5.64-20.83,2.41-39,10.82-54.37,24.99-16.67,15.38-23.17,31.64-46.94,37.48,1.19-4.69,3.13-8.72,5.4-13.15l36.38-70.95,7.18-17.86c9.57-23.82,18.51-48.24,23.02-74.28,6.01-34.71,6.39-70.26-13.95-100.09-4.19-6.14-21.17-27.87-27.52-27.78-1.37.02-3.21,1.17-4.24,2.89-17.75,29.87-25.65,64.77-11.94,98.11,5.16,12.54,12.41,23.04,20.71,33.59,9.7,12.34,12.3,27.98,6.12,42.41-2.27,5.29-3.14,11.27-5.53,15.9-10.34,20.03-21.95,39.11-33.9,58.87l-28.39,46.96c-8.23-12.64-4.51-26.04-7.01-36.39.54-1.3-.06-3.33-.06-4.71,0-.78,0-1.58-.04-2.36-.02-.4-.26-.78-.33-1.18-1.36-7.64-3.2-15.11-5.82-22.4-4.57-12.73-11.19-25.22-21.03-35.46-14.83-15.43-33.61-25.67-53.96-32.05-2.1-.66-4.58.34-5.54,1.37-.68.73-1.53,2.21-1.73,3.98-4.85,42.16,4.63,75.77,37.95,103.23,9.57,7.89,27.47,16,31.45,21.41,15.92,21.67,7.51,51.1-4.32,73.38-5.93,11.18-17.37,18.02-29.19,18.61-12.12.61-24.61-5.4-31.2-15.41l-28.44-43.2c-26.72-40.59-52.53-102.8-52.98-152.48-.25-27.9,4.47-55.11,13.44-81.21,9.32-27.11,26.83-57.24,45.55-77.78,13.31-14.61,26.72-27.43,42.89-38.34,26.85-18.12,55.84-31.81,87.86-37.13l10.73-1.78c44.95-7.47,90.4-.62,132.17,17.99,54.35,24.22,97.19,68.85,120.2,123.87,4.28,10.23,8.11,19.74,10.83,29.75h-.02ZM559.35,403.18c44.29-1.14,75.95-27.96,79.68-70.93.87-10.06-32.51,1.85-37.34,3.92-12.56,5.4-22.12,14.11-30.05,25.03-5.51,7.59-15.34,31.18-12.29,41.97h0ZM467.12,478.83c8.04-20.25,6.88-51.1-1.97-68.15-4.89-19.78-34.67-43.62-53.68-48.68-5.12.28-5.45,8.85-5.86,12.39-3.09,26.92-.58,52.33,17.96,73.13,11.85,13.29,26.05,24.54,43.54,31.31h0ZM617.42,469.53c13.48-10.2,23.69-23.2,30.82-38.46.68-1.45.19-3.61-.41-4.53-.52-.78-1.71-1.79-3.41-2.12-30.78-6.04-55.07-6.42-81.38,13.38-12.79,9.62-22.51,22.09-29.46,36.46-1.28,2.66.3,5.54,3.13,6.23,28.17,6.87,56.63,7.25,80.71-10.96h0Z"/></svg>`;

    const successTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        :root { --primary: #2563eb; }
        body { font-family: 'Inter', sans-serif; }
        .bg-primary { background-color: var(--primary); }
        .text-primary { color: var(--primary); }
    </style>
</head>
<body class="bg-[#0f172a] min-h-screen flex items-center justify-center text-white p-6">
    <div id="content" class="w-full max-w-md text-center">
        <div id="loader" class="mb-8">
            <div class="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h1 class="text-3xl font-bold mb-2">Preparando...</h1>
            <p class="text-slate-400">Acompanhe o terminal para detalhes técnicos.</p>
        </div>
        
        <div id="steps" class="space-y-4 text-left mb-8 max-w-xs mx-auto">
             <div id="step-prepare" class="flex items-center gap-3 text-slate-500 transition-colors">
                <div class="w-2 h-2 rounded-full bg-current"></div> Conectando com Google
             </div>
             <div id="step-build" class="flex items-center gap-3 text-slate-500 transition-colors">
                <div class="w-2 h-2 rounded-full bg-current"></div> Compilando App (Build)
             </div>
             <div id="step-deploy" class="flex items-center gap-3 text-slate-500 transition-colors">
                <div class="w-2 h-2 rounded-full bg-current"></div> Enviando para o Ar (Deploy)
             </div>
        </div>
    </div>

    <script>
        function updateStep(id, status) {
            const el = document.getElementById('step-' + id);
            if (status === 'active') {
                el.classList.replace('text-slate-500', 'text-amber-400');
                el.classList.add('font-bold');
            } else if (status === 'done') {
                el.classList.replace('text-slate-500', 'text-primary');
                el.classList.replace('text-amber-400', 'text-primary');
                el.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg> ' + el.innerText;
            }
        }

        async function poll() {
            try {
                const r = await fetch('/status');
                const s = await r.json();
                
                if (s.stage === 'prepare') { document.querySelector('h1').innerText = 'Conectando...'; updateStep('prepare', 'active'); }
                if (s.stage === 'build') { updateStep('prepare', 'done'); updateStep('build', 'active'); document.querySelector('h1').innerText = 'Compilando...'; }
                if (s.stage === 'deploy') { updateStep('build', 'done'); updateStep('deploy', 'active'); document.querySelector('h1').innerText = 'Enviando...'; }
                
                if (s.stage === 'success') {
                    document.getElementById('content').innerHTML = \`
                        <div class="bg-white text-slate-900 rounded-[2.5rem] p-10 shadow-2xl transform animate-in fade-in zoom-in duration-500">
                            <div class="w-16 h-16 mx-auto mb-6">\${appIconSvg}</div>
                            <h1 class="text-3xl font-black mb-2 tracking-tight">Sistema Atualizado!</h1>
                            <p class="text-slate-500 mb-8 font-medium">Seu projeto já está no ar com as últimas melhorias.</p>
                            
                            <div class="space-y-3 mb-10 text-left">
                                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Domínio</p>
                                    <p class="font-mono text-sm font-bold text-primary">\${s.domain}</p>
                                </div>
                                <div class="grid grid-cols-2 gap-3">
                                    <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Versão</p>
                                        <p class="font-bold text-slate-700">\${s.version}</p>
                                    </div>
                                    <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                        <p class="font-bold text-green-600 italic">Online</p>
                                    </div>
                                </div>
                            </div>
                            
                            <a href="https://\${s.domain}" target="_blank" class="block w-full bg-primary text-white py-5 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all">Acessar Sistema 🚀</a>
                        </div>
                    \`;
                    return;
                }
                
                if (s.stage === 'error') {
                     document.getElementById('content').innerHTML = '<h1 class="text-2xl font-bold text-red-500">Erro na Atualização</h1><p class="mt-4">Verifique o terminal para detalhes.</p><button onclick="location.href=\'/\'" class="mt-8 bg-white/10 px-6 py-3 rounded-xl font-bold">Tentar Novamente</button>';
                     return;
                }
                
                setTimeout(poll, 1000);
            } catch(e) { setTimeout(poll, 2000); }
        }
        poll();
    </script>
</body>
</html>
`;

    const previewTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script>
    <style>
        :root { --primary: #2563eb; }
        .text-primary { color: var(--primary); }
    </style>
    <script>
        function check() {
            fetch('http://localhost:3000', { mode: 'no-cors' })
                .then(() => window.location.href = 'http://localhost:3000')
                .catch(() => setTimeout(check, 1000));
        }
        window.onload = check;
    </script>
</head>
<body class="bg-background min-h-screen flex items-center justify-center text-white text-center">
    <div>
        <div class="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
        <h1 class="text-2xl font-bold mb-2">Compilando Preview...</h1>
        <p class="text-slate-500">Isso pode levar alguns segundos na primeira vez.</p>
    </div>
</body>
</html>
`;

    // Static server state
    let deploymentState = { stage: 'idle', projectId: '', version: localVersion, domain: publicDomain };

    // Helper to open URL
    function openUrl(url) {
        const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
        exec(start + ' ' + url);
    }

    const server = http.createServer((req, res) => {
        if (req.method === 'GET' && req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(htmlTemplate);
        } else if (req.method === 'GET' && req.url === '/remote-version') {
            if (!currentProjectId) { res.writeHead(200); res.end('(Projeto não definido)'); return; }
            const domain = `${currentProjectId}.web.app`;
            console.log(`📡 Buscando versão em: https://${domain}...`);

            const options = {
                hostname: domain,
                port: 443,
                path: '/',
                method: 'GET',
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
            };

            https.get(options, (hRes) => {
                let data = '';
                hRes.on('data', d => {
                    data += d;
                    if (data.length > 150000) {
                        hRes.destroy();
                    }
                });
                hRes.on('end', () => {
                    // Refined regex: look for 'v' followed by characters that aren't digits (like comments or quotes), then the version number
                    const m = data.match(/v[^0-9]{0,15}(\d+\.\d+\.\d+(?:-beta)?)/);
                    const found = m ? `v${m[1]}` : '(Não encontrada)';
                    console.log(`🔍 Versão encontrada: ${found}`);
                    res.writeHead(200); res.end(found);
                });
            }).on('error', (err) => {
                console.error(`❌ Erro de conexão: ${err.message}`);
                res.writeHead(200); res.end('(Erro de Conexão)');
            });
        } else if (req.method === 'GET' && req.url === '/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(deploymentState));
        } else if (req.method === 'POST' && req.url === '/trigger-update') {
            if (!hasEnv) { res.writeHead(400); res.end("Erro"); return; }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(successTemplate);

            let projectId = null;
            const firebaseRcPath = path.join(__dirname, '..', '.firebaserc');
            if (fs.existsSync(firebaseRcPath)) {
                try {
                    const rc = JSON.parse(fs.readFileSync(firebaseRcPath, 'utf8'));
                    projectId = rc.projects ? rc.projects.default : null;
                } catch (e) { }
            }

            if (!projectId) {
                const envContent = fs.readFileSync(envPath, 'utf8');
                const match = envContent.match(/NEXT_PUBLIC_FIREBASE_PROJECT_ID="([^"]+)"/);
                projectId = match ? match[1] : null;
                if (projectId) fs.writeFileSync(firebaseRcPath, JSON.stringify({ projects: { default: projectId } }, null, 2));
            }

            if (projectId) {
                deploymentState.projectId = projectId;
                deploymentState.domain = `${projectId}.web.app`;
                setTimeout(() => { continueDeployment(deploymentState); }, 1000);
            } else { process.exit(1); }

        } else if (req.method === 'POST' && req.url === '/trigger-preview') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(previewTemplate);
            setTimeout(() => { server.close(); startPreview(); }, 1000);

        } else if (req.method === 'POST' && req.url === '/save') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', () => {
                const formData = new URLSearchParams(body);
                const config = Object.fromEntries(formData);

                // Preserve existing FIREBASE_HOSTING_SITES if present
                let existingSites = '';
                if (fs.existsSync(envPath)) {
                    const currentEnv = fs.readFileSync(envPath, 'utf8');
                    const match = currentEnv.match(/FIREBASE_HOSTING_SITES="([^"]*)"/);
                    if (match) existingSites = match[1];
                }

                const envContent = [
                    'NEXT_PUBLIC_FIREBASE_API_KEY="' + config.apiKey.trim() + '"',
                    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="' + config.authDomain.trim() + '"',
                    'NEXT_PUBLIC_FIREBASE_PROJECT_ID="' + config.projectId.trim() + '"',
                    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="' + config.storageBucket.trim() + '"',
                    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="' + config.messagingSenderId.trim() + '"',
                    'NEXT_PUBLIC_FIREBASE_APP_ID="' + config.appId.trim() + '"',
                    'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="' + (config.measurementId ? config.measurementId.trim() : '') + '"',
                    'NEXT_PUBLIC_ADMIN_EMAIL="' + config.adminEmail.trim() + '"',
                    'FIREBASE_CLIENT_EMAIL="' + (config.clientEmail ? config.clientEmail.trim() : '') + '"',
                    'FIREBASE_PRIVATE_KEY="' + (config.privateKey ? config.privateKey.trim().replace(/\\n/g, '\\n') : '') + '"',
                    'FIREBASE_HOSTING_SITES="' + existingSites + '"',
                    ''
                ].join('\n');
                fs.writeFileSync(envPath, envContent);

                const firebaseRcPath = path.join(__dirname, '..', '.firebaserc');
                fs.writeFileSync(firebaseRcPath, JSON.stringify({ projects: { default: config.projectId.trim() } }, null, 2));

                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(successTemplate);

                deploymentState.projectId = config.projectId.trim();
                deploymentState.domain = `${config.projectId.trim()}.web.app`;
                setTimeout(() => { continueDeployment(deploymentState); }, 1000);
            });
        }
    });

    // Dynamic Port Selection
    const startPort = 3456;
    function startServer(port) {
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`Porta ${port} ocupada, tentando ${port + 1}...`);
                startServer(port + 1);
            } else {
                console.error("Erro fatal ao iniciar servidor:", err);
                process.exit(1);
            }
        });

        server.listen(port, () => {
            console.log("Configurador Campo Branco ouvindo na porta " + port);
            openUrl('http://localhost:' + port);
        });
    }

    startServer(startPort);
}

function continueDeployment(state) {
    try {
        state.stage = 'prepare';
        console.log("\n--- CONECTANDO COM O GOOGLE ---");
        try { execSync('npx firebase login', { stdio: 'inherit', shell: true }); } catch (e) { }

        state.stage = 'build';
        console.log("\n--- CONSTRUINDO APP (BUILD) ---");
        try { execSync('npm run build', { stdio: 'inherit', shell: true }); } catch (e) {
            state.stage = 'error';
            return;
        }

        state.stage = 'deploy';
        console.log("\n--- ENVIANDO PARA O AR (DEPLOY) ---");

        let extraSites = '';
        const sitesFilePath = path.join(__dirname, '..', 'firebase-sites.txt');
        const tempFirebaseConfigPath = path.join(__dirname, '..', 'firebase-deploy.json');

        if (fs.existsSync(sitesFilePath)) {
            extraSites = fs.readFileSync(sitesFilePath, 'utf8').trim();
            console.log(`📂 Lendo sites do arquivo: firebase-sites.txt`);
        } else if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const match = envContent.match(/FIREBASE_HOSTING_SITES="([^"]*)"/);
            if (match) extraSites = match[1];
        }

        try {
            // 1. Deploy Firestore and Storage once
            console.log("🔥 Deploying Firestore & Storage...");
            execSync(`npx firebase deploy --project ${state.projectId} --only firestore,storage`, { stdio: 'inherit', shell: true });

            // 2. Handle Hosting
            if (extraSites) {
                const siteList = extraSites.split(',').map(s => s.trim()).filter(s => s !== '');
                console.log(`📡 Deploy Multi-Site Detectado: ${siteList.join(', ')}`);

                // Create temporary config with unique targets
                const originalConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firebase.json'), 'utf8'));
                const baseHosting = Array.isArray(originalConfig.hosting) ? originalConfig.hosting[0] : originalConfig.hosting;

                const hostingArray = siteList.map(siteId => {
                    const targetName = `target_${siteId.replace(/[^a-z0-9]/g, '_')}`;
                    console.log(`🎯 Mapeando target: ${targetName} -> ${siteId}`);
                    execSync(`npx firebase target:apply hosting ${targetName} ${siteId} --project ${state.projectId}`, { stdio: 'inherit', shell: true });

                    const hConfig = JSON.parse(JSON.stringify(baseHosting));
                    hConfig.target = targetName;
                    return hConfig;
                });

                const tempConfig = JSON.parse(JSON.stringify(originalConfig));
                tempConfig.hosting = hostingArray;
                fs.writeFileSync(tempFirebaseConfigPath, JSON.stringify(tempConfig, null, 2));

                console.log(`\n🚀 Iniciando deploy unificado para todos os sites...`);
                execSync(`npx firebase deploy --project ${state.projectId} --only hosting --config firebase-deploy.json`, { stdio: 'inherit', shell: true });

                // Cleanup
                if (fs.existsSync(tempFirebaseConfigPath)) fs.unlinkSync(tempFirebaseConfigPath);
            } else {
                // Standard single site deploy
                console.log("🚀 Deploying Hosting (Padrão)...");
                execSync(`npx firebase deploy --project ${state.projectId} --only hosting`, { stdio: 'inherit', shell: true });
            }
        } catch (e) {
            if (fs.existsSync(tempFirebaseConfigPath)) fs.unlinkSync(tempFirebaseConfigPath);
            state.stage = 'error';
            return;
        }

        state.stage = 'success';
        console.log("\n🎉 PROJETO ATUALIZADO COM SUCESSO!");
        console.log(`📡 URL: https://${state.domain}`);

        // Wait a bit to let the user see the success page before potentially closing (though browser keeps it)
        setTimeout(() => { process.exit(0); }, 30000);
    } catch (e) {
        state.stage = 'error';
    }
}

function startPreview() {
    console.log("\n--- INICIANDO SERVIDOR LOCAL ---");
    try { execSync('npm run dev', { stdio: 'inherit', shell: true }); } catch (e) { process.exit(1); }
}
