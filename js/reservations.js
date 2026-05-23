// Gerenciador da aba de Reservas
const Reservations = {
  list: [],

  init: async () => {
    await Reservations.load();
    Reservations.render();
    Reservations.setupEventListeners();
  },

  load: async () => {
    const { data, error } = await AppSupabase
      .from('reservations')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      Reservations.list = data;
    } else if (error) {
      console.error('Erro ao carregar reservas', error);
    }
  },

  renderSummary: () => {
    const container = document.getElementById('reservations-summary');
    if (!container) return;

    // Totais globais
    let totalUnitsGlobal = 0;
    const allCustomers = new Set();

    // Group by product_name + size
    const groups = {};
    Reservations.list.forEach(res => {
      totalUnitsGlobal += (res.qtd_reserved || 0);
      if (res.customer_name) allCustomers.add(res.customer_name.trim().toLowerCase());

      const key = `${res.product_name || '—'}||${res.size || '—'}`;
      if (!groups[key]) {
        groups[key] = {
          name: res.product_name || '—',
          size: res.size || '—',
          totalUnits: 0,
          customers: new Set()
        };
      }
      groups[key].totalUnits += (res.qtd_reserved || 0);
      if (res.customer_name) groups[key].customers.add(res.customer_name.trim().toLowerCase());
    });

    const keys = Object.keys(groups);

    if (keys.length === 0) {
      container.innerHTML = '';
      return;
    }

    // Dois cards globais + separador + chips por produto
    const globalCards = `
      <div class="res-global-card" style="animation-delay: 0ms">
        <div class="res-global-icon shirts"><i class='bx bx-shirt'></i></div>
        <div class="res-global-body">
          <span class="res-global-value">${totalUnitsGlobal}</span>
          <span class="res-global-label">CAMISAS reservadas</span>
        </div>
      </div>
      <div class="res-global-card" style="animation-delay: 60ms">
        <div class="res-global-icon clients"><i class='bx bx-group'></i></div>
        <div class="res-global-body">
          <span class="res-global-value">${allCustomers.size}</span>
          <span class="res-global-label">CLIENTES com reserva</span>
        </div>
      </div>
      <div class="res-summary-divider"></div>`;

    const chipCards = keys.map((key, i) => {
      const g = groups[key];
      const delay = ((i + 2) * 60) + 'ms';
      const clientLabel = g.customers.size === 1 ? 'cliente' : 'clientes';
      return `
        <div class="res-chip" style="animation-delay: ${delay}">
          <div class="res-chip-icon"><i class='bx bx-shirt'></i></div>
          <div class="res-chip-body">
            <span class="res-chip-title">${g.name}</span>
            <span class="res-chip-sub">Tamanho: ${g.size}</span>
            <div class="res-chip-stats">
              <span class="res-chip-badge units"><i class='bx bx-package' style="font-size:0.7rem; vertical-align:middle;"></i> ${g.totalUnits} uni.</span>
              <span class="res-chip-badge clients"><i class='bx bx-user' style="font-size:0.7rem; vertical-align:middle;"></i> ${g.customers.size} ${clientLabel}</span>
            </div>
          </div>
        </div>`;
    }).join('');

    container.innerHTML = globalCards + chipCards;
  },

  render: () => {
    const tbody = document.getElementById('reservations-tbody');
    if (!tbody) return;

    Reservations.renderSummary();
    tbody.innerHTML = '';

    if (Reservations.list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 3rem;">Nenhuma reserva registrada até o momento.</td></tr>`;
      return;
    }

    const fragment = document.createDocumentFragment();

    Reservations.list.forEach(res => {
      let formattedDate = '—';
      if (res.created_at) {
        const d = new Date(res.created_at);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          });
        }
      }

      const personalizationHtml = res.personalization
        ? `<span class="tag" style="background: rgba(139,92,246,0.15); color: #a78bfa; border-color: rgba(139,92,246,0.3); max-width: 140px; display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${res.personalization}"><i class='bx bx-brush' style="font-size:0.7rem; vertical-align:middle;"></i> ${res.personalization}</span>`
        : `<span style="color: var(--text-muted); font-size: 0.85rem;">—</span>`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color: var(--text-muted); font-size: 0.85rem;">${formattedDate}</td>
        <td style="font-weight: 500;">${res.product_name || '—'}</td>
        <td><span class="tag">${res.size || '—'}</span></td>
        <td><span class="tag qtd" style="background: rgba(252,191,0,0.12); color: var(--primary); border-color: rgba(252,191,0,0.3);">${res.qtd_reserved} uni.</span></td>
        <td><i class='bx bx-user' style="color:var(--text-muted); margin-right:4px;"></i> ${res.customer_name || '—'}</td>
        <td style="color: var(--text-muted); font-size: 0.85rem;">${res.customer_phone || '—'}</td>
        <td style="color: var(--text-muted); font-size: 0.85rem; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${res.customer_address || ''}">${res.customer_address || '—'}</td>
        <td>${personalizationHtml}</td>
        <td>
          <button class="btn-icon" onclick="Reservations.downloadDoc('${res.id}')" title="Baixar Documento da Reserva" style="color: var(--info); border-color: rgba(59,130,246,0.3);"><i class='bx bx-file-blank'></i></button>
          <button class="btn-icon sell" onclick="Reservations.confirmToSale('${res.id}')" title="Confirmar Venda e Mover para Saídas"><i class='bx bx-check-circle'></i></button>
          <button class="btn-icon delete" onclick="Reservations.cancelReservation('${res.id}')" title="Cancelar Reserva e Devolver Estoque"><i class='bx bx-x-circle'></i></button>
        </td>
      `;
      fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
  },

  setupEventListeners: () => {
    const modal = document.getElementById('modal-reserve-product');
    const btnClose = document.getElementById('close-reserve-modal');
    const btnCancel = document.getElementById('cancel-reserve-modal');
    const form = document.getElementById('form-reserve-product');

    const resetPersonalization = () => {
      const noBtn = document.getElementById('reserve-pers-no');
      const yesBtn = document.getElementById('reserve-pers-yes');
      const persText = document.getElementById('reserve-personalization-text');
      if (noBtn) noBtn.classList.add('active');
      if (yesBtn) yesBtn.classList.remove('active');
      if (persText) { persText.style.display = 'none'; persText.value = ''; }
    };

    const closeModal = () => {
      if (modal) modal.classList.remove('active');
      if (form) form.reset();
      const hiddenId = document.getElementById('reserve-product-id');
      if (hiddenId) hiddenId.value = '';
      resetPersonalization();
    };

    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // Personalization toggle
    const resPersNo = document.getElementById('reserve-pers-no');
    const resPersYes = document.getElementById('reserve-pers-yes');
    const resPersText = document.getElementById('reserve-personalization-text');
    if (resPersNo && resPersYes && resPersText) {
      resPersNo.addEventListener('click', () => {
        resPersNo.classList.add('active');
        resPersYes.classList.remove('active');
        resPersText.style.display = 'none';
        resPersText.value = '';
      });
      resPersYes.addEventListener('click', () => {
        resPersYes.classList.add('active');
        resPersNo.classList.remove('active');
        resPersText.style.display = 'block';
        resPersText.focus();
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const productId = document.getElementById('reserve-product-id').value;
        const customerName = document.getElementById('reserve-customer-name').value;
        const customerAddress = document.getElementById('reserve-customer-address').value;
        const customerPhone = document.getElementById('reserve-customer-phone').value;
        const qtd = parseInt(document.getElementById('reserve-qtd').value);
        const persYesActive = document.getElementById('reserve-pers-yes')?.classList.contains('active');
        const personalization = persYesActive ? (document.getElementById('reserve-personalization-text')?.value.trim() || null) : null;

        await Reservations.makeReservation(productId, customerName, customerAddress, customerPhone, qtd, personalization);
        closeModal();
      });
    }
  },

  openReserveModal: (productId) => {
    const product = Inventory.products.find(p => p.id === productId);
    if (!product) {
      Toast.show('Produto não encontrado no sistema.', 'error');
      return;
    }
    if (product.qtd <= 0) {
      Toast.show('Produto sem estoque disponível para reserva.', 'error');
      return;
    }

    document.getElementById('reserve-product-id').value = product.id;
    document.getElementById('reserve-product-name').textContent = product.name;
    document.getElementById('reserve-product-size').textContent = product.size || '—';
    document.getElementById('reserve-product-color').textContent = product.color || '—';
    document.getElementById('reserve-product-max').textContent = `Máx disponível: ${product.qtd}`;
    document.getElementById('reserve-qtd').max = product.qtd;
    document.getElementById('reserve-qtd').value = 1;
    document.getElementById('reserve-customer-name').value = '';
    document.getElementById('reserve-customer-address').value = '';
    document.getElementById('reserve-customer-phone').value = '';

    document.getElementById('modal-reserve-product').classList.add('active');
  },

  makeReservation: async (productId, customerName, customerAddress, customerPhone, qtd, personalization = null) => {
    const pIndex = Inventory.products.findIndex(p => p.id === productId);
    if (pIndex === -1) {
      Toast.show('Produto não encontrado no inventário.', 'error');
      return;
    }

    if (Inventory.products[pIndex].qtd < qtd) {
      Toast.show(`Quantidade solicitada excede o estoque de ${Inventory.products[pIndex].qtd} unidades.`, 'error');
      return;
    }

    const productName = Inventory.products[pIndex].name;
    const newQtd = Inventory.products[pIndex].qtd - qtd;

    const [invResult, resResult] = await Promise.all([
      AppSupabase.from('inventory').update({ qtd: newQtd }).eq('id', productId),
      AppSupabase.from('reservations').insert([{
        product_id: productId,
        product_name: productName,
        size: Inventory.products[pIndex].size || null,
        color: Inventory.products[pIndex].color || null,
        customer_name: customerName,
        customer_address: customerAddress,
        customer_phone: customerPhone,
        qtd_reserved: qtd,
        personalization: personalization || null
      }]).select()
    ]);

    if (invResult.error) {
      Toast.show('Erro ao reservar no estoque.', 'error');
      return;
    }

    if (resResult.error) {
      Toast.show('Erro ao registrar a reserva no banco.', 'error');
      return;
    }

    // Optimistic local update
    Inventory.products[pIndex].qtd = newQtd;
    Inventory.render();

    await Reservations.load();
    Reservations.render();

    Toast.show(`Reserva de "${productName}" criada com sucesso!`, 'success');
  },

  confirmToSale: (reservationId) => {
    const res = Reservations.list.find(r => r.id === reservationId);
    if (!res) {
      Toast.show('Reserva não encontrada.', 'error');
      return;
    }

    // Find product in inventory
    const product = Inventory.products.find(p => p.id === res.product_id);
    if (!product) {
      Toast.show('O produto desta reserva não existe mais no estoque.', 'warning');
    }

    // Pre-fill the sell modal with reservation data
    document.getElementById('sell-product-id').value = res.product_id || '';
    document.getElementById('sell-product-name').textContent = res.product_name;

    // Show stock available (product may have been removed; allow 0 override)
    const availableQtd = product ? product.qtd : 0;
    document.getElementById('sell-product-max').textContent = `Reservado: ${res.qtd_reserved} uni. (estoque atual: ${availableQtd})`;

    document.getElementById('sell-qtd').value = res.qtd_reserved;
    document.getElementById('sell-qtd').max = res.qtd_reserved + availableQtd;
    document.getElementById('sell-buyer').value = res.customer_name;
    document.getElementById('sell-total-price').value = '';

    const currentSession = Auth.getCurrentUser();
    if (currentSession) {
      document.getElementById('sell-seller').value = currentSession.name;
    }

    // Store reservation id to be cleaned up after sale
    document.getElementById('sell-product-id').dataset.reservationId = reservationId;

    document.getElementById('modal-sell-product').classList.add('active');
  },

  cancelReservation: async (reservationId) => {
    if (!confirm('Deseja cancelar esta reserva? A quantidade será devolvida ao estoque.')) return;

    const res = Reservations.list.find(r => r.id === reservationId);
    if (!res) {
      Toast.show('Reserva não encontrada.', 'error');
      return;
    }

    const ops = [
      AppSupabase.from('reservations').delete().eq('id', reservationId)
    ];

    const pIndex = Inventory.products.findIndex(p => p.id === res.product_id);
    if (pIndex !== -1) {
      const newQtd = Inventory.products[pIndex].qtd + res.qtd_reserved;
      ops.push(AppSupabase.from('inventory').update({ qtd: newQtd }).eq('id', res.product_id));
    }

    const results = await Promise.all(ops);
    const hasError = results.some(r => r.error);

    if (!hasError) {
      Reservations.list = Reservations.list.filter(r => r.id !== reservationId);
      Reservations.render();

      if (pIndex !== -1) {
        Inventory.products[pIndex].qtd += res.qtd_reserved;
        Inventory.render();
      }

      Toast.show('Reserva cancelada e estoque devolvido.', 'info');
    } else {
      Toast.show('Erro ao cancelar reserva. Tente novamente.', 'error');
    }
  },

  // Called by Sales.processSale after a reservation-originated sale is confirmed
  cleanupAfterSale: async (reservationId) => {
    if (!reservationId) return;
    await AppSupabase.from('reservations').delete().eq('id', reservationId);
    Reservations.list = Reservations.list.filter(r => r.id !== reservationId);
    Reservations.render();
  },

  // Generate a short protocol code from the reservation ID and date
  _buildProtocol: (id, createdAt) => {
    const datePart = createdAt
      ? new Date(createdAt).toLocaleDateString('pt-BR').replace(/\//g, '')
      : new Date().toLocaleDateString('pt-BR').replace(/\//g, '');
    const idPart = (id || '').toString().toUpperCase().slice(-6);
    return `RES-${datePart}-${idPart}`;
  },

  // Download a styled HTML document as a printable page
  downloadDoc: (reservationId) => {
    const res = Reservations.list.find(r => r.id === reservationId);
    if (!res) {
      Toast.show('Reserva não encontrada.', 'error');
      return;
    }

    const protocol = Reservations._buildProtocol(res.id, res.created_at);

    const formattedDate = res.created_at
      ? new Date(res.created_at).toLocaleDateString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        })
      : '—';

    const personalizationSection = res.personalization
      ? `<div class="doc-field">
           <span class="doc-label">Personalização</span>
           <span class="doc-value">${res.personalization}</span>
         </div>`
      : '';

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Reserva ${protocol}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background: #f8f9fc;
      color: #1a1a2e;
      padding: 2rem;
    }
    .doc-wrap {
      max-width: 700px;
      margin: 0 auto;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 4px 30px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .doc-header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      padding: 2rem 2.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .doc-header h1 {
      color: #fcbf00;
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .doc-header p {
      color: rgba(255,255,255,0.6);
      font-size: 0.8rem;
      margin-top: 0.25rem;
    }
    .doc-protocol {
      background: rgba(252,191,0,0.15);
      border: 1px solid rgba(252,191,0,0.4);
      border-radius: 8px;
      padding: 0.6rem 1.2rem;
      text-align: center;
    }
    .doc-protocol span { display: block; }
    .doc-protocol .proto-label { color: rgba(255,255,255,0.5); font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; }
    .doc-protocol .proto-code { color: #fcbf00; font-size: 1rem; font-weight: 700; letter-spacing: 1px; }
    .doc-body { padding: 2rem 2.5rem; }
    .doc-section {
      margin-bottom: 1.75rem;
    }
    .doc-section-title {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #888;
      border-bottom: 1px solid #eee;
      padding-bottom: 0.5rem;
      margin-bottom: 1rem;
    }
    .doc-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    .doc-field { display: flex; flex-direction: column; gap: 0.2rem; }
    .doc-label { font-size: 0.72rem; color: #aaa; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
    .doc-value { font-size: 0.95rem; font-weight: 600; color: #1a1a2e; }
    .doc-value.highlight { color: #fcbf00; }
    .doc-tag {
      display: inline-block;
      background: rgba(252,191,0,0.1);
      color: #a07c00;
      border: 1px solid rgba(252,191,0,0.3);
      border-radius: 6px;
      padding: 0.2rem 0.75rem;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .doc-footer {
      background: #f8f9fc;
      border-top: 1px solid #eee;
      padding: 1.2rem 2.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .doc-footer p { font-size: 0.75rem; color: #aaa; }
    .doc-watermark { font-size: 0.7rem; color: #ccc; }
    @media print {
      body { background: white; padding: 0; }
      .doc-wrap { box-shadow: none; border-radius: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="doc-wrap">
    <div class="doc-header">
      <div>
        <h1>GolRila Estoques</h1>
        <p>Documento de Reserva &mdash; ${formattedDate}</p>
      </div>
      <div class="doc-protocol">
        <span class="proto-label">Protocolo</span>
        <span class="proto-code">${protocol}</span>
      </div>
    </div>

    <div class="doc-body">

      <div class="doc-section">
        <div class="doc-section-title">Dados do Cliente</div>
        <div class="doc-grid">
          <div class="doc-field" style="grid-column: span 2;">
            <span class="doc-label">Nome</span>
            <span class="doc-value">${res.customer_name || '—'}</span>
          </div>
          <div class="doc-field">
            <span class="doc-label">Telefone / WhatsApp</span>
            <span class="doc-value">${res.customer_phone || '—'}</span>
          </div>
          <div class="doc-field">
            <span class="doc-label">Endereço</span>
            <span class="doc-value">${res.customer_address || '—'}</span>
          </div>
        </div>
      </div>

      <div class="doc-section">
        <div class="doc-section-title">Produto Reservado</div>
        <div class="doc-grid">
          <div class="doc-field" style="grid-column: span 2;">
            <span class="doc-label">Produto</span>
            <span class="doc-value">${res.product_name || '—'}</span>
          </div>
          <div class="doc-field">
            <span class="doc-label">Tamanho</span>
            <span class="doc-value"><span class="doc-tag">${res.size || '—'}</span></span>
          </div>
          <div class="doc-field">
            <span class="doc-label">Quantidade</span>
            <span class="doc-value">${res.qtd_reserved} unidade(s)</span>
          </div>
          ${personalizationSection}
        </div>
      </div>

    </div>

    <div class="doc-footer">
      <p>Emitido em: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
      <p class="doc-watermark">GolRila Estoques &copy; ${new Date().getFullYear()}</p>
    </div>
  </div>

  <script>
    window.onload = () => window.print();
  <\/script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reserva_${protocol}.html`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);

    Toast.show(`Documento da reserva ${protocol} baixado!`, 'success');
  }
};
