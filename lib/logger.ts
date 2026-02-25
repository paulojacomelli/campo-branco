// lib/logger.ts
// Utilitário para coletar logs do console para o sistema de Bug Reports

const MAX_LOGS = 50;
let logs: string[] = [];
let errorCount = 0; // Contador de erros para notificar o botão flutuante

if (typeof window !== 'undefined') {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
        addLog('LOG', args);
        originalLog.apply(console, args);
    };

    console.error = (...args) => {
        const errorMsg = String(args[0] || '');
        // Ignora erros comuns de extensões do navegador que poluem o console
        if (errorMsg.includes('message channel closed') || errorMsg.includes('Extension context invalidated')) {
            originalError.apply(console, args);
            return;
        }

        addLog('ERROR', args);
        errorCount++;
        // Dispara um evento customizado para notificar o botão flutuante de bug
        window.dispatchEvent(new CustomEvent('console-error', { detail: { count: errorCount } }));
        originalError.apply(console, args);
    };

    console.warn = (...args) => {
        addLog('WARN', args);
        originalWarn.apply(console, args);
    };
}

function addLog(level: string, args: any[]) {
    try {
        const firstArg = String(args[0] || '');
        if (firstArg.includes('message channel closed') || firstArg.includes('Extension context invalidated')) {
            return;
        }

        const time = new Date().toLocaleTimeString('pt-BR');
        const message = args.map(arg => {
            if (arg instanceof Error) {
                return `${arg.name}: ${arg.message}${arg.stack ? `\n${arg.stack}` : ''}`;
            }
            if (typeof arg === 'object' && arg !== null) {
                try {
                    return JSON.stringify(arg);
                } catch (e) {
                    return '[Unserializable Object]';
                }
            }
            return String(arg);
        }).join(' ');

        logs.push(`[${time}] [${level}] ${message}`);

        if (logs.length > MAX_LOGS) {
            logs.shift();
        }
    } catch (e) {
        // Ignora erros na coleta de logs
    }
}

export const getConsoleLogs = () => logs;
export const clearConsoleLogs = () => { logs = []; };
export const getErrorCount = () => errorCount;
export const resetErrorCount = () => { errorCount = 0; };
