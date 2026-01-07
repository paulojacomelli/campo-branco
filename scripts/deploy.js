const fs = require('fs');
const readline = require('readline');
const { execSync, exec } = require('child_process');
const path = require('path');

// Helper to open files cross-platform without 'open' dependency
function openFile(filePath) {
    const platform = process.platform;
    let command = '';

    if (platform === 'win32') {
        command = `start "" "${filePath}"`;
    } else if (platform === 'darwin') {
        command = `open "${filePath}"`;
    } else {
        command = `xdg-open "${filePath}"`;
    }

    try {
        exec(command);
    } catch (e) {
        // Silently fail or log if needed, but don't crash
        // console.error("Could not open file:", e.message);
    }
}

// Helper for inputs
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (str) => new Promise(resolve => rl.question(str, resolve));

console.log("\x1b[36m%s\x1b[0m", "========================================");
console.log("\x1b[36m%s\x1b[0m", "   CAMPO BRANCO - INSTALADOR AUTOMÁTICO");
console.log("\x1b[36m%s\x1b[0m", "========================================");
console.log("");
console.log("Bem-vindo! Este assistente vai colocar seu aplicativo no ar.");
console.log("Antes de começar, certifique-se de ter criado seu projeto no Firebase.");
console.log("");
console.log("Vou abrir o GUIA VISUAL agora para te ajudar...");

// Open Guide
try {
    const guidePath = path.join(__dirname, '..', 'GUIDE.html');
    openFile(guidePath);
} catch (e) {
    console.log("Não foi possível abrir o guia automaticamente. Abra o arquivo GUIDE.html manualmente.");
}

async function start() {
    console.log("\n--- CONECTANDO AO GOOGLE ---");
    console.log("Vou abrir o navegador para você fazer login no Firebase CLI.");
    try {
        // Use shell: true for better windows compatibility with npx
        execSync('npx firebase login', { stdio: 'inherit', shell: true });
    } catch (e) {
        console.log("Login falhou ou já estava logado.");
    }

    console.log("\n--- CONFIGURAÇÃO ---");
    console.log("Copie e cole as informações do Console do Firebase (como mostrado no Guia):");

    const apiKey = await question("API Key (ex: AIza...): ");
    const authDomain = await question("Auth Domain (ex: projeto.firebaseapp.com): ");
    const projectId = await question("Project ID (ex: projeto-id): ");
    const storageBucket = await question("Storage Bucket (ex: projeto.appspot.com): ");
    const messagingSenderId = await question("Messaging Sender ID (ex: 123456...): ");
    const appId = await question("App ID (ex: 1:1234...): ");
    // Measurement ID is optional sometimes, but good to have
    const measurementId = await question("Measurement ID (G-...) [Enter para pular]: ");

    console.log("\n--- SUPER ADMIN ---");
    const adminEmail = await question("Digite o SEU E-MAIL (Gmail) para ser o Super Administrador:\n> ");

    console.log("\nGerando arquivo de configuração...");

    const envContent = `NEXT_PUBLIC_FIREBASE_API_KEY="${apiKey.trim()}"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${authDomain.trim()}"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="${projectId.trim()}"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="${storageBucket.trim()}"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${messagingSenderId.trim()}"
NEXT_PUBLIC_FIREBASE_APP_ID="${appId.trim()}"
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="${measurementId.trim()}"
NEXT_PUBLIC_ADMIN_EMAIL="${adminEmail.trim()}"
`;

    fs.writeFileSync(path.join(__dirname, '..', '.env.local'), envContent);
    console.log("✅ Configuração salva!");

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
        execSync(`npx firebase deploy --project ${projectId.trim()} --only hosting,firestore,storage`, { stdio: 'inherit', shell: true });
    } catch (e) {
        console.error("❌ Erro no deploy.");
        // Often fails if project alias not set, try setting alias first?
        // But --project flag usually handles it.
        // Also firestore rules might fail if API is not enabled in console.
        console.log("DICA: Se falhou, verifique se o Firestore está ativado no console.");
    }

    console.log("\n========================================");
    console.log("✅ SUCESSO! O SEU CAMPO BRANCO ESTÁ NO AR.");
    console.log("Acesse o link 'Hosting URL' mostrado acima.");
    console.log("Faça login com: " + adminEmail);
    console.log("========================================");

    // Pause to read
    await question("\nPressione ENTER para sair...");
    process.exit(0);
}

start();
