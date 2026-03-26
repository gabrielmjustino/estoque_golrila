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
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">Nenhuma venda registrada até o momento.</td></tr>`;
      return;
    }

    // Supabase returns sorted by date already
    const sortedSales = Sales.history;

    sortedSales.forEach(sale => {
      const dateObj = new Date(sale.date);
      const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const tr = document.createElement('tr');
      
      tr.innerHTML = `
        <td style="color: var(--text-muted); font-size: 0.85rem;">${formattedDate}</td>
        <td style="font-weight: 500;">${sale.product_name}</td>
        <td><span class="tag qtd danger">-${sale.qtd_sold} uni.</span></td>
        <td><span class="tag" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border-color: rgba(59, 130, 246, 0.3);">${sale.payment_method || 'Dinheiro'}</span></td>
        <td><i class='bx bx-user' style="color:var(--text-muted); margin-right:4px;"></i> ${sale.buyer_name}</td>
        <td><i class='bx bxs-badge-check' style="color:var(--primary); margin-right:4px;"></i> ${sale.seller_name}</td>
        <td>
          <button class="btn-icon delete" onclick="Sales.cancelSale('${sale.id}')" title="Cancelar Venda e Devolver Estoque"><i class='bx bx-x-circle'></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  setupEventListeners: () => {
    const modalSell = document.getElementById('modal-sell-product');
    const btnCloseSell = document.getElementById('close-sell-modal');
    const btnCancelSell = document.getElementById('cancel-sell-modal');
    const formSell = document.getElementById('form-sell-product');

    const closeModal = () => {
      if(modalSell) {
        modalSell.classList.remove('active');
        document.getElementById('sell-product-id').value = '';
      }
      if(formSell) formSell.reset();
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

        Sales.processSale(productId, buyerName, sellerName, qtdSold, paymentMethod);
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
    
    // Auto fill seller input if possible
    const currentSession = Auth.getCurrentUser();
    if(currentSession) {
      document.getElementById('sell-seller').value = currentSession.name;
    }

    document.getElementById('modal-sell-product').classList.add('active');
  },

  cancelSale: async (saleId) => {
    if (!confirm('Deseja realmente cancelar esta venda? Os itens serão devolvidos ao estoque.')) {
      return;
    }

    const saleIndex = Sales.history.findIndex(s => s.id === saleId);
    if (saleIndex === -1) {
      Toast.show('Venda não encontrada.', 'error');
      return;
    }

    const sale = Sales.history[saleIndex];
    
    // Transact (Deduct from inventory back)
    const pIndex = Inventory.products.findIndex(p => p.id === sale.product_id); // using snake_case product_id
    if (pIndex !== -1) {
      const newQtd = Inventory.products[pIndex].qtd + sale.qtd_sold; // using snake_case
      const { error: invError } = await AppSupabase.from('inventory').update({ qtd: newQtd }).eq('id', sale.product_id);
      if (!invError) {
        await Inventory.load();
        Inventory.render();
      }
    } else {
      // Caso o produto original tenha sido deletado
      Toast.show('Aviso: O produto original foi excluído. Venda removida sem devolver o estoque.', 'warning');
    }

    // Remove sale history via Supabase
    const { error: delError } = await AppSupabase.from('sales').delete().eq('id', saleId);
    if (!delError) {
      await Sales.load();
      Sales.render();
    }

    // Trigger Admin refresh if loaded
    if (typeof Admin !== 'undefined' && Admin.renderStats) {
      Admin.renderStats();
    }

    Toast.show('Venda cancelada com sucesso.', 'info');
  },

  processSale: async (productId, buyerName, sellerName, qtdSold, paymentMethod) => {
    const pIndex = Inventory.products.findIndex(p => p.id === productId);
    if (pIndex === -1) {
      Toast.show('Desculpe, ocorreu um erro na leitura do inventário.', 'error');
      return;
    }

    if (Inventory.products[pIndex].qtd < qtdSold) {
      Toast.show(`Quantidade solicitada excede o estoque limite de ${Inventory.products[pIndex].qtd}.`, 'error');
      return;
    }

    // 2. Transact (Deduct from inventory base)
    const newQtd = Inventory.products[pIndex].qtd - qtdSold;
    const { error: invError } = await AppSupabase.from('inventory').update({ qtd: newQtd }).eq('id', productId);
    
    if (invError) {
      Toast.show('Erro ao deduzir o estoque.', 'error');
      return;
    }

    await Inventory.load();
    Inventory.render();

    // 3. Record Sale directly to Supabase
    const { error: saleError } = await AppSupabase.from('sales').insert([{
      product_id: productId,
      product_name: Inventory.products[pIndex].name,
      buyer_name: buyerName,
      seller_name: sellerName,
      qtd_sold: qtdSold,
      payment_method: paymentMethod
    }]);

    if(saleError) {
      Toast.show('Venda não autorizada pelo banco de dados.', 'error');
      return;
    }

    await Sales.load();
    Sales.render();

    Toast.show(`Venda registrada com sucesso!`, 'success');
    document.getElementById('modal-sell-product').classList.remove('active');
  }
};

// Initialization is managed by App.showApp async flow
