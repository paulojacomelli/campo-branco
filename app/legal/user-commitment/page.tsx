import { UserCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function UserCommitmentPage() {
    return (
        <article className="prose prose-slate dark:prose-invert max-w-none">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 dark:text-orange-400">
                    <UserCheck className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white m-0 leading-tight">Compromisso do Usuário e LGPD</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 m-0">Suas responsabilidades ao gerenciar dados de terceiros.</p>
                </div>
            </div>

            <section className="space-y-6 text-gray-600 dark:text-gray-300">
                <p className="text-lg leading-relaxed">
                    Ao utilizar o Campo Branco para armazenar informações de territórios, você atua como <strong>Controlador de Dados</strong> (ou operador sob orientação de um controlador), conforme definido pela Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
                </p>

                <div className="bg-white dark:bg-slate-800 border-2 border-orange-100 dark:border-orange-900/50 rounded-2xl p-6 md:p-8 my-8 shadow-sm">
                    <h3 className="text-orange-600 dark:text-orange-400 font-bold text-xl mb-4 flex items-center gap-2 mt-0">
                        <AlertTriangle className="w-5 h-5" />
                        Seu Compromisso
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 mb-6">
                        Ao cadastrar endereços, nomes de moradores ou particularidades (como &quot;Surdo&quot; ou &quot;Língua Estrangeira&quot;), você declara e se compromete a:
                    </p>

                    <ul className="space-y-4 list-none pl-0">
                        <li className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                            <span>
                                <strong>Finalidade Específica:</strong> Utilizar os dados exclusivamente para fins de organização religiosa e pastoral, sem desvio para objetivos comerciais, políticos ou pessoais.
                            </span>
                        </li>
                        <li className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                            <span>
                                <strong>Minimização:</strong> Registrar apenas os dados estritamente necessários para a visita, evitando comentários excessivos, subjetivos ou que possam constranger o titular das informações.
                            </span>
                        </li>
                        <li className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                            <span>
                                <strong>Segurança no Acesso:</strong> Manter suas credenciais e links de acesso a territórios restritos apenas a pessoas designadas; não compartilhá-los em grupos públicos ou na internet.
                            </span>
                        </li>
                    </ul>
                </div>

                <h3>Notas Pessoais e Anotações</h3>
                <p>
                    O sistema permite registrar observações sobre as visitas (ex.: &quot;Não estava&quot;, &quot;Pediu para voltar&quot;). É responsabilidade do usuário garantir que essas anotações sejam respeitosas e factuais.
                </p>

                <h3>Exclusão de Dados</h3>
                <p>
                    Caso um morador solicite a não utilização ou exclusão de seus dados, o usuário administrador deve remover imediatamente essas informações do sistema.
                </p>

                <hr className="my-8 border-gray-200 dark:border-slate-700" />

                <p className="text-xs text-gray-400 dark:text-gray-400 italic">
                    Isenção de Responsabilidade: O Campo Branco fornece a plataforma tecnológica, mas não gerencia nem controla diretamente os dados inseridos pelas congregações locais. A conformidade com a LGPD durante as atividades de campo é de responsabilidade exclusiva dos usuários e de suas respectivas congregações.
                </p>
            </section>
        </article>
    );
}
