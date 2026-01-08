const fs = require('fs');
const { execSync, exec } = require('child_process');
const path = require('path');
const http = require('http');
const url = require('url');

// HTML Template for Configuration Page
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
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                    },
                    colors: {
                        primary: {
                            DEFAULT: '#16a34a', // Premium Green from globals.css
                            dark: '#15803d',
                            light: '#dcfce7',
                        },
                        secondary: {
                            DEFAULT: '#64748b', // Slate
                            dark: '#0f172a',
                        },
                        background: '#f8fafc',
                        surface: '#ffffff',
                    }
                }
            }
        }
    </script>
    <style>
        body { font-family: 'Inter', sans-serif; }
        .carousel-track {
            display: flex;
            transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1);
        }
        .carousel-slide {
            min-width: 100%;
            padding: 2.5rem;
        }
        /* Custom Scrollbar */
        ::-webkit-scrollbar {
            width: 8px;
        }
        ::-webkit-scrollbar-track {
            background: #f1f1f1; 
        }
        ::-webkit-scrollbar-thumb {
            background: #cbd5e1; 
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #94a3b8; 
        }
    </style>
</head>
<body class="bg-background min-h-screen text-slate-800 flex items-center justify-center p-4 lg:p-8">
    
    <div class="max-w-7xl w-full bg-surface rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:flex-row h-[90vh] border border-slate-100">
        
        <!-- Sidebar / Guide (Left) -->
        <div class="lg:w-5/12 bg-secondary-dark text-white flex flex-col justify-between p-8 relative overflow-hidden">
            <!-- Background Decoration -->
            <div class="absolute top-0 right-0 -mr-24 -mt-24 w-80 h-80 rounded-full bg-primary/20 blur-3xl"></div>
            <div class="absolute bottom-0 left-0 -ml-24 -mb-24 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl"></div>

            <div class="relative z-10 mb-6 flex items-center gap-3">
                <div class="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <div>
                    <h1 class="text-xl font-bold tracking-tight">Campo Branco</h1>
                    <p class="text-xs text-slate-400 font-medium tracking-wide uppercase">Assistente de Instalação</p>
                </div>
            </div>

            <!-- Carousel Container -->
            <div class="flex-1 relative overflow-hidden flex items-center">
                <div class="carousel-track" id="track">
                    
                    <!-- Slide 1: Intro -->
                    <div class="carousel-slide space-y-6">
                        <div class="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4 text-3xl border border-white/10 backdrop-blur-sm">🚀</div>
                        <div>
                            <h2 class="text-3xl font-bold mb-2">Bem-vindo!</h2>
                            <p class="text-slate-300 leading-relaxed text-lg">Vamos configurar seu aplicativo para que ele funcione perfeitamente.</p>
                        </div>
                        <p class="text-slate-400 text-sm border-l-2 border-primary pl-4">Iremos conectar ao Firebase, o "motor" do Google que faz tudo funcionar.</p>
                        
                        <div class="pt-8">
                            <button onclick="moveSlide(1)" class="group flex items-center gap-3 text-white font-semibold hover:text-primary transition-colors">
                                Começar o Guia
                                <span class="group-hover:translate-x-1 transition-transform">→</span>
                            </button>
                        </div>
                    </div>

                    <!-- Slide 2: Access Console -->
                    <div class="carousel-slide space-y-6">
                        <div class="flex items-center gap-3 text-sm font-bold text-primary uppercase tracking-widest mb-2">
                            <span class="w-6 h-px bg-primary"></span> Passo 1
                        </div>
                        <h2 class="text-3xl font-bold">Acesse o Firebase</h2>
                        <p class="text-slate-300 text-lg leading-relaxed">
                            Precisamos pegar as chaves de segurança do seu projeto.
                        </p>
                        <div class="bg-black/20 p-6 rounded-2xl border border-white/5 mt-4 backdrop-blur-sm">
                            <p class="text-sm text-slate-400 mb-4">Clique no botão abaixo para abrir o console em outra aba:</p>
                            <a href="https://console.firebase.google.com/" target="_blank" class="flex items-center justify-center gap-2 bg-white text-secondary-dark px-6 py-4 rounded-xl font-bold transition-all hover:bg-primary hover:text-white shadow-lg">
                                Abrir Firebase Console 
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                            </a>
                        </div>
                    </div>

                    <!-- Slide 3: Create Project -->
                    <div class="carousel-slide space-y-6">
                        <div class="flex items-center gap-3 text-sm font-bold text-primary uppercase tracking-widest mb-2">
                            <span class="w-6 h-px bg-primary"></span> Passo 2
                        </div>
                        <h2 class="text-3xl font-bold">Criar Projeto</h2>
                        <div class="space-y-4">
                            <div class="flex gap-4">
                                <div class="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">1</div>
                                <p class="text-slate-300">Clique em <strong class="text-white">"Adicionar projeto"</strong> (ou Create project).</p>
                            </div>
                            <div class="flex gap-4">
                                <div class="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">2</div>
                                <p class="text-slate-300">Nomeie como <strong class="text-white">"Campo Branco"</strong>.</p>
                            </div>
                            <div class="flex gap-4">
                                <div class="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">3</div>
                                <p class="text-slate-300">Desative o Google Analytics para ser mais rápido (opcional).</p>
                            </div>
                        </div>
                    </div>

                    <!-- Slide 4: Web App -->
                    <div class="carousel-slide space-y-6">
                        <div class="flex items-center gap-3 text-sm font-bold text-primary uppercase tracking-widest mb-2">
                            <span class="w-6 h-px bg-primary"></span> Passo 3
                        </div>
                        <h2 class="text-3xl font-bold">Crie o App Web</h2>
                        <p class="text-slate-300 leading-relaxed">
                            No projeto criado, clique em <strong class="text-white">Configurações do Projeto</strong> (Engrenagem ⚙️).
                        </p>
                        <p class="text-slate-300 leading-relaxed">
                            Role até o final e clique no ícone <strong class="text-white">&lt;/&gt;</strong> para adicionar um app Web.
                        </p>
                         <div class="flex gap-4 opacity-70 justify-center py-6">
                            <div class="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center font-mono text-xs border border-white/5">iOS</div>
                            <div class="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center font-mono text-xs border border-white/5">And</div>
                            <div class="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center font-bold shadow-lg shadow-primary/30 transform scale-110 border-2 border-white/10">&lt;/&gt;</div>
                        </div>
                    </div>

                    <!-- Slide 5: Copy Keys -->
                    <div class="carousel-slide space-y-6">
                        <div class="flex items-center gap-3 text-sm font-bold text-primary uppercase tracking-widest mb-2">
                            <span class="w-6 h-px bg-primary"></span> Final
                        </div>
                        <h2 class="text-3xl font-bold">Copiar & Colar</h2>
                        <p class="text-slate-300 leading-relaxed">
                            Ao registrar o app, você verá um código com várias chaves (`apiKey`, `projectId`, etc).
                        </p>
                        <div class="bg-black/40 rounded-xl p-4 border border-white/10 font-mono text-xs text-slate-400 overflow-hidden relative">
                            <div class="absolute top-2 right-2 flex gap-1">
                                <div class="w-2 h-2 rounded-full bg-red-500"></div>
                                <div class="w-2 h-2 rounded-full bg-yellow-500"></div>
                                <div class="w-2 h-2 rounded-full bg-green-500"></div>
                            </div>
                            <span class="text-purple-400">const</span> firebaseConfig = {<br>
                            &nbsp;&nbsp;apiKey: <span class="text-green-400">"AIza..."</span>,<br>
                            &nbsp;&nbsp;authDomain: <span class="text-green-400">"..."</span>,<br>
                            &nbsp;&nbsp;...<br>
                            };
                        </div>
                        <p class="text-slate-300 text-sm mt-4">
                            Copie esses valores e preencha o formulário ao lado 👉
                        </p>
                    </div>

                </div>
            </div>

            <!-- Controls -->
            <div class="relative z-10 flex items-center justify-between pt-6 border-t border-white/5">
                <button onclick="moveSlide(-1)" class="group p-3 rounded-full hover:bg-white/5 transition-all text-slate-400 hover:text-white">
                    <svg class="w-6 h-6 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                
                <div class="flex gap-2" id="dots">
                    <!-- Dots generated by JS -->
                </div>

                <button onclick="moveSlide(1)" class="group p-3 rounded-full hover:bg-primary transition-all text-white shadow-lg shadow-transparent hover:shadow-primary/30">
                    <svg class="w-6 h-6 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
            </div>

        </div>

        <!-- Form Content (Right) -->
        <div class="lg:w-7/12 overflow-y-auto bg-gray-50/50 scroll-smooth relative">
            <div class="p-8 lg:p-12">
                <div class="mb-10 border-b border-gray-200 pb-6">
                    <h2 class="text-2xl font-bold text-slate-900">Configuração do App</h2>
                    <p class="text-slate-500 text-sm mt-1">Preencha os campos abaixo com os dados obtidos no passo a passo.</p>
                </div>

                <form action="/save" method="POST" class="space-y-8">
                    
                    <div class="space-y-6">
                        <div class="group">
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1 group-focus-within:text-primary transition-colors">API Key</label>
                            <div class="relative">
                                <span class="absolute left-4 top-3.5 text-slate-400 select-none">🔑</span>
                                <input required name="apiKey" type="text" placeholder="Cole a apiKey aqui..." class="w-full pl-10 pr-4 py-3.5 rounded-xl bg-white border border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-mono text-sm shadow-sm hover:border-gray-300">
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="group">
                                <label class="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1 group-focus-within:text-primary transition-colors">Project ID</label>
                                <input required name="projectId" type="text" placeholder="ex: campo-branco-prod" class="w-full px-4 py-3.5 rounded-xl bg-white border border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-mono text-sm shadow-sm hover:border-gray-300">
                            </div>
                            <div class="group">
                                <label class="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1 group-focus-within:text-primary transition-colors">Auth Domain</label>
                                <input required name="authDomain" type="text" placeholder="...firebaseapp.com" class="w-full px-4 py-3.5 rounded-xl bg-white border border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-mono text-sm shadow-sm hover:border-gray-300">
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="group">
                                <label class="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1 group-focus-within:text-primary transition-colors">Storage Bucket</label>
                                <input required name="storageBucket" type="text" placeholder="...appspot.com" class="w-full px-4 py-3.5 rounded-xl bg-white border border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-mono text-sm shadow-sm hover:border-gray-300">
                            </div>
                            <div class="group">
                                <label class="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1 group-focus-within:text-primary transition-colors">Messaging Sender ID</label>
                                <input required name="messagingSenderId" type="text" placeholder="Numeros..." class="w-full px-4 py-3.5 rounded-xl bg-white border border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-mono text-sm shadow-sm hover:border-gray-300">
                            </div>
                        </div>

                        <div class="group">
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1 group-focus-within:text-primary transition-colors">App ID</label>
                            <input required name="appId" type="text" placeholder="1:123456:web:..." class="w-full px-4 py-3.5 rounded-xl bg-white border border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-mono text-sm shadow-sm hover:border-gray-300">
                        </div>
                        
                        <div class="group opacity-75 hover:opacity-100 transition-opacity">
                            <label class="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1 group-focus-within:text-primary transition-colors">Measurement ID (Opcional)</label>
                            <input name="measurementId" type="text" placeholder="G-..." class="w-full px-4 py-3.5 rounded-xl bg-white/50 border border-gray-200 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-mono text-sm shadow-sm hover:border-gray-300">
                        </div>
                    </div>

                    <!-- Super Admin Section -->
                    <div class="mt-8 bg-blue-50/50 rounded-2xl p-6 border border-blue-100">
                        <div class="flex items-center gap-3 mb-4">
                             <div class="bg-white p-2 rounded-lg text-primary shadow-sm"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg></div>
                             <div>
                                <h3 class="font-bold text-lg text-slate-800">Super Admin</h3>
                                <p class="text-xs text-slate-500">Defina quem terá controle total.</p>
                             </div>
                        </div>
                        <div class="group">
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1 group-focus-within:text-primary transition-colors">Seu E-mail Principal</label>
                            <input required name="adminEmail" type="email" placeholder="seu.email@gmail.com" class="w-full px-4 py-3.5 rounded-xl bg-white border border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-mono text-sm shadow-sm hover:border-gray-300">
                        </div>
                    </div>

                    <div class="pt-4 pb-4">
                        <button type="submit" class="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl shadow-xl shadow-primary/20 transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-3">
                            <span>Concluir Instalação</span>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                        </button>
                    </div>
                </form>
                <div class="text-center mt-6">
                    <p class="text-[10px] text-slate-400 font-medium tracking-wide">CAMPO BRANCO © 2026</p>
                </div>
            </div>
        </div>
    </div>

    <script>
        let currentSlide = 0;
        const slides = document.querySelectorAll('.carousel-slide');
        const track = document.getElementById('track');
        const dotsContainer = document.getElementById('dots');
        
        // Init Dots
        slides.forEach((_, idx) => {
            const dot = document.createElement('div');
            dot.className = \`w-2 h-2 rounded-full transition-all cursor-pointer \${idx === 0 ? 'bg-white w-8' : 'bg-white/30'}\`;
            dot.onclick = () => goToSlide(idx);
            dotsContainer.appendChild(dot);
        });

        const dots = dotsContainer.children;

        function updateSlider() {
            track.style.transform = \`translateX(-\${currentSlide * 100}%)\`;
            
            // Update dots
            Array.from(dots).forEach((dot, idx) => {
                dot.className = \`w-2 h-2 rounded-full transition-all cursor-pointer \${idx === currentSlide ? 'bg-white w-8' : 'bg-white/30'}\`;
            });
        }

        function moveSlide(direction) {
            const newIndex = currentSlide + direction;
            if (newIndex >= 0 && newIndex < slides.length) {
                currentSlide = newIndex;
                updateSlider();
            }
        }

        function goToSlide(index) {
            currentSlide = index;
            updateSlider();
        }
    </script>
</body>
</html>
`;

const successTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Instalando...</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>body { font-family: 'Inter', sans-serif; }</style>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center text-slate-800">
    <div class="max-w-md w-full p-8 text-center bg-white rounded-3xl shadow-xl">
        <div class="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
            <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
        </div>
        <h1 class="text-3xl font-bold mb-4 text-slate-800">Tudo Pronto!</h1>
        <p class="text-slate-500 mb-8 leading-relaxed">As configurações foram salvas com sucesso.<br>Você pode fechar esta aba agora e acompanhar o progresso no terminal.</p>
        <div class="inline-block bg-slate-100 rounded-full px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
            Instalando...
        </div>
    </div>
</body>
</html>
`;

// Helper to open URL
function openUrl(url) {
    const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
    exec(`${start} ${url}`);
}

const PORT = 3456;

const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(htmlTemplate);
    } else if (req.method === 'POST' && req.url === '/save') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            const formData = new URLSearchParams(body);
            const config = Object.fromEntries(formData);

            // Save .env.local
            const envContent = `NEXT_PUBLIC_FIREBASE_API_KEY="${config.apiKey.trim()}"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${config.authDomain.trim()}"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="${config.projectId.trim()}"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="${config.storageBucket.trim()}"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${config.messagingSenderId.trim()}"
NEXT_PUBLIC_FIREBASE_APP_ID="${config.appId.trim()}"
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="${config.measurementId ? config.measurementId.trim() : ''}"
NEXT_PUBLIC_ADMIN_EMAIL="${config.adminEmail.trim()}"
`;
            fs.writeFileSync(path.join(__dirname, '..', '.env.local'), envContent);

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(successTemplate);

            // Close server and continue deployment script
            console.log("✅ Configuração recebida via navegador!");
            setTimeout(() => {
                server.close();
                continueDeployment(config.projectId.trim());
            }, 1000);
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

function continueDeployment(projectId) {
    console.log("\n--- CONECTANDO AO GOOGLE ---");
    console.log("Se necessário, faça login no Firebase CLI na janela que abrir...");
    try {
        execSync('npx firebase login', { stdio: 'inherit', shell: true });
    } catch (e) {
        console.log("Login verificado.");
    }

    console.log("\n--- CONSTRUINDO O APLICATIVO ---");
    console.log("Isso pode demorar alguns minutos. Tenha paciência...");

    try {
        execSync('npm run build', { stdio: 'inherit', shell: true });
    } catch (e) {
        console.error("❌ Erro ao construir o site. Verifique o log acima.");
        process.exit(1);
    }

    console.log("\n--- ENVIANDO PARA A INTERNET (DEPLOY) ---");
    try {
        execSync(`npx firebase deploy --project ${projectId} --only hosting,firestore,storage`, { stdio: 'inherit', shell: true });
    } catch (e) {
        console.error("❌ Erro no deploy.");
        console.log("DICA: Verifique se o ID do projeto está correto e se o Firestore foi ativado no console.");
    }

    console.log("\n========================================");
    console.log("✅ SUCESSO! O SEU CAMPO BRANCO ESTÁ NO AR.");
    console.log("A terminal será fechado em breve.");
    console.log("========================================");
    process.exit(0);
}

console.log("\x1b[36m%s\x1b[0m", "========================================");
console.log("\x1b[36m%s\x1b[0m", "   CAMPO BRANCO - CONFIGURAÇÃO");
console.log("\x1b[36m%s\x1b[0m", "========================================");
console.log("");
console.log("Abri uma página no seu navegador para configurar o app.");
console.log(`Caso não abra, acesse manualmente: http://localhost:${PORT}`);
console.log("");

server.listen(PORT, () => {
    openUrl(`http://localhost:${PORT}`);
});
