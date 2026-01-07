import { Info, Heart, Code2, Home, Map, Store, BarChart3, Settings } from 'lucide-react';

export default function AboutPage() {
    return (
        <article className="prose prose-slate dark:prose-invert max-w-none">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
                    <Info className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white m-0 leading-tight">O que é o Campo Branco</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 m-0">A missão e o propósito por trás da ferramenta.</p>
                </div>
            </div>

            <section className="space-y-6 text-gray-600 dark:text-gray-300">
                <p className="text-lg leading-relaxed">
                    O <strong>Campo Branco</strong> é uma solução digital Open Source desenvolvida para auxiliar congregações na organização, gestão e distribuição de territórios para atividades religiosas e pastorais.
                </p>

                <div className="grid md:grid-cols-2 gap-6 my-8 not-prose">
                    <div className="bg-gray-50 dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700">
                        <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-lg shadow-sm flex items-center justify-center text-red-500 dark:text-red-400 mb-4">
                            <Heart className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-2">Propósito</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Simplificar o trabalho administrativo para que os voluntários possam focar no que realmente importa: a atividade pastoral e o cuidado com as pessoas.
                        </p>
                    </div>

                    <div className="bg-gray-50 dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700">
                        <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-lg shadow-sm flex items-center justify-center text-slate-700 dark:text-slate-300 mb-4">
                            <Code2 className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-2">Transparência</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Todo o código é aberto e auditável. Não há caixas pretas. O projeto é construído com foco em privacidade, segurança e simplicidade.
                        </p>
                    </div>
                </div>

                <h3>Filosofia do Projeto</h3>
                <p>
                    O nome "Campo Branco" é uma referência às palavras de Jesus em João 4:35: <em>"Ergam os olhos e observem os campos, que estão brancos para a colheita."</em>
                </p>
                <p>
                    Acreditamos que a tecnologia deve servir como uma facilitadora discreta e eficiente, respeitando sempre a natureza voluntária e sagrada do trabalho que ela apoia.
                </p>

                <hr className="my-8 border-gray-200 dark:border-slate-700" />

                <h3>Aviso Importante</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Este aplicativo é uma iniciativa independente e colaborativa. Ele <strong>não</strong> é uma ferramenta oficial da organização religiosa das Testemunhas de Jeová, embora seja projetado especificamente para ser útil e compatível com suas atividades locais.
                </p>

                <h3>O que você pode fazer</h3>

                <div className="not-prose grid gap-6 md:grid-cols-2">
                    {/* Início */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <Home className="w-5 h-5" />
                            </div>
                            <h4 className="font-bold text-gray-900 dark:text-white m-0 text-lg">Início</h4>
                        </div>
                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Visão Geral</p>
                        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                            <li className="flex items-start gap-2">
                                <span className="w-1 h-1 rounded-full bg-blue-400 mt-2"></span>
                                Resumo de designações pessoais.
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-1 h-1 rounded-full bg-blue-400 mt-2"></span>
                                Acesso rápido a cartões compartilhados.
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-1 h-1 rounded-full bg-blue-400 mt-2"></span>
                                Quadro de avisos da congregação.
                            </li>
                        </ul>
                    </div>

                    {/* Mapas */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <Map className="w-5 h-5" />
                            </div>
                            <h4 className="font-bold text-gray-900 dark:text-white m-0 text-lg">Mapas</h4>
                        </div>
                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Territórios e Endereços</p>
                        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                            <li className="flex items-start gap-2">
                                <span className="w-1 h-1 rounded-full bg-emerald-400 mt-2"></span>
                                Visualização de Pinpoints no mapa.
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-1 h-1 rounded-full bg-emerald-400 mt-2"></span>
                                Navegação GPS (Google Maps/Waze).
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-1 h-1 rounded-full bg-emerald-400 mt-2"></span>
                                Geração de Links (Cartões Digitais).
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-1 h-1 rounded-full bg-emerald-400 mt-2"></span>
                                Histórico e Status de visitas.
                            </li>
                        </ul>
                    </div>

                    {/* T. Público */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 dark:text-orange-400">
                                <Store className="w-5 h-5" />
                            </div>
                            <h4 className="font-bold text-gray-900 dark:text-white m-0 text-lg">T. Público</h4>
                        </div>
                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Testemunho Público</p>
                        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                            <li className="flex items-start gap-2">
                                <span className="w-1 h-1 rounded-full bg-orange-400 mt-2"></span>
                                Gestão de Pontos Fixos (Carrinhos/Mesas).
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-1 h-1 rounded-full bg-orange-400 mt-2"></span>
                                Visualização de locais aprovados.
                            </li>
                        </ul>
                    </div>

                    {/* Relatórios */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                <BarChart3 className="w-5 h-5" />
                            </div>
                            <h4 className="font-bold text-gray-900 dark:text-white m-0 text-lg">Relatórios</h4>
                        </div>
                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Totais e Cobertura</p>
                        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                            <li className="flex items-start gap-2">
                                <span className="w-1 h-1 rounded-full bg-purple-400 mt-2"></span>
                                Gráficos de progresso e cobertura.
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-1 h-1 rounded-full bg-purple-400 mt-2"></span>
                                Estatísticas de endereços e surdos.
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-1 h-1 rounded-full bg-purple-400 mt-2"></span>
                                Controle exclusivo para servos/anciãos.
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Configurações (Full Width) */}
                <div className="not-prose bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col md:flex-row items-center gap-6">
                    <div className="w-12 h-12 shrink-0 rounded-2xl bg-gray-50 dark:bg-slate-700 flex items-center justify-center text-gray-600 dark:text-gray-300">
                        <Settings className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-gray-900 dark:text-white m-0 text-lg">Configurações</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                            Personalize sua experiência no aplicativo, ajustando temas (Claro/Escuro), tamanho de fonte e editando suas informações de perfil.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <span className="px-3 py-1 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-300 rounded-lg text-xs font-bold border border-gray-200 dark:border-slate-600">
                            App Nativo (PWA)
                        </span>
                        <span className="px-3 py-1 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-300 rounded-lg text-xs font-bold border border-gray-200 dark:border-slate-600">
                            Privacidade LGPD
                        </span>
                    </div>
                </div>
            </section>
        </article>
    );
}
