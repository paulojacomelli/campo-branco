# Filosofia Central do Projeto - Campo Branco

Este documento estabelece as diretrizes fundamentais para todo o desenvolvimento, arquitetura e decisões de código do projeto **Campo Branco**. 
Ao auxiliar ou escrever código para este projeto, a IA e os desenvolvedores DEVEM priorizar e seguir estritamente estes três pilares:

## 1. Conservadorismo e Resiliência (Tolerância a Falhas)
O aplicativo deve funcionar impecavelmente mesmo sob condições adversas (redes lentas, falhas de banco de dados, erros de sistema).
* **Tratamento de Erros:** Nenhuma tela deve ficar com "carregamento infinito". Todo estado de "Loading" deve ter um timeout de segurança (ex: 10-12s) que ofereça uma mensagem amigável e a opção de tentar novamente.
* **Degradação Graciosa:** Se um recurso secundário falhar, o recurso principal ainda deve funcionar.
* **Logs Limpos:** Erros externos (como injeções de extensões de navegador) devem ser filtrados. Apenas erros reais do sistema devem ser armazenados e notificados.

## 2. Otimização Extrema (Velocidade e Banco de Dados)
Sendo um projeto voluntário com recursos limitados de servidor, a comunicação com o banco de dados (Supabase) deve ser cirúrgica.
* **Otimização de Consultas:** Evite o problema "N+1". Relacionamentos devem ser resolvidos diretamente no banco com `JOINs` (ou selects integrados no Supabase) em vez de múltiplos laços `for` no front-end.
* **Segurança e Performance (RLS):** Toda função SQL usada em *Row Level Security* (RLS) deve ser declarada como `STABLE` (sempre que possível) e preferencialmente escrita em `LANGUAGE sql` para usar o cache de consulta do PostgreSQL. Isso evita que a mesma permissão seja recalculada milhares de vezes.
* **Tempo Real Ponderado:** Use `subscriptions` (Websockets) apenas onde for necessário para a experiência em tempo real pontual. Garanta sempre o `unsubscribe` na desmontagem dos componentes para economizar conexões simultâneas.
* **Cache Inteligente:** Sempre que possível, utilize cache no lado do cliente ou requisições deduplicadas para evitar ir ao servidor buscar o mesmo dado repetidas vezes.

## 3. Design Mobile-First
* **Responsividade Nativa:** A interface inteira deve ser pensada *primeiro* para uso em celulares verticais na rua sob a luz do sol.
* **Botões e Toques:** Alvos de clique grandes (mínimo de 44x44px), botões de ação fixos na base da tela (BottomNav) e feedback visual (ex: loaders nos botões ao clicar).
* **Layout Fluido:** O uso em Desktop deve ser apenas uma expansão amigável da versão Mobile (painéis maiores, tabelas completas, cards em grade), nunca o foco primário no momento da prototipagem.
