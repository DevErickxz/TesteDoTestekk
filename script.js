// script.js

// CONFIG INICIAL
console.log("iniciado")
// Lista global de todas as válvulas, usada na view de votação
const allValves = Array.from({ length: 48 }, (_, i) => `PL ${i + 1}`);

let currentSide = 'A';
let currentArea = 'Caixa'; // Área atual

// Votos e confirmações aninhados por área e lado
const votos = {
  'Raizer': { A: {}, B: {}, C: {}, D: {} },
  'Caixa':  { A: {}, B: {}, C: {}, D: {} }
};
const confirmadas = {
  'Raizer': { A: {}, B: {}, C: {}, D: {} },
  'Caixa':  { A: {}, B: {}, C: {}, D: {} }
};

// Mapeamento de quantidades por área e lado
const countsByArea = {
  'Raizer': { A: 13, B: 3,  C: 12, D: 4  },
  'Caixa':  { A: 4,  B: 8,  C: 3,  D: 3  }
};


// Quais índices devem ficar quadrados (0‑based) por área→lado
const squareIndices = {
  'Raizer': {
    C: [10],
            // Apenas a Válvula 11 (índice 10) de Raizer C
  },
  'Caixa': {
    // AGORA, 'A' e 'B' estão juntos dentro da mesma chave 'Caixa'
    B: [7, 4], // Válvula 5 (índice 4) e Válvula 10 (índice 9) de Caixa B
    A: [1]    // Válvula 3 (índice 2) de Caixa A
  }
};


// Referências DOM
let sideBtns, areaBtns, sideTitle, container, perguntaContainer;
let inputRaizer, inputCaixa, inputUsuario, inputArea;
let modalPerfil, btnSalvarPerfil, modalReset, btnSimReset, btnNaoReset;
let modalConfirmar, btnSimConfirmar, btnNaoConfirmar;
let modalResumo, resumoTextModal, btnFecharResumo, btnDownload;
let userDisplay;
/**
 * Retorna os nomes de válvulas contínuos para a área e lado informados,
 * baseando-se em countsByArea e no mapeamento global de 1 a 48.
 */




function getValvesList(area, side) {
  const counts = countsByArea[area];
  if (!counts || !counts[side]) return [];
  const offsets = {
    A: 0,
    B: counts.A,
    C: counts.A + counts.B,
    D: counts.A + counts.B + counts.C
  };
  const start = offsets[side];
  const total = counts[side];
  return Array.from({ length: total }, (_, i) => `Válvula ${start + i + 1}`);
}

function atualizarSelectValvulasComBaseNaAreaELado() {
  const area = document.getElementById('search-area').value;
  const lado = document.getElementById('search-side').value;
  const select = document.getElementById('search-valve');
  select.innerHTML = '<option value="">Todas</option>';

  if (area !== 'all' && lado !== 'all') {
    const valves = getValvesList(area, lado);
    valves.forEach(nome => {
      const opt = document.createElement('option');
      opt.value = nome;
      opt.textContent = nome;
      select.appendChild(opt);
    });
  }
}



// Mostra apenas a view selecionada
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// Inicia o app após login
// Inicia o app após login
function startApp() {
  showView('valve-view');

  // ESSA PARTE É CRÍTICA E JÁ ESTÁ CORRETA DA ÚLTIMA VEZ:
  // Obtém a referência do elemento user-display AQUI,
  // logo no início da função, antes de usá-lo.
  const userDisplayElement = document.getElementById('user-display');

  if (userDisplayElement) { // Verifica se o elemento foi encontrado
    const user = firebase.auth().currentUser;

    if (user) {
      const uid = user.uid;
      db.collection('users').doc(uid).get()
        .then(doc => {
          const userName = doc.data()?.nome || user.displayName || user.email || 'Usuário Desconhecido';
          userDisplayElement.textContent = `Bem-vindo, ${userName}!`;
        })
        .catch(error => {
          console.error("Erro ao carregar dados do usuário:", error);
          userDisplayElement.textContent = `Bem-vindo, ${user.displayName || user.email || 'Usuário Desconhecido'}!`;
        });
    } else {
      userDisplayElement.textContent = 'Nenhum usuário logado.';
    }
  } else {
    console.error("Erro: Elemento 'user-display' com ID não encontrado no DOM. Verifique seu index.html.");
  }

  // Restaura posição salva
  const savedArea = localStorage.getItem('savedArea');
  const savedSide = localStorage.getItem('savedSide');
  if (savedArea && countsByArea[savedArea]) currentArea = savedArea;
  if (savedSide && countsByArea[currentArea][savedSide]) currentSide = savedSide;

  // inputArea.value = currentArea; // Se ainda usar este campo
  initValves();
}


// Login via Google
async function handleGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await firebase.auth().signInWithPopup(provider);
    const user = result.user;
    const ref = db.collection('users').doc(user.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      modalPerfil.classList.add('show');
      btnSalvarPerfil.onclick = async () => {
        const nome = document.getElementById('perfil-nome').value.trim();
        if (!nome) { alert('Informe seu nome completo.'); return; }
        await ref.set({ email: user.email, nome });
        modalPerfil.classList.remove('show');
        startApp();
      };
    } else {
      startApp();
    }
  } catch (err) {
    alert('Falha no login com Google: ' + err.message);
  }
}

// Inicializa as válvulas para área/lado atuais
function initValves() {
  sideTitle.textContent = `Lado ${currentSide} (${currentArea})`;
  inputArea.value = currentArea;

  if (!votos[currentArea][currentSide]) votos[currentArea][currentSide] = {};
  if (!confirmadas[currentArea][currentSide]) confirmadas[currentArea][currentSide] = {};

  // Preenche votos padrão = 1
  const count = countsByArea[currentArea][currentSide];
  for (let i = 0; i < count; i++) {
    if (!votos[currentArea][currentSide][i]) votos[currentArea][currentSide][i] = 0;
    confirmadas[currentArea][currentSide][i] = true;
  }

  ajustarAlturaContainer()
  renderValves();
  bindListeners();
  updateActiveAreaButtonValveView();
  updateActiveSideButtonValveView();
}

// Renderiza as válvulas dinamicamente
function renderValves() {
  container.innerHTML = '';

  // Calcular slice de allValves baseado em countsByArea
  const counts  = countsByArea[currentArea];
  const offsets = {
    A: 0,
    B: counts.A,
    C: counts.A + counts.B,
    D: counts.A + counts.B + counts.C
  };
  const start = offsets[currentSide];
  const num   = counts[currentSide];
  const valvs = allValves.slice(start, start + num);

  valvs.forEach((nome, i) => {
    const nota     = votos[currentArea][currentSide][i] || 0;
    const sqIdxs   = squareIndices[currentArea]?.[currentSide] || [];
    const isSquare = sqIdxs.includes(i);

    // Busca a posição pelo nome da válvula (ex: "valvula-1")
    const pos =
      valvulaPositions[currentArea]?.[currentSide]?.[`valvula-${i + 1}`]
      || { top: 0, left: 0 };

    const wrapper = document.createElement('div');
    wrapper.className = 'valvula-wrapper';
    wrapper.style.position = 'absolute';
    wrapper.style.top = pos.top + 'px';
    wrapper.style.left = pos.left + 'px';
    wrapper.innerHTML = `
      <div class="valvula nota-${nota}${isSquare ? ' square' : ''}">
        <div class="valvula-label">${nome}</div>
        <div class="nota-label">Grau: ${nota}</div>
      </div>`;
    wrapper.onclick = () => handleVoto(i, nome);
    container.appendChild(wrapper);
  });
}

// Lógica de voto com confirmação de edição
function handleVoto(index, nome) {
  const atual = votos[currentArea][currentSide][index];
  if (atual !== undefined && atual !== 1) {
    if (!confirm(`Deseja editar a nota de ${nome}?`)) return;
  }
  mostrarPergunta(index, nome);
}

// Exibe modal de escolha de nota
function mostrarPergunta(index, nome) {
  perguntaContainer.innerHTML = '';
  perguntaContainer.classList.add('show');
  const box = document.createElement('div');
  box.className = 'pergunta-container';
box.innerHTML = `
  <div class="pergunta">Qual grau (0 a 5) para ${nome}?</div>
  <div class="respostas">
    ${[0,1,2,3,4,5].map(n => `<button>${n}</button>`).join('')}
  </div>`;
// Listener para cada botão
box.querySelectorAll('.respostas button').forEach((btn, idx) => {
  btn.onclick = () => {
    votos[currentArea][currentSide][index] = idx; // idx agora é o valor de 0 a 5
    perguntaContainer.classList.remove('show');
    setTimeout(() => { perguntaContainer.innerHTML = ''; renderValves(); }, 300);
  };
});
  perguntaContainer.appendChild(box);
}



// Bind de botões de reset, confirmar, download, etc.
function bindListeners() {
  
  btnSimReset.onclick = () => {
    votos[currentArea][currentSide] = {};
    confirmadas[currentArea][currentSide] = {};
    modalReset.classList.remove('show');
    initValves();
  };
 

  document.getElementById('btn-confirmar').onclick = () => modalConfirmar.classList.add('show');
  btnSimConfirmar.onclick = async () => {
    modalConfirmar.classList.remove('show');
    await mostrarResumo();
  };
  btnNaoConfirmar.onclick = () => modalConfirmar.classList.remove('show');

  btnFecharResumo.onclick = () => modalResumo.classList.remove('show');
  btnDownload.onclick = () => {
    const blob = new Blob([resumoTextModal.textContent], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `resumo_valvulas_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
}

// Gera e salva o resumo no Firestore
async function mostrarResumo() {
  const user = firebase.auth().currentUser;
  const pressaoRaizer = inputRaizer.value;
  const pressaoCaixa = inputCaixa.value;
  const timestamp = new Date().toISOString();
  const userDoc = await db.collection('users').doc(user.uid).get();
  const userName = userDoc.data()?.nome || 'Desconhecido';

  // Calcula intensidade e média como antes
  let somaNotas = 0;
  let qtdVotadas = 0;
  ['Raizer', 'Caixa'].forEach(area => {
    Object.keys(countsByArea[area]).forEach(lado => {
      const count = countsByArea[area][lado];
      const start = (() => {
        const counts = countsByArea[area];
        const offs = { A:0, B:counts.A, C:counts.A+counts.B, D:counts.A+counts.B+counts.C };
        return offs[lado];
      })();
      for (let i = 0; i < count; i++) {
        const nota = votos[area][lado][i] ?? 0;
        if (nota > 0) {
          somaNotas += nota;
          qtdVotadas++;
        }
      }
    });
  });

  const media = qtdVotadas > 0 ? (somaNotas / qtdVotadas) : 0;
  let intensidade = 'Suave';
  if (media >= 2.6 && media <= 4.5) intensidade = 'Média';
  else if (media > 4.5) intensidade = 'Intensa';

  // Novo resumo só com dados principais
  const resumoHTML = `
    <div class="dashboard-resumo">
      <div class="registro-topo">

        <h2>Registro concluído!</h2>
      </div>
      <p><strong>Usuário:</strong> ${userName}</p>
      <p><strong>Data/Hora:</strong> ${new Date(timestamp).toLocaleString()}</p>
      <hr>
      <p><strong>Intensidade:</strong> ${intensidade}</p>
      <p><strong>Nota da intensidade:</strong> ${media.toFixed(2)}</p>
    </div>
  `;

  // Salva no DB (mantendo todas as válvulas, mas só mostra resumo simples)
  let registroData = {
    userId: user.uid,
    userName,
    data: timestamp,
    pressaoRaizer: pressaoRaizer || null,
    pressaoCaixa: pressaoCaixa || null,
    intensidade,
    notaIntensidade: media,
    valvulas: {} // pode manter ou remover, conforme sua lógica
  };

  try {
    await db.collection('registros').add(registroData);
    alert('Registro salvo com sucesso!');
    resumoTextModal.innerHTML = resumoHTML;
    modalResumo.classList.add('show');
  } catch (error) {
    console.error('Erro ao salvar registro:', error);
    alert('Erro ao salvar registro: ' + error.message);
  }
}

// Atualiza highlight dos botões de área e lado
function updateActiveAreaButtonValveView() {
  areaBtns.forEach(btn =>
    btn.classList.toggle('active', btn.dataset.area === currentArea)
  );
}
function updateActiveSideButtonValveView() {
  sideBtns.forEach(btn =>
    btn.classList.toggle('active', btn.dataset.side === currentSide)
  );
}

// Evento inicial
document.addEventListener('DOMContentLoaded', () => {
  // Referências
   const sideTitleElement = document.getElementById('side-title');
  sideBtns          = document.querySelectorAll('#valve-view .side-btn');
  areaBtns          = document.querySelectorAll('#valve-view .area-button');
  sideTitle         = document.getElementById('side-title');
  container         = document.getElementById('valvulas-container');
  perguntaContainer = document.getElementById('pergunta-global-container');
  inputRaizer       = document.getElementById('inputRaizer');
  inputCaixa        = document.getElementById('inputCaixa');
  inputUsuario      = document.getElementById('input-usuario');
  inputArea         = document.getElementById('input-area');
  modalPerfil       = document.getElementById('modal-perfil');
  btnSalvarPerfil   = document.getElementById('btn-salvar-perfil');
  modalReset        = document.getElementById('modal-reset');
  btnSimReset       = document.getElementById('btn-sim-resetar');
  btnNaoReset       = document.getElementById('btn-nao-resetar');
  modalConfirmar    = document.getElementById('modal-confirmacao-geral');
  btnSimConfirmar   = document.getElementById('btn-sim-confirmar');
  btnNaoConfirmar   = document.getElementById('btn-nao-confirmar');
  modalResumo       = document.getElementById('modal-confirmacao');
  resumoTextModal   = document.getElementById('resumo-text-modal');
  btnFecharResumo   = document.getElementById('btn-fechar-modal');
  btnDownload       = document.getElementById('btn-download-modal');

  document.getElementById('search-area').addEventListener('change', atualizarSelectValvulasComBaseNaAreaELado);
  document.getElementById('search-side').addEventListener('change', atualizarSelectValvulasComBaseNaAreaELado);
  atualizarSelectValvulasComBaseNaAreaELado(); // já popula na carga



  // Login/Cadastro
  document.getElementById('login-form').onsubmit = async e => {
    e.preventDefault();
    try {
      await loginUser(
        document.getElementById('login-username').value,
        document.getElementById('login-password').value
      );
      startApp();
    } catch (err) {
      alert('Erro no login: ' + err.message);
    }
  };
  document.getElementById('to-register').onclick = () => showView('register-view');
  document.getElementById('register-form').onsubmit = async e => {
    e.preventDefault();
    try {
      await registerUser(
        document.getElementById('reg-username').value,
        document.getElementById('reg-password').value
      );
      showView('login-view');
    } catch (err) {
      alert('Erro no cadastro: ' + err.message);
    }
  };
  document.getElementById('to-login').onclick = () => showView('login-view');
  document.getElementById('btn-google').onclick = handleGoogle;
  document.getElementById('btn-google-register').onclick = handleGoogle;

  // Botões área/ lado (view válvulas)
  areaBtns.forEach(btn => btn.onclick = () => {
    currentArea = btn.dataset.area;
    localStorage.setItem('savedArea', currentArea);
    initValves();
  });
  sideBtns.forEach(btn => btn.onclick = () => {
    currentSide = btn.dataset.side;
    localStorage.setItem('savedSide', currentSide);
    initValves();
  });

    // Event listener para o novo botão "Ver Status das Válvulas"
  const btnShowValvesStatus = document.getElementById('btn-show-valves-status');
  if (btnShowValvesStatus) {
    btnShowValvesStatus.addEventListener('click', () => {
      showView('current-valve-status-view');
      // Chame initStatisticsView ou renderStatisticsValves aqui
      // para garantir que as válvulas sejam carregadas na nova view
      // caso o usuário navegue para lá.
      initStatisticsView(); // ou renderStatisticsValves(); dependendo de como você quer o estado inicial.
    });
  }

  // Event listener para o botão "Voltar" na nova view
  const backToStatisticsFromValvesBtn = document.getElementById('back-to-statistics-from-valves');
  if (backToStatisticsFromValvesBtn) {
    backToStatisticsFromValvesBtn.addEventListener('click', () => {
      showView('statistics-view');
    });
  }

    // Adiciona listener para o botão "Pressões"
  const btnShowPressureInput = document.getElementById('btn-show-pressure-input');
  if (btnShowPressureInput) {
    btnShowPressureInput.addEventListener('click', () => {
      showView('pressure-input-view'); // Mostra a nova view de entrada de pressão
    });
  }

  // Event listener para o botão "Voltar" na pressure-input-view (já deve existir se você usou o HTML acima)
  const backFromPressureInputBtn = document.querySelector('#pressure-input-view .back-button');
  if (backFromPressureInputBtn) {
    backFromPressureInputBtn.addEventListener('click', () => {
      showView('valve-view'); // Volta para a valve-view
    });
  }

    if (sideTitleElement) { // Verifica se o elemento foi encontrado no DOM
    sideTitleElement.addEventListener('click', () => {
      // Pega a área e o lado que estão sendo exibidos.
      // É mais seguro pegar do localStorage, pois são a fonte da verdade após navegação.
      const area = localStorage.getItem('savedArea') || currentArea; 
      const side = localStorage.getItem('savedSide') || currentSide; 

      if (area && side) {
        // Constrói a URL com os parâmetros de query
        window.location.href = `imagem-detalhe.html?area=${encodeURIComponent(area)}&side=${encodeURIComponent(side)}`;
      } else {
        console.error('Erro: Área ou Lado não definidos para exibir a imagem detalhada.');
        alert('Não foi possível exibir a imagem detalhada: selecione uma área e um lado.');
      }
    });
  }

});

document.addEventListener('DOMContentLoaded', () => {
  const areaSelect = document.getElementById('search-area');
  const sideSelect = document.getElementById('search-side');

  areaSelect.addEventListener('change', atualizarSelectValvulasComBaseNaAreaELado);
  sideSelect.addEventListener('change', atualizarSelectValvulasComBaseNaAreaELado);

  // popula na carga, sem precisar clicar
  atualizarSelectValvulasComBaseNaAreaELado();
});

const valvulaPositions = {
  Raizer: {
    A: {
      "valvula-1": { top: 0, left: 0 },
      "valvula-2": { top: 0, left: 70 },
      "valvula-3": { top: 0, left: 140 },
      "valvula-4": { top: 100, left: 0 },
      "valvula-5": { top: 100, left: 70 },
      "valvula-6": { top: 100, left: 140 },
      "valvula-7": { top: 100, left: 210 },
      "valvula-8": { top: 200, left: 0 },
      "valvula-9": { top: 200, left: 70 },
      "valvula-10": { top: 200, left: 140 },
      "valvula-11": { top: 200, left: 210 },
      "valvula-12": { top: 300, left: 70 },
      "valvula-13": { top: 300, left: 210 }, 
      // ...
    },
    B: {
    "valvula-1": { top: 0, left: 170 },
    "valvula-2": { top: 120, left: 170 },
    "valvula-3": { top: 240, left: 100 },
      // ...
    },
    C:{
      "valvula-1": {top:0, left: 100},
      "valvula-2": {top:100, left: 30},
      "valvula-3": {top:100, left: 100},
      "valvula-4": {top:100, left: 170},
      "valvula-5": {top:200, left: 0},
      "valvula-6": {top:200, left: 70},
      "valvula-7": {top:200, left: 140},
      "valvula-8": {top:200, left: 210},
      "valvula-9": {top:300, left: 0},
      "valvula-10": {top:300, left: 210},
      "valvula-11": {top:400, left: 115},
      "valvula-12": {top:400, left: 210},
    },
    D:{
      "valvula-1": {top:0, left: 200},
      "valvula-2": {top:100, left: 200},
      "valvula-3": {top:200, left: 50},
      "valvula-4": {top:200, left: 200},
    }
    // C, D...
  },



Caixa: {
  A: {
    "valvula-1": { top: 0, left: 0 },
    "valvula-2": { top: 120, left: 0 },
    "valvula-3": { top: 240, left: 0 },
    "valvula-4": { top: 360, left: 0 },
  },
  B: {
    "valvula-1": { top: 0,   left: 50 },
    "valvula-2": { top: 100, left: 50 },
    "valvula-3": { top: 200,   left: 20 },
    "valvula-4": { top: 300, left: 0 },
    "valvula-5": { top: 300, left: 70 },
    "valvula-6": { top: 100, left: 140 },
    "valvula-7": { top: 300, left: 140 },
    "valvula-8": { top: 300, left: 210 },
  },
  C:{
    "valvula-1": { top: 0, left: 0 },
    "valvula-2": { top: 120, left: 0 },
    "valvula-3": { top: 240, left: 0 },
  },
  D:{
    "valvula-1": { top: 0, left: 0 },
    "valvula-2": { top: 120, left: 0 },
    "valvula-3": { top: 240, left: 0 },
  },
  //
  // C, D...
}
};

container = document.getElementById('valvulas-container');

Object.entries(countsByArea).forEach(([area, lados]) => {
  Object.entries(lados).forEach(([lado, count]) => {
    for (let i = 1; i <= count; i++) {
      const key = `${area}-${lado}-${i}`;
      const pos = valvulaPositions[key] || { top: 0, left: 0 };
      const wrapper = document.createElement('div');
      wrapper.className = `valvula-wrapper valvula-${area.toLowerCase()}-${lado.toLowerCase()}${i}`;
      wrapper.style.top = pos.top + 'px';
      wrapper.style.left = pos.left + 'px';
      wrapper.innerHTML = `<div class="valvula">${area} ${lado}${i}</div>`;
      container.appendChild(wrapper);
    }
  });
});

function ajustarAlturaContainer() {
  if (currentArea === 'Caixa' && currentSide === 'A') {
    container.style.height = '400px';
  } else if (currentArea === 'Caixa' && currentSide === 'B') {
    container.style.height = '350px';
  } else if (currentArea === 'Caixa' && currentSide === 'C') {
    container.style.height = '300px';
  } else if (currentArea === 'Caixa' && currentSide === 'D') {
    container.style.height = '300px';
  } else if (currentArea === 'Raizer' && currentSide === 'A') {
    container.style.height = '350px';
  } else if (currentArea === 'Raizer' && currentSide === 'B') {
    container.style.height = '300px';
  } else if (currentArea === 'Raizer' && currentSide === 'C') {
    container.style.height = '500px';
  } else if (currentArea === 'Raizer' && currentSide === 'D') {
    container.style.height = '280px';
  } else {
    container.style.height = 'auto';
  }
}

// Sempre que trocar de lado ou área, chame:
ajustarAlturaContainer();




