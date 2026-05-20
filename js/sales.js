// Gerenciador da aba de Vendas e Saídas
const Sales = {
  history: [],

  init: async () => {
    await Sales.load();
    Sales.render();
    Sales.setupEventListeners();
  },

  load: async () => {
    const { data, error } = await AppSupabase.from('sales').select('*').order('date', { ascending: false });
    if (!error && data) {
      Sales.history = data;
    }
  },

  // Renders the Sold Items table
  render: () => {
    const tbody = document.getElementById('sold-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (Sales.history.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 3rem;">Nenhuma venda registrada até o momento.</td></tr>`;
      return;
    }

    // Supabase returns sorted by date already
    const sortedSales = Sales.history;

    const fragment = document.createDocumentFragment();

    sortedSales.forEach(sale => {
      // Defensively handle missing/null date
      let formattedDate = '—';
      if (sale.date) {
        const dateObj = new Date(sale.date);
        if (!isNaN(dateObj.getTime())) {
          formattedDate = dateObj.toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          });
        }
      }

      const productName = sale.product_name || '—';
      const qtdSold = sale.qtd_sold ?? '?';
      const paymentMethod = sale.payment_method || 'Dinheiro';
      const buyerName = sale.buyer_name || '—';
      const sellerName = sale.seller_name || '—';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color: var(--text-muted); font-size: 0.85rem;">${formattedDate}</td>
        <td style="font-weight: 500;">${productName}</td>
        <td><span class="tag">${sale.size || '—'}</span></td>
        <td><span class="tag qtd danger">-${qtdSold} uni.</span></td>
        <td><span class="tag" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border-color: rgba(59, 130, 246, 0.3);">${paymentMethod}</span></td>
        <td><i class='bx bx-user' style="color:var(--text-muted); margin-right:4px;"></i> ${buyerName}</td>
        <td><i class='bx bxs-badge-check' style="color:var(--primary); margin-right:4px;"></i> ${sellerName}</td>
        <td>
          <button class="btn-icon delete" onclick="Sales.cancelSale('${sale.id}')" title="Cancelar Venda e Devolver Estoque"><i class='bx bx-x-circle'></i></button>
        </td>
      `;
      fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
  },

  setupEventListeners: () => {
    const modalSell = document.getElementById('modal-sell-product');
    const btnCloseSell = document.getElementById('close-sell-modal');
    const btnCancelSell = document.getElementById('cancel-sell-modal');
    const formSell = document.getElementById('form-sell-product');

    const closeModal = () => {
      if (modalSell) {
        modalSell.classList.remove('active');
        const sellIdEl = document.getElementById('sell-product-id');
        sellIdEl.value = '';
        delete sellIdEl.dataset.reservationId;
      }
      if (formSell) formSell.reset();
    };

    if (btnCloseSell) btnCloseSell.addEventListener('click', closeModal);
    if (btnCancelSell) btnCancelSell.addEventListener('click', closeModal);

    // Close modal on click outside
    if (modalSell) {
      modalSell.addEventListener('click', (e) => {
        if (e.target === modalSell) closeModal();
      });
    }

    if (formSell) {
      formSell.addEventListener('submit', (e) => {
        e.preventDefault();

        const productId = document.getElementById('sell-product-id').value;
        const buyerName = document.getElementById('sell-buyer').value;
        const sellerName = document.getElementById('sell-seller').value;
        const qtdSold = parseInt(document.getElementById('sell-qtd').value);
        const paymentMethod = document.getElementById('sell-payment-method').value;
        const totalPrice = parseFloat(document.getElementById('sell-total-price').value);

        Sales.processSale(productId, buyerName, sellerName, qtdSold, paymentMethod, totalPrice);
      });
    }
  },

  openSellModal: (productId) => {
    // Inventory array should be up to date and accessible
    const product = Inventory.products.find(p => p.id === productId);
    if (!product) {
      Toast.show('Produto não encontrado no sistema.', 'error');
      return;
    }

    if (product.qtd <= 0) {
      Toast.show('Produto totalmente sem estoque. Não é possível vender.', 'error');
      return;
    }

    // Populate Modal Data
    document.getElementById('sell-product-id').value = product.id;
    document.getElementById('sell-product-name').textContent = product.name;
    document.getElementById('sell-product-max').textContent = `Máx disponível: ${product.qtd}`;
    document.getElementById('sell-qtd').max = product.qtd;
    document.getElementById('sell-qtd').value = 1; // Default to 1
    document.getElementById('sell-total-price').value = '';

    // Auto fill seller input if possible
    const currentSession = Auth.getCurrentUser();
    if (currentSession) {
      document.getElementById('sell-seller').value = currentSession.name;
    }

    document.getElementById('modal-sell-product').classList.add('active');
  },

  cancelSale: async (saleId) => {
    if (!confirm('Deseja realmente cancelar esta venda? Os itens serão devolvidos ao estoque.')) {
      return;
    }

    const sale = Sales.history.find(s => s.id === saleId);
    if (!sale) {
      Toast.show('Venda não encontrada.', 'error');
      return;
    }

    const pIndex = Inventory.products.findIndex(p => p.id === sale.product_id);

    // Run inventory restore + sale delete + trans delete in parallel
    const ops = [
      AppSupabase.from('sales').delete().eq('id', saleId),
      AppSupabase.from('transactions').delete().eq('sale_id', saleId)
    ];

    if (pIndex !== -1) {
      const newQtd = Inventory.products[pIndex].qtd + sale.qtd_sold;
      ops.push(AppSupabase.from('inventory').update({ qtd: newQtd }).eq('id', sale.product_id));
    } else {
      Toast.show('Aviso: O produto original foi excluído. Venda removida sem devolver o estoque.', 'warning');
    }

    const results = await Promise.all(ops);
    const hasError = results.some(r => r.error);

    if (!hasError) {
      // Optimistically update local state (no extra DB round-trips)
      Sales.history = Sales.history.filter(s => s.id !== saleId);
      Sales.render();

      if (typeof Transactions !== 'undefined') {
        Transactions.loadTransactions(); // refresh dashboard
      }

      if (pIndex !== -1) {
        Inventory.products[pIndex].qtd += sale.qtd_sold;
        Inventory.render();
      }

      // Trigger Admin refresh if loaded
      if (typeof Admin !== 'undefined' && Admin.renderStats) {
        Admin.renderStats();
      }

      Toast.show('Venda cancelada com sucesso.', 'info');
    } else {
      Toast.show('Erro ao cancelar venda. Tente novamente.', 'error');
    }
  },

  processSale: async (productId, buyerName, sellerName, qtdSold, paymentMethod, totalPrice) => {
    const pIndex = Inventory.products.findIndex(p => p.id === productId);
    if (pIndex === -1) {
      Toast.show('Desculpe, ocorreu um erro na leitura do inventario.', 'error');
      return;
    }

    // Verifica se a venda veio de uma reserva (estoque ja foi deduzido na reserva)
    const sellIdEl = document.getElementById('sell-product-id');
    const fromReservation = sellIdEl && !!sellIdEl.dataset.reservationId;

    if (!fromReservation && Inventory.products[pIndex].qtd < qtdSold) {
      Toast.show(`Quantidade solicitada excede o estoque limite de ${Inventory.products[pIndex].qtd}.`, 'error');
      return;
    }

    if (isNaN(totalPrice) || totalPrice <= 0) {
      Toast.show('Por favor, defina um valor total valido para a venda.', 'warning');
      return;
    }

    // Capture product name BEFORE any async reload (avoids stale index bug)
    const productName = Inventory.products[pIndex].name;
    const newQtd = Inventory.products[pIndex].qtd - (fromReservation ? 0 : qtdSold);

    const tDate = new Date().toISOString().split('T')[0];

    // Se vier de reserva, NAO atualiza estoque novamente (ja foi deduzido na reserva)
    const saleInsertPromise = AppSupabase.from('sales').insert([{
      product_id: productId,
      product_name: productName,
      size: Inventory.products[pIndex].size || null,
      buyer_name: buyerName,
      seller_name: sellerName,
      qtd_sold: qtdSold,
      payment_method: paymentMethod
    }]).select();

    let invResult = { error: null };
    let saleResult;

    if (fromReservation) {
      saleResult = await saleInsertPromise;
    } else {
      [invResult, saleResult] = await Promise.all([
        AppSupabase.from('inventory').update({ qtd: newQtd }).eq('id', productId),
        saleInsertPromise
      ]);
    }

    if (invResult.error) {
      Toast.show('Erro ao deduzir o estoque.', 'error');
      return;
    }

    if (saleResult.error) {
      Toast.show('Venda nao autorizada pelo banco de dados.', 'error');
      return;
    }

    const insertedSale = saleResult.data ? saleResult.data[0] : null;

    if (insertedSale) {
      const transResult = await AppSupabase.from('transactions').insert([{
        amount: totalPrice,
        date: tDate,
        description: `Venda do Produto: ${productName} (${qtdSold}x) a ${buyerName}`,
        user_name: sellerName,
        sale_id: insertedSale.id
      }]);

      if (transResult.error) {
        Toast.show('Venda foi feita, mas nao foi possivel adicionar a transacao.', 'warning');
        console.error(transResult.error);
      }
    }

    // Atualiza estado local apenas se nao veio de reserva (evita dupla deducao)
    if (!fromReservation) {
      Inventory.products[pIndex].qtd = newQtd;
      Inventory.render();
    }

    // Reload only sales (to get the newly inserted row with server timestamp)
    await Sales.load();
    Sales.render();

    // Se veio de reserva, remove a reserva da lista
    const reservationId = sellIdEl ? sellIdEl.dataset.reservationId : null;
    if (reservationId && typeof Reservations !== 'undefined') {
      await Reservations.cleanupAfterSale(reservationId);
    }

    Toast.show('Venda registrada com sucesso!', 'success');
    document.getElementById('modal-sell-product').classList.remove('active');
    if (sellIdEl) delete sellIdEl.dataset.reservationId;
  }
};

// Initialization is managed by App.showApp async flow
