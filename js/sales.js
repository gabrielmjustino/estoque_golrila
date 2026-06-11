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
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 3rem;">Nenhuma venda registrada até o momento.</td></tr>`;
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

      const personalizationHtml = sale.personalization
        ? `<span class="tag" style="background: rgba(139,92,246,0.15); color: #a78bfa; border-color: rgba(139,92,246,0.3); max-width: 160px; display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${sale.personalization}"><i class='bx bx-brush' style="font-size:0.7rem; vertical-align:middle;"></i> ${sale.personalization}</span>`
        : `<span style="color: var(--text-muted); font-size: 0.85rem;">—</span>`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color: var(--text-muted); font-size: 0.85rem;">${formattedDate}</td>
        <td style="font-weight: 500;">${productName}</td>
        <td><span class="tag">${sale.size || '—'}</span></td>
        <td><span class="tag qtd danger">-${qtdSold} uni.</span></td>
        <td><span class="tag" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border-color: rgba(59, 130, 246, 0.3);">${paymentMethod}</span></td>
        <td><i class='bx bx-user' style="color:var(--text-muted); margin-right:4px;"></i> ${buyerName}</td>
        <td><i class='bx bxs-badge-check' style="color:var(--primary); margin-right:4px;"></i> ${sellerName}</td>
        <td>${personalizationHtml}</td>
        <td>
          <button class="btn-icon delete" onclick="Sales.cancelSale('${sale.id}')" title="Cancelar Venda e Devolver Estoque"><i class='bx bx-x-circle'></i></button>
        </td>
      `;
      fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
    Sales.renderStats();
  },

  renderStats: () => {
    const history = Sales.history;

    const elTotalOps = document.getElementById('sold-stat-total-ops');
    const elTotalUnits = document.getElementById('sold-stat-total-units');
    const elTopProduct = document.getElementById('sold-stat-top-product');
    const elUniqueProducts = document.getElementById('sold-stat-unique-products');

    const totalOps = history.length;
    const totalUnits = history.reduce((sum, s) => sum + (parseInt(s.qtd_sold) || 0), 0);

    // Agrupa por nome de produto -> { total, sizes: { tamanho: qty } }
    const productMap = {};
    history.forEach(s => {
      const name = s.product_name || 'Desconhecido';
      const qty = parseInt(s.qtd_sold) || 0;
      const size = s.size || null; // já salvo no banco pelo GitHub

      if (!productMap[name]) productMap[name] = { total: 0, sizes: {} };
      productMap[name].total += qty;
      if (size) {
        productMap[name].sizes[size] = (productMap[name].sizes[size] || 0) + qty;
      }
    });

    const productEntries = Object.entries(productMap).sort((a, b) => b[1].total - a[1].total);
    const uniqueCount = productEntries.length;
    const topName = productEntries.length > 0 ? productEntries[0][0] : '—';

    if (elTotalOps) elTotalOps.textContent = totalOps;
    if (elTotalUnits) elTotalUnits.textContent = totalUnits;
    if (elUniqueProducts) elUniqueProducts.textContent = uniqueCount;
    if (elTopProduct) {
      elTopProduct.textContent = topName.length > 18 ? topName.substring(0, 16) + '…' : topName;
      elTopProduct.title = topName;
    }

    const subtitleEl = document.getElementById('sold-ranking-subtitle');
    if (subtitleEl) subtitleEl.textContent = `${uniqueCount} produto${uniqueCount !== 1 ? 's' : ''} · ${totalUnits} unidades no total`;

    const rankingList = document.getElementById('sold-ranking-list');
    if (!rankingList) return;

    if (productEntries.length === 0) {
      rankingList.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 1rem 0;">Nenhuma venda registrada.</p>`;
      return;
    }

    const maxQtd = productEntries[0][1].total;

    rankingList.innerHTML = productEntries.map(([name, data], index) => {
      const qty = data.total;
      const sizes = data.sizes;
      const pct = maxQtd > 0 ? Math.round((qty / maxQtd) * 100) : 0;

      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉'
        : `<span style="color:var(--text-muted); font-size:0.85rem;">#${index + 1}</span>`;

      const barColor = index === 0 ? 'var(--primary)'
        : index === 1 ? 'var(--success)'
          : index === 2 ? 'var(--warning)'
            : 'var(--text-muted)';

      const sizeOrder = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG', 'Único'];
      const sizeEntries = Object.entries(sizes).sort((a, b) => {
        const ai = sizeOrder.indexOf(a[0]), bi = sizeOrder.indexOf(b[0]);
        if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
        if (ai === -1) return 1; if (bi === -1) return -1;
        return ai - bi;
      });

      const sizeChipsHtml = sizeEntries.length > 0
        ? `<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:6px;">
            ${sizeEntries.map(([sz, sqty]) => `
              <span style="display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:2px 8px;font-size:0.78rem;color:var(--text-muted);">
                <span style="font-weight:600;color:${barColor};">${sz}</span>
                <span>· ${sqty} uni.</span>
              </span>`).join('')}
           </div>` : '';

      return `
        <div style="display:flex;align-items:flex-start;gap:0.75rem;padding-bottom:0.75rem;border-bottom:1px solid rgba(255,255,255,0.05);">
          <div style="width:2rem;text-align:center;flex-shrink:0;padding-top:2px;">${medal}</div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
              <span style="font-size:0.9rem;font-weight:500;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:65%;" title="${name}">${name}</span>
              <span style="font-size:0.9rem;font-weight:700;color:${barColor};flex-shrink:0;">${qty} uni.</span>
            </div>
            <div style="background:rgba(255,255,255,0.07);border-radius:99px;height:6px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:${barColor};border-radius:99px;transition:width 0.5s ease;"></div>
            </div>
            ${sizeChipsHtml}
          </div>
        </div>`;
    }).join('');
  },



  setupEventListeners: () => {
    const modalSell = document.getElementById('modal-sell-product');
    const btnCloseSell = document.getElementById('close-sell-modal');
    const btnCancelSell = document.getElementById('cancel-sell-modal');
    const formSell = document.getElementById('form-sell-product');

    const resetPersonalization = () => {
      const noBtn = document.getElementById('sell-pers-no');
      const yesBtn = document.getElementById('sell-pers-yes');
      const persText = document.getElementById('sell-personalization-text');
      if (noBtn) noBtn.classList.add('active');
      if (yesBtn) yesBtn.classList.remove('active');
      if (persText) { persText.style.display = 'none'; persText.value = ''; }
    };

    const closeModal = () => {
      if (modalSell) {
        modalSell.classList.remove('active');
        const sellIdEl = document.getElementById('sell-product-id');
        sellIdEl.value = '';
        delete sellIdEl.dataset.reservationId;
      }
      if (formSell) formSell.reset();
      resetPersonalization();
    };

    if (btnCloseSell) btnCloseSell.addEventListener('click', closeModal);
    if (btnCancelSell) btnCancelSell.addEventListener('click', closeModal);

    // Close modal on click outside
    if (modalSell) {
      modalSell.addEventListener('click', (e) => {
        if (e.target === modalSell) closeModal();
      });
    }

    // Personalization toggle
    const sellPersNo = document.getElementById('sell-pers-no');
    const sellPersYes = document.getElementById('sell-pers-yes');
    const sellPersText = document.getElementById('sell-personalization-text');
    if (sellPersNo && sellPersYes && sellPersText) {
      sellPersNo.addEventListener('click', () => {
        sellPersNo.classList.add('active');
        sellPersYes.classList.remove('active');
        sellPersText.style.display = 'none';
        sellPersText.value = '';
      });
      sellPersYes.addEventListener('click', () => {
        sellPersYes.classList.add('active');
        sellPersNo.classList.remove('active');
        sellPersText.style.display = 'block';
        sellPersText.focus();
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
        const persYesActive = document.getElementById('sell-pers-yes')?.classList.contains('active');
        const personalization = persYesActive ? (document.getElementById('sell-personalization-text')?.value.trim() || null) : null;

        Sales.processSale(productId, buyerName, sellerName, qtdSold, paymentMethod, totalPrice, personalization);
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
    document.getElementById('sell-product-size').textContent = product.size || '—';
    document.getElementById('sell-product-color').textContent = product.color || '—';
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

  processSale: async (productId, buyerName, sellerName, qtdSold, paymentMethod, totalPrice, personalization = null) => {
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
      payment_method: paymentMethod,
      personalization: personalization || null
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
