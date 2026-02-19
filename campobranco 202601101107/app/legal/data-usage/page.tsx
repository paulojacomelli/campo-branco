import { Shield, Server, Share2, Database, Lock, Scale } from 'lucide-react';

export default function DataUsagePage() {
    return (
        <article className="prose prose-slate dark:prose-invert max-w-none">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Database className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white m-0 leading-tight">Como Utilizamos seus Dados</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 m-0">Transparência jurídica e técnica sobre o tratamento de informações.</p>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8 not-prose">
                <div className="bg-gray-50 dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700">
                    <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-lg shadow-sm flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
                        <Scale className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">Papéis na LGPD</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                        O Campo Branco atua exclusivamente como <strong>OPERADOR DE DADOS</strong>, nos termos do Art. 5º, VII, da Lei Geral de Proteção de Dados (Lei nº 13.709/2018 – LGPD).
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                        O <strong>CONTROLADOR DOS DADOS</strong> é a congregação local usuária da plataforma, por meio de seus representantes responsáveis (anciãos e servos designados), que definem as finalidades, o uso, a manutenção e a exclusão das informações.
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        O Campo Branco não define finalidades, não decide sobre o conteúdo inserido e não utiliza os dados para fins próprios.
                    </p>
                </div>

                <div className="bg-gray-50 dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700">
                    <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-lg shadow-sm flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
                        <Lock className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">Segurança da Informação</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        São adotadas medidas técnicas e organizacionais adequadas, compatíveis com o estado da técnica e com os riscos envolvidos, conforme o Art. 46 da LGPD, com o objetivo de proteger os dados pessoais contra acessos não autorizados, vazamentos, perdas ou usos indevidos.
                    </p>
                </div>
            </div>

            <section className="space-y-6 text-gray-600 dark:text-gray-300">

                <h3>1. Base Legal e Finalidade do Tratamento</h3>
                <p>O tratamento de dados pessoais ocorre com fundamento no:</p>
                <ul className="list-disc pl-5 space-y-2 marker:text-indigo-500">
                    <li>legítimo interesse</li>
                    <li>exercício regular de atividade religiosa</li>
                    <li>assistência e cuidado pastoral</li>
                </ul>
                <p>conforme os Arts. 7º, IX, e 11, II, “f”, da LGPD.</p>
                <p>
                    A finalidade do tratamento é estritamente organizacional e pastoral, visando apoiar a eficiência do trabalho voluntário e a condução respeitosa das atividades religiosas, sem qualquer viés comercial, publicitário ou econômico.
                </p>

                <h3>2. Inventário e Natureza dos Dados</h3>

                <div className="my-6 space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-xl border border-blue-100 dark:border-blue-800">
                        <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2 mt-0">A. Dados Pessoais Comuns</h4>
                        <p className="text-sm font-bold text-blue-900 dark:text-blue-200 mt-2">Moradores (quando informados):</p>
                        <ul className="list-disc pl-5 m-0 text-sm text-blue-900 dark:text-blue-200 space-y-1">
                            <li>Nome</li>
                            <li>Endereço</li>
                            <li>Gênero (utilizado apenas para orientar uma abordagem respeitosa)</li>
                        </ul>

                        <p className="text-sm font-bold text-blue-900 dark:text-blue-200 mt-4">Usuários do sistema:</p>
                        <ul className="list-disc pl-5 m-0 text-sm text-blue-900 dark:text-blue-200 space-y-1">
                            <li>Credenciais de acesso</li>
                            <li>Registros técnicos mínimos para controle, auditoria e segurança</li>
                        </ul>
                    </div>

                    <div className="bg-red-50 dark:bg-red-900/20 p-5 rounded-xl border border-red-100 dark:border-red-800">
                        <h4 className="font-bold text-red-800 dark:text-red-300 mb-2 mt-0 flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            B. Dados Pessoais Sensíveis (Opcionais)
                        </h4>
                        <p className="text-sm text-red-900 dark:text-red-200 mb-2">
                            O sistema não exige o cadastro de dados sensíveis. Eventuais marcações (ex.: “Surdo”, “Língua de Sinais”) são:
                        </p>
                        <ul className="list-disc pl-5 m-0 text-sm text-red-900 dark:text-red-200 space-y-1">
                            <li><strong>Opcionais:</strong> inseridas manualmente por decisão do usuário</li>
                            <li><strong>Contextuais:</strong> utilizadas apenas quando estritamente necessárias para acessibilidade</li>
                            <li><strong>Protegidas:</strong> tratadas sob sigilo religioso e pastoral</li>
                        </ul>
                    </div>
                </div>

                <h3>3. Proteção de Crianças e Adolescentes</h3>
                <p>
                    A eventual marcação relacionada a menores de idade não implica coleta ativa de dados pessoais da criança, nem criação de perfis ou práticas de profiling.
                </p>
                <p>
                    Essas marcações funcionam exclusivamente como alertas de conduta responsável para os voluntários (ex.: evitar abordagem direta a menores desacompanhados), observando o melhor interesse da criança e do adolescente, conforme o Art. 14 da LGPD.
                </p>

                <h3>4. Infraestrutura e Open Source</h3>
                <p>É fundamental distinguir o software dos dados tratados:</p>
                <ul className="list-disc pl-5 space-y-2">
                    <li>O código-fonte do Campo Branco é open source, licenciado sob a Licença MIT.</li>
                    <li>A natureza open source não se estende:
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                            <li>ao banco de dados oficial</li>
                            <li>à infraestrutura de produção</li>
                            <li>aos dados pessoais armazenados</li>
                        </ul>
                    </li>
                </ul>
                <p>Esses elementos são privados, fechados e protegidos.</p>
                <p>
                    Qualquer cópia, bifurcação (fork) ou auto-hospedagem do software deve operar com banco de dados totalmente independente, sem qualquer acesso ou integração com a base oficial.
                </p>

                <h3>5. Retenção e Ciclo de Vida dos Dados</h3>
                <ol className="list-decimal pl-5 space-y-4 marker:text-indigo-600 marker:dark:text-indigo-400 marker:font-bold">
                    <li>
                        <strong>Isolamento:</strong> os dados de uma congregação são inacessíveis a outras.
                    </li>
                    <li>
                        <strong>Autonomia:</strong> a definição de prazos de retenção e a exclusão definitiva dos dados são de responsabilidade exclusiva do controlador (congregação local).
                    </li>
                </ol>
                <p>A exclusão é realizada manualmente por usuários autorizados, conforme a necessidade pastoral e organizacional.</p>

                <h3>6. Direitos do Titular</h3>
                <p>
                    A plataforma disponibiliza ferramentas para edição e exclusão de dados.
                </p>
                <p>
                    Contudo, as solicitações formais relacionadas aos direitos do titular (acesso, correção, exclusão, etc.) devem ser direcionadas à congregação local responsável, na condição de controladora dos dados específicos.
                </p>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 p-4 rounded-r-xl mt-8">
                    <h4 className="text-yellow-800 dark:text-yellow-300 font-bold text-sm mb-1 uppercase tracking-wide flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Compromisso de Não Comercialização
                    </h4>
                    <p className="text-yellow-700 dark:text-yellow-200 text-sm m-0 mb-2">
                        Reafirmamos nosso compromisso com a privacidade:
                    </p>
                    <ul className="list-disc pl-5 m-0 text-sm text-yellow-700 dark:text-yellow-200 space-y-1">
                        <li>O Campo Branco não vende, não aluga, não monetiza e não compartilha dados pessoais.</li>
                        <li>A plataforma é 100% livre de publicidade, rastreadores comerciais ou exploração econômica de informações.</li>
                    </ul>
                </div>
            </section>
        </article>
    );
}
