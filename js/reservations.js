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

    // Group by product_name + size
    const groups = {};
    Reservations.list.forEach(res => {
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

    container.innerHTML = keys.map((key, i) => {
      const g = groups[key];
      const delay = (i * 60) + 'ms';
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
  },

  render: () => {
    const tbody = document.getElementById('reservations-tbody');
    if (!tbody) return;

    Reservations.renderSummary();
    tbody.innerHTML = '';

    if (Reservations.list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 3rem;">Nenhuma reserva registrada até o momento.</td></tr>`;
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

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color: var(--text-muted); font-size: 0.85rem;">${formattedDate}</td>
        <td style="font-weight: 500;">${res.product_name || '—'}</td>
        <td><span class="tag">${res.size || '—'}</span></td>
        <td><span class="tag qtd" style="background: rgba(252,191,0,0.12); color: var(--primary); border-color: rgba(252,191,0,0.3);">${res.qtd_reserved} uni.</span></td>
        <td><i class='bx bx-user' style="color:var(--text-muted); margin-right:4px;"></i> ${res.customer_name || '—'}</td>
        <td style="color: var(--text-muted); font-size: 0.85rem;">${res.customer_phone || '—'}</td>
        <td style="color: var(--text-muted); font-size: 0.85rem; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${res.customer_address || ''}">${res.customer_address || '—'}</td>
        <td>
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

    const closeModal = () => {
      if (modal) modal.classList.remove('active');
      if (form) form.reset();
      const hiddenId = document.getElementById('reserve-product-id');
      if (hiddenId) hiddenId.value = '';
    };

    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const productId = document.getElementById('reserve-product-id').value;
        const customerName = document.getElementById('reserve-customer-name').value;
        const customerAddress = document.getElementById('reserve-customer-address').value;
        const customerPhone = document.getElementById('reserve-customer-phone').value;
        const qtd = parseInt(document.getElementById('reserve-qtd').value);

        await Reservations.makeReservation(productId, customerName, customerAddress, customerPhone, qtd);
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

  makeReservation: async (productId, customerName, customerAddress, customerPhone, qtd) => {
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
        qtd_reserved: qtd
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
  }
};
