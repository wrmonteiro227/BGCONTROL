// =====================================
// CONFIGURAÇÃO SUPABASE (Corrigido Conflito)
// =====================================
const supabaseUrl = 'https://zqvfnykxwlcozvawqgrn.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxdmZueWt4d2xjb3p2YXdxZ3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NDkzNDQsImV4cCI6MjA4NTMyNTM0NH0.CevpF9vP4748mb2vFNsOp5Kq6u7Nfp_100bJcW7ogUQ';
// Mudamos para 'nuvemDB' para evitar o SyntaxError 'already declared'
const nuvemDB = window.supabase.createClient(supabaseUrl, supabaseKey);

// =====================================
// LÓGICA DO PORTAL WR (1 VEZ AO DIA)
// =====================================
function verificarSplash() {
    const hoje = new Date().toLocaleDateString();
    const ultimoAcesso = localStorage.getItem('wr_ultimo_acesso');
    const portal = document.getElementById('wr-portal');
    
    // Se ele já acessou hoje, esconde o portal na hora que carrega a página
    if(portal && ultimoAcesso === hoje) {
        portal.style.display = 'none';
        document.getElementById('main-system-ui').style.display = 'block';
        document.getElementById('main-system-ui').style.opacity = '1';
        document.querySelector('.menu-trigger').style.display = 'block';
    }
}
verificarSplash();

function acessarSistema() {
    const hoje = new Date().toLocaleDateString();
    localStorage.setItem('wr_ultimo_acesso', hoje);
    
    const portal = document.getElementById('wr-portal');
    const container = document.getElementById('main-system-ui');
    const menuBtn = document.querySelector('.menu-trigger');
    const sound = document.getElementById('clickSound');
    
    if(sound) { sound.currentTime = 0; sound.play().catch(()=>{}); }
    
    portal.style.opacity = "0";
    setTimeout(() => { 
        portal.style.display = "none"; 
        container.style.display = "block";
        menuBtn.style.display = "block";
        setTimeout(() => {
            container.style.opacity = "1";
        }, 50);
    }, 500);
}

// =====================================
// MEMÓRIA DO SISTEMA
// =====================================
let estoque = [];
let servicosPendentes = [];
let servicosPagos = [];
let historicoCompras = [];
let totalEntradas = 0;
let totalCustosPecas = 0;
let calcValue = "0";

// =====================================
// COMUNICAÇÃO COM A NUVEM
// =====================================
async function carregarDadosNuvem() {
    try {
        const { data, error } = await nuvemDB.from('bg_cloud_state').select('*').eq('id', 1).single();
        if (data) {
            estoque = data.estoque || [];
            servicosPendentes = data.servicos_pendentes || [];
            servicosPagos = data.servicos_pagos || [];
            historicoCompras = data.historico_compras || [];
            totalEntradas = Number(data.total_entradas) || 0;
            totalCustosPecas = Number(data.total_custos) || 0;
        }
    } catch(err) { console.error("Erro ao carregar da nuvem:", err); }
}

async function salvarDadosNuvem() {
    try {
        await nuvemDB.from('bg_cloud_state').upsert({
            id: 1,
            estoque: estoque,
            servicos_pendentes: servicosPendentes,
            servicos_pagos: servicosPagos,
            historico_compras: historicoCompras,
            total_entradas: totalEntradas,
            total_custos: totalCustosPecas
        });
    } catch(err) { console.error("Erro ao salvar na nuvem:", err); }
}

// =====================================
// INICIALIZAÇÃO
// =====================================
window.onload = async () => {
    // 1. Baixa os dados do banco antes de renderizar
    await carregarDadosNuvem();

    const selectQtd = document.getElementById('estoque-qtd');
    if(selectQtd) {
        let options = "";
        for(let i=1; i<=100; i++) { options += `<option value="${i}">Qtd: ${i}</option>`; }
        selectQtd.innerHTML = options;
    }
    
    // 2. Renderiza na tela
    atualizarFluxoUI();
    atualizarHistoricoUI();
    atualizarComprasUI();
    atualizarEstoqueUI();
    atualizarPainelFinanceiro();
};

// NAVEGAÇÃO DE ABAS
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    const targetTab = document.getElementById('tab-' + tabId);
    if(targetTab) targetTab.classList.add('active');

    document.querySelectorAll('.sidebar-links a').forEach(link => link.classList.remove('active'));
    const lk = {
        'dashboard':'link-dashboard', 'compras':'link-compras', 'estoque':'link-estoque',
        'calculadora':'link-calculadora', 'historico':'link-historico', 'os':'link-os', 'download':'link-download'
    };
    if(lk[tabId]) {
        const linkElem = document.getElementById(lk[tabId]);
        if(linkElem) linkElem.classList.add('active');
    }
    if(window.innerWidth < 1000) toggleMenu();
}

function toggleMenu() { 
    const side = document.getElementById('sideMenu');
    if(side) side.classList.toggle('active'); 
}

// INJEÇÃO: LÓGICA DA CALCULADORA (SEM LIMITE DE VISOR)
function pressCalc(key) {
    const sound = document.getElementById('clickSound');
    if(sound) { sound.currentTime = 0; sound.play().catch(()=>{}); }

    const display = document.getElementById('calc-display');
    
    if(key === 'C') {
        calcValue = "0";
    } else if(key === 'DEL') {
        calcValue = calcValue.length > 1 ? calcValue.slice(0, -1) : "0";
    } else if(key === '=') {
        try {
            let res = eval(calcValue.replace('x', '*'));
            calcValue = Number(res.toFixed(8)).toString();
        } catch {
            calcValue = "ERRO";
        }
    } else {
        if (calcValue.length >= 12 && key !== 'C' && key !== 'DEL') return;

        if(calcValue === "0" || calcValue === "ERRO") {
            calcValue = key;
        } else {
            calcValue += key;
        }
    }

    if (calcValue.length > 8) {
        display.style.fontSize = "1.5rem";
    } else {
        display.style.fontSize = "2.5rem";
    }

    display.innerText = calcValue;
}

// GESTÃO DE SERVIÇOS
function lancarServico() {
    const cli = document.getElementById('cliente').value;
    const apa = document.getElementById('aparelho').value;
    const val = document.getElementById('valor').value;
    const pec = document.getElementById('peca-usada').value;

    if (!cli || !apa || !val) { alert("Preencha os campos!"); return; }

    const valorCobrado = parseFloat(val.replace('.', '').replace(',', '.'));
    let custoPeca = 0;
    let nomePeca = "Mão de Obra";

    if (pec) {
        const p = estoque.find(x => x.id == pec);
        if (p) { custoPeca = p.custo; nomePeca = p.nome; }
    }

    const novo = { 
        id: Date.now(), 
        cliente: cli, 
        aparelho: apa, 
        imei: document.getElementById('imei').value, 
        defeito: document.getElementById('defeito').value || "Sem relato de defeito.", 
        valor: valorCobrado, 
        custo: custoPeca, 
        peca: nomePeca, 
        lucro: valorCobrado - custoPeca 
    };
    
    servicosPendentes.unshift(novo);
    atualizarFluxoUI();
    atualizarHistoricoUI();
    document.getElementById('formOS').reset();
    
    salvarDadosNuvem(); // Sincroniza com Supabase
}

function atualizarFluxoUI() {
    const container = document.getElementById('extrato-lista');
    if(!container) return;
    container.innerHTML = servicosPendentes.map(s => `
        <div class="log-item">
            <div class="log-info">
                <button class="btn-obs" onclick="abrirObs(${s.id})">EXIBIR</button>
                <strong>${s.aparelho}</strong>
            </div>
            <div class="log-values">
                <span class="blue-text">R$ ${s.valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
                <small class="orange-text">- R$ ${s.custo.toLocaleString('pt-BR', {minimumFractionDigits:2})} (${s.peca})</small>
                <span class="green-text" style="font-weight:800;">LUCRO: R$ ${s.lucro.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
            </div>
        </div>
    `).join('');
}

function abrirObs(id) {
    const s = servicosPendentes.find(x => x.id === id) || servicosPagos.find(x => x.id === id);
    if(s) {
        document.getElementById('obsContent').innerText = s.defeito;
        document.getElementById('modalObs').style.display = 'flex';
    }
}

function closeObs() { document.getElementById('modalObs').style.display = 'none'; }

function confirmarPagamento(id) {
    const idx = servicosPendentes.findIndex(s => s.id === id);
    if(idx !== -1) {
        const srv = servicosPendentes[idx];
        totalEntradas += srv.valor;
        totalCustosPecas += srv.custo;
        servicosPagos.unshift(srv);
        servicosPendentes.splice(idx, 1);
        atualizarPainelFinanceiro();
        atualizarFluxoUI();
        atualizarHistoricoUI();
        
        salvarDadosNuvem(); // Sincroniza com Supabase
    }
}

function atualizarHistoricoUI() {
    const pend = document.getElementById('lista-historico-pendentes');
    const pago = document.getElementById('lista-historico-pagos');
    if(pend) pend.innerHTML = servicosPendentes.map(s => `
        <div class="log-item">
            <strong>${s.aparelho}</strong>
            <button class="btn-print" style="background:var(--green-profit)" onclick="confirmarPagamento(${s.id})">PAGO</button>
        </div>
    `).join('');
    if(pago) pago.innerHTML = servicosPagos.map(s => `
        <div class="log-item" style="opacity:0.6;">
            <strong>${s.aparelho}</strong>
            <span class="green-text">√ PAGO</span>
        </div>
    `).join('');
}

function atualizarPainelFinanceiro() {
    document.getElementById('totalE').innerText = `R$ ${totalEntradas.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('totalS').innerText = `R$ ${totalCustosPecas.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('totalL').innerText = `R$ ${(totalEntradas-totalCustosPecas).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
}

// GESTÃO DE COMPRAS E CONTRATOS
function registrarCompra() {
    const nome = document.getElementById('v-nome').value;
    const apa = document.getElementById('c-aparelho').value;
    const imei = document.getElementById('c-imei').value;
    const valor = document.getElementById('c-valor').value;
    const cpf = document.getElementById('v-cpf').value;
    if(!nome || !apa || !imei) return;
    historicoCompras.unshift({ id: Date.now(), nome, cpf, aparelho: apa, imei, valor, data: new Date().toLocaleString('pt-BR') });
    atualizarComprasUI();
    document.getElementById('formCompra').reset();
    
    salvarDadosNuvem(); // Sincroniza com Supabase
}

function atualizarComprasUI() {
    const container = document.getElementById('lista-compras-historico');
    if(!container) return;
    container.innerHTML = historicoCompras.map(c => `
        <div class="contract-log-item">
            <div class="contract-info"><small>Aparelho</small><strong>${c.aparelho}</strong></div>
            <div class="contract-info"><small>Vendedor</small><strong>${c.nome}</strong></div>
            <button class="btn-print" onclick="imprimirContrato(${c.id})">IMPRIMIR</button>
        </div>
    `).join('');
}

function imprimirContrato(id) {
    const c = historicoCompras.find(x => x.id === id);
    if(!c) return;
    const printable = document.getElementById('printableContract');
    const dataAtual = new Date();
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    
    printable.innerHTML = `
        <div style="color:black; padding:30px; background:white; font-family: 'Times New Roman', serif; line-height: 1.4; font-size: 12pt;">
            <center><h2>CONTRATO DE COMPRA E DECLARAÇÃO DE PROCEDÊNCIA</h2></center>
            <p><strong>CONTRATANTE:</strong> Biel Gimm, CPF [056.260.555-09], Cachoeira,BA.</p>
            <p><strong>CONTRATADO:</strong> ${c.nome.toUpperCase()}, CPF: ${c.cpf}</p>
            <p>Aparelho: ${c.aparelho.toUpperCase()} - IMEI: ${c.imei}</p>
            <p>O CONTRATADO declara origem lícita sob penas do Art. 299 do Código Penal.</p>
            <p>Cachoeira, BA, ${dataAtual.getDate()} de ${meses[dataAtual.getMonth()]} de 2026.</p>
            <div style="display:flex; justify-content: space-between; margin-top:40px; border-top:1px solid #000; padding-top:10px;">
                <span>Biel Gimm</span>
                <span>Assinatura do Vendedor</span>
            </div>
        </div>`;
    setTimeout(() => { window.print(); }, 700);
}

// GESTÃO DE ESTOQUE
function adicionarAoEstoque() {
    const n = document.getElementById('estoque-nome').value;
    const cStr = document.getElementById('estoque-custo').value;
    const q = document.getElementById('estoque-qtd').value;
    if(n && cStr) {
        estoque.push({id: Date.now(), nome: n, custo: parseFloat(cStr.replace(',','.')), qtd: q});
        atualizarEstoqueUI();
        document.getElementById('estoque-nome').value = '';
        document.getElementById('estoque-custo').value = '';
        
        salvarDadosNuvem(); // Sincroniza com Supabase
    }
}

function removerDoEstoque(id) { 
    estoque = estoque.filter(p => p.id !== id); 
    atualizarEstoqueUI(); 
    salvarDadosNuvem(); // Sincroniza com Supabase
}

function atualizarEstoqueUI() {
    const selectOS = document.getElementById('peca-usada');
    if(selectOS) {
        selectOS.innerHTML = '<option value="">Selecione a Peça (Opcional)</option>' + 
            estoque.map(p => `<option value="${p.id}">${p.nome} - R$ ${p.custo}</option>`).join('');
    }
    const container = document.getElementById('lista-estoque-display');
    if(container) {
        container.innerHTML = estoque.map(p => `
            <div class="log-item">
                <div class="log-info"><strong>${p.nome} (x${p.qtd})</strong><br><small class="orange-text">Custo: R$ ${p.custo}</small></div>
                <button class="btn-print" style="background:var(--red-fire); color:white;" onclick="removerDoEstoque(${p.id})">REMOVER</button>
            </div>
        `).join('');
    }
}

// FUNÇÃO DE IMPRESSÃO DA OS E APP
function imprimirOS() {
    const doc = document.getElementById('os-documento-interativo');
    const printable = document.getElementById('printableContract');
    
    printable.innerHTML = doc.outerHTML;
    
    const originais = doc.querySelectorAll('input, textarea');
    const clones = printable.querySelectorAll('input, textarea');
    
    originais.forEach((el, i) => {
        if(el.type === 'checkbox') {
            clones[i].checked = el.checked;
        } else {
            clones[i].value = el.value;
        }
    });

    setTimeout(() => { window.print(); }, 700);
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

document.getElementById('installBtn')?.addEventListener('click', () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
    }
});