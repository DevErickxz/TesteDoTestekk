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
let searchChart = null;



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
  return Array.from({ length: total }, (_, i) => `PL ${start + i + 1}`);
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
  const senha = document.getElementById('perfil-senha').value;

  if (!nome) {
    alert('Informe seu nome completo.');
    return;
  }

  // Salva nome no Firestore
  await ref.set({ email: user.email, nome });

  // Se o usuário digitou uma senha, vincula ao login com e-mail/senha
  if (senha) {
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, senha);
    try {
      await user.linkWithCredential(credential);
      console.log('Senha vinculada com sucesso!');
    } catch (e) {
      console.error('Erro ao vincular senha:', e.message);
      alert('Não foi possível vincular a senha: ' + e.message);
    }
  }

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
  mostrarPergunta(index, nome);
}

// Exibe modal de escolha de nota
function mostrarPergunta(index, nome) {
  perguntaContainer.innerHTML = '';
  perguntaContainer.classList.add('show');

  const box = document.createElement('div');
  box.className = 'pergunta-container';

  const notas = [1, 2, 3, 4, 5]; // Só notas de 1 a 5

  box.innerHTML = `
    <div class="pergunta">Qual grau (1 a 5) para ${nome}?</div>
    <div class="respostas">
      ${notas.map(n => `<button data-valor="${n}">${n}</button>`).join('')}
    </div>`;

  // Listener para cada botão
  box.querySelectorAll('.respostas button').forEach(btn => {
    btn.onclick = () => {
      const valor = parseInt(btn.getAttribute('data-valor'));
      votos[currentArea][currentSide][index] = valor; // salva o valor real, não o índice
      perguntaContainer.classList.remove('show');
      setTimeout(() => {
        perguntaContainer.innerHTML = '';
        renderValves();
      }, 300);
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
  const container = document.getElementById('resumo-imagem-container');
  const user = firebase.auth().currentUser;
  const nome = resumoTextModal.querySelector('p strong')?.nextSibling?.textContent?.trim() || 'Usuário';
  const data = new Date().toLocaleString();

  // Pega todos os blocos de resumo, inclusive Global
  const blocosResumo = resumoTextModal.querySelectorAll('.dashboard-resumo');
  const blocosHTML = Array.from(blocosResumo).map(bloco => bloco.outerHTML).join('');

  container.innerHTML = `
    <div style="
      font-family: 'Poppins', sans-serif;
      background: white;
      padding: 75px;
      color: #333;
      border: 1px solid #ddd;
      border-radius: 10px;
      width: 400px;
    ">
      <h2 style="text-align: center; margin-bottom: 20px;">Resumo de Limpeza</h2>
      <p><strong>Usuário:</strong> ${nome}</p>
      <p><strong>Data:</strong> ${data}</p>
      <hr style="margin: 60px 0;">
      ${blocosHTML}
    </div>
  `;

  html2canvas(container.firstElementChild).then(canvas => {
    const link = document.createElement('a');
    link.download = `resumo_valvulas_${new Date().toISOString().slice(0,10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }).catch(err => {
    console.error('Erro ao gerar imagem:', err);
    alert('Erro ao gerar imagem do resumo.');
  });
};

document.getElementById('search-area').onchange =
document.getElementById('search-side').onchange = () => {
  const area = document.getElementById('search-area').value;
  const lado = document.getElementById('search-side').value;
  const sel = document.getElementById('search-valve');
  sel.innerHTML = '';
  getValvesList(area, lado).forEach(nome => {
    const opt = document.createElement('option');
    opt.value = nome;
    opt.textContent = nome;
    sel.appendChild(opt);
  });
};
}

function getOffset(area, lado) {
  const counts = countsByArea[area];
  return {
    A: 0,
    B: counts.A,
    C: counts.A + counts.B,
    D: counts.A + counts.B + counts.C
  }[lado];
}


// Gera e salva o resumo no Firestore
async function mostrarResumo() {
  const user = firebase.auth().currentUser;
  const pressaoRaizer = inputRaizer.value;
  const pressaoCaixa = inputCaixa.value;
  const timestamp = new Date().toISOString();

  const userDoc = await db.collection('users').doc(user.uid).get();
  const userName = userDoc.data()?.nome || 'Desconhecido';

  // Calcula intensidades separadas por área
  const intensidades = {};

  ['Raizer', 'Caixa'].forEach(area => {
    let soma = 0;
    let qtd = 0;

    const lados = countsByArea[area];
    if (!lados) return;

    Object.keys(lados).forEach(lado => {
      const total = lados[lado];
      for (let i = 0; i < total; i++) {
        const nota = votos[area]?.[lado]?.[i] ?? 0;
        if (nota > 0) {
          soma += nota;
          qtd++;
        }
      }
    });

    const media = qtd > 0 ? (soma / qtd) : 0;
    let intensidade = 'Limpa';
    if (media >= 1 && media <= 2) intensidade = 'Suave';
    else if (media > 2 && media <= 3) intensidade = 'Suave+';
    else if (media > 3 && media <= 3.5) intensidade = 'Média';
    else if (media > 3.5 && media <= 4.2) intensidade = 'Média+';
    else if (media > 4.2 && media <= 5) intensidade = 'Intensa';

    intensidades[area] = { media, intensidade };
  });

  // Cálculo da média e intensidade global
  const raizerMedia = intensidades['Raizer']?.media ?? 0;
  const caixaMedia = intensidades['Caixa']?.media ?? 0;
  const mediasValidas = [raizerMedia, caixaMedia].filter(m => m > 0);
  const mediaGlobal = mediasValidas.length > 0
    ? mediasValidas.reduce((a, b) => a + b, 0) / mediasValidas.length
    : 0;

  let intensidadeGlobal = 'Limpa';
  if (mediaGlobal >= 1 && mediaGlobal <= 2) intensidadeGlobal = 'Suave';
  else if (mediaGlobal > 2 && mediaGlobal <= 3) intensidadeGlobal = 'Suave+';
  else if (mediaGlobal > 3 && mediaGlobal <= 3.5) intensidadeGlobal = 'Média';
  else if (mediaGlobal > 3.5 && mediaGlobal <= 4.2) intensidadeGlobal = 'Média+';
  else if (mediaGlobal > 4.2 && mediaGlobal <= 5) intensidadeGlobal = 'Intensa';

  // Gera bloco HTML
  const gerarBlocoResumo = (area, intensidade, classe, media) => `
    <div class="dashboard-resumo" style="margin-bottom: 2rem;">
      <p><strong>Área:</strong> ${area}</p>
      <p><strong>Intensidade:</strong> ${intensidade}</p>
      <div class="intensidade-bola ${classe}" style="
        margin: 10px auto;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: white;
        font-size: 1.1rem;
        width: 60px;
        height: 60px;
        border-radius: 50%;
      ">
        ${media.toFixed(1)}
      </div>
    </div>
  `;

  // Monta HTML
  const resumoHTML = `
    <p><strong>Usuário:</strong> ${userName}</p>
    <p><strong>Data/Hora:</strong> ${new Date(timestamp).toLocaleString()}</p>
    <hr>
    ${['Caixa', 'Raizer'].map(area => {
      const { intensidade, media } = intensidades[area] || {};
      const corClasse =
        media === 0 ? 'intensidade-limpa' :
        intensidade === 'Suave' ? 'intensidade-suave' :
        intensidade === 'Suave+' ? 'intensidade-suave-plus' :
        intensidade === 'Média' ? 'intensidade-media' :
        intensidade === 'Média+' ? 'intensidade-media-plus' :
        intensidade === 'Intensa' ? 'intensidade-intensa' :
      '';
      return gerarBlocoResumo(area, intensidade || 'Desconhecida', corClasse, media || 0);
    }).join('')}

    <hr>
    ${(() => {
      const corClasseGlobal =
        mediaGlobal === 0 ? 'intensidade-limpa' :
        intensidadeGlobal === 'Suave' ? 'intensidade-suave' :
        intensidadeGlobal === 'Suave+' ? 'intensidade-suave-plus' :
        intensidadeGlobal === 'Média' ? 'intensidade-media' :
        intensidadeGlobal === 'Média+' ? 'intensidade-media-plus' :
        intensidadeGlobal === 'Intensa' ? 'intensidade-intensa' :
      '';
      return gerarBlocoResumo('Global', intensidadeGlobal, corClasseGlobal, mediaGlobal);
    })()}
  `;

  // Estrutura das válvulas para salvar
  const valvulasParaSalvar = {
    Raizer: { A: {}, B: {}, C: {}, D: {} },
    Caixa:  { A: {}, B: {}, C: {}, D: {} }
  };

  ['Raizer', 'Caixa'].forEach(area => {
    Object.keys(countsByArea[area]).forEach(lado => {
      const total = countsByArea[area][lado];
      const offset = getOffset(area, lado);
      for (let i = 0; i < total; i++) {
        const nota = votos[area]?.[lado]?.[i] ?? 0;
        const plName = `PL ${offset + i + 1}`;
        valvulasParaSalvar[area][lado][plName] = nota;
      }
    });
  });

  const registroData = {
    userId: user.uid,
    userName,
    data: timestamp,
    pressaoRaizer: pressaoRaizer || null,
    pressaoCaixa: pressaoCaixa || null,
    intensidade: intensidadeGlobal,
    notaIntensidade: Number(mediaGlobal.toFixed(1)),
    valvulas: valvulasParaSalvar
  };

  try {
    await db.collection('registros').add(registroData);

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
    currentSide = 'A'; // Reseta lado para A ao trocar de área
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

 // variável global
function populateSearchValveOptions() {
  const area = document.getElementById('search-area').value;
  const lado = document.getElementById('search-side').value;
  const valveSelect = document.getElementById('search-valve');

  valveSelect.innerHTML = '';

  const quantidade = countsByArea?.[area]?.[lado] || 0;

  for (let i = 1; i <= quantidade; i++) {
    const pl = `PL ${i}`;
    const option = document.createElement('option');
    option.value = pl;
    option.textContent = pl;
    valveSelect.appendChild(option);
  }
}


async function performGraphSearch() {
  const dateStr   = document.getElementById('search-date').value;       
  const area      = document.getElementById('search-area').value;       
  const lado      = document.getElementById('search-side').value;       
  const valveUI   = document.getElementById('search-valve').value;      
  const tipo      = document.getElementById('search-chart-type').value;
  const ctx       = document.getElementById('search-chart').getContext('2d');

  if (!dateStr || !valveUI) {
    alert('Escolha uma data e uma válvula antes de buscar.');
    return;
  }

  const snapshot = await db.collection('registros').get();
  const dadosOrdenados = [];

  snapshot.forEach(doc => {
    const d = doc.data();

    if (!d.data) return;
    let registroDate;
    try {
      registroDate = new Date(d.data);
      if (isNaN(registroDate.getTime())) return;
    } catch (e) {
      return;
    }

    const registroDay = registroDate.toISOString().slice(0, 10);
    if (registroDay !== dateStr) return;

    const nota = d.valvulas?.[area]?.[lado]?.[valveUI];
    if (nota !== undefined && nota > 0) {
      dadosOrdenados.push({ nota: Number(nota), hora: registroDate });
    }
  });

  // Ordena por hora crescente
  dadosOrdenados.sort((a, b) => a.hora - b.hora);

  const ocorrencias = dadosOrdenados.map(d => d.nota);
  const horas       = dadosOrdenados.map(d => {
    const h = d.hora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `Nota: ${d.nota} - ${h}`;
  });

  if (searchChart) {
    searchChart.destroy();
    searchChart = null;
  }

  if (tipo === 'line') {
    searchChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: horas,
      datasets: [{
        label: `Notas ${valveUI} em ${dateStr}`,
        data: ocorrencias,
        fill: false,
        tension: 0.4,
        borderColor: '#007bff',
        backgroundColor: '#007bff',
        pointRadius: 6,
        pointHoverRadius: 8
      }]
      },
      options: {
        responsive: true,
        scales: {
          x: { title: { display: false, text: 'Hora' } },
          y: {
            title: { display: true, text: 'Nota' },
            beginAtZero: true,
            max: 6,
            ticks: { stepSize: 1 }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: context => `Nota: ${context.parsed.y}`
            }
          }
        }
      }
    });
  } else {
    const freq = {1:0,2:0,3:0,4:0,5:0};
    ocorrencias.forEach(n => {
      if (freq[n] !== undefined) freq[n]++;
    });
    const labels = ocorrencias.map((_, i) => `#${i + 1}`);
    const dataPts = ocorrencias;
    
    searchChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
        label: `Notas ${valveUI} em ${dateStr}`,
        data: dataPts
      }]
    },
      options: {
        responsive: true,
        scales: {
          x: { title: { display: true, text: 'Nota' } },
          y: { 
            title: { display: true, text: 'Quantidade' },
            beginAtZero: true 
          }
        }
      }
    });
  }
}






function showSearchGraphView() {
  // 1) Exibe a view de busca
  showView('search-graph-view');

  // 2) Define data padrão (hoje) no único datepicker
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('search-date');
  if (dateInput) dateInput.value = today;

  // 3) Reseta o tipo de gráfico para "linha"
  const typeSelect = document.getElementById('search-chart-type');
  if (typeSelect) typeSelect.value = 'line';

  // 4) Popula o select de válvulas baseado em área/lado atuais
  const selArea  = document.getElementById('search-area')
  const selSide  = document.getElementById('search-side')
  const selValve = document.getElementById('search-valve');
  if (selArea && selSide && selValve) {
    // dispara seu listener de onchange para preencher as opções
    selArea.dispatchEvent(new Event('change'));
    selSide.dispatchEvent(new Event('change'));
  }

  // 5) Limpa qualquer gráfico anterior
  if (searchChart) {
    searchChart.destroy();
    searchChart = null;
  }

  // 6) Limpa o canvas
  const canvas = document.getElementById('search-chart');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
    
}


// async function generateBarChart(ladoSelecionado) {
//   const ctx = document.getElementById('bar-chart-canvas').getContext('2d');
//   const periodo = parseInt(document.getElementById('bar-chart-period').value, 10);
//   const area = currentArea || 'Raizer'; // ou 'Caixa', se preferir

//   const hoje = new Date();
//   const inicio = new Date(hoje);
//   inicio.setDate(hoje.getDate() - periodo);

//   const snapshot = await db.collection('registros').get();

//   const ocorrencias = [];

//   snapshot.forEach(doc => {
//     const d = doc.data();
//     const dataRegistro = new Date(d.data);
//     if (isNaN(dataRegistro.getTime())) return;

//     if (dataRegistro < inicio || dataRegistro > hoje) return;

//     const valvulas = d.valvulas?.[area]?.[ladoSelecionado];
//     if (!valvulas) return;

//     Object.values(valvulas).forEach(nota => {
//       if (typeof nota === 'number' && nota > 0) {
//         ocorrencias.push(nota);
//       }
//     });
//   });

//   if (searchChart) {
//     searchChart.destroy();
//     searchChart = null;
//   }

//   const labels = ocorrencias.map((_, i) => `#${i + 1}`);

//   searchChart = new Chart(ctx, {
//     type: 'bar',
//     data: {
//       labels,
//       datasets: [{
//         label: `Notas encontradas - ${area} - Lado ${ladoSelecionado} (${periodo} dias)`,
//         data: ocorrencias,
//         backgroundColor: '#42a5f5'
//       }]
//     },
//     options: {
//       responsive: true,
//       scales: {
//         x: { title: { display: true, text: 'Ocorrência' } },
//         y: {
//           title: { display: true, text: 'Nota' },
//           beginAtZero: true,
//           max: 5,
//           ticks: { stepSize: 1 }
//         }
//       }
//     }
//   });
// }
