const { spawn } = require('child_process');
const path = require('path');

// ANSI Escape Codes for Colors
const RESET = "\x1b[0m";
const BRIGHT = "\x1b[1m";
const FG_YELLOW = "\x1b[33m";
const FG_RED = "\x1b[31m";
const FG_CYAN = "\x1b[36m";
const FG_WHITE = "\x1b[37m";
const BG_RED = "\x1b[41m";

console.clear();
console.log('\n');
console.log(' ' + BG_RED + FG_WHITE + BRIGHT + '  AMBIENTE DE PREVIEW LOCAL  ' + RESET);
console.log('\n' + FG_YELLOW + '⚠️  ATENÇÃO: LEIA COM CUIDADO' + RESET);
console.log(FG_YELLOW + '==================================================' + RESET);
console.log(BRIGHT + 'Você está rodando uma versão LOCAL do sistema.' + RESET);
console.log('Tudo o que você fizer ou ver aqui está rodando');
console.log('apenas no seu computador (' + FG_CYAN + 'localhost' + RESET + ').');
console.log('\n' + FG_RED + '⚠️  Tudo o que você fizer aqui AFETA o banco de dados real.');
console.log('⚠️  DADOS SÃO REAIS (Conectado ao banco de produção).');
console.log(FG_YELLOW + '==================================================' + RESET);
console.log('\n' + FG_CYAN + 'ℹ️  Alterações visuais precisam de ' + BRIGHT + 'DEPLOY' + RESET + ' para subir.');
console.log('   você deve executar o comando de ' + BRIGHT + 'DEPLOY' + RESET + '.');
console.log('\n' + 'Iniciando servidor de desenvolvimento...\n');

// Give user time to read
setTimeout(() => {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const dev = spawn(npm, ['run', 'dev'], {
        stdio: 'inherit',
        shell: true
    });

    dev.on('close', (code) => {
        process.exit(code);
    });
}, 2000);
