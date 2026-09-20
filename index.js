/*
 * Isekai Roulette Tools — loader imutável.
 *
 * Este arquivo NUNCA muda: ele só carrega o código real (main.js) com um
 * cache-buster na URL. Isso garante que updates da extensão peguem sempre,
 * sem depender de o navegador liberar o cache HTTP (que o Ctrl+F5 não
 * esvazia para imports dinâmicos).
 */

jQuery(async () => {
    await import(`./main.js?v=${Date.now()}`);
});
