// Gerenciador da aba de Vendas e Saídas
const Sales = {
  history: [],

  init: () => {
    Sales.load();
    Sales.render();
    Sales.setupEventListeners();
  },

  load: () => {
    Sales.history = Storage.get('nexus_sales', []);
  },

  save: () => {
    Storage.set('nexus_sales', Sales.history);
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

    // Sort by Date descending (newest sales first)
    const sortedSales = [...Sales.history].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedSales.forEach(sale => {
      const dateObj = new Date(sale.date);
      const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const tr = document.createElement('tr');
      
      tr.innerHTML = `
        <td style="color: var(--text-muted); font-size: 0.85rem;">${formattedDate}</td>
        <td style="font-weight: 500;">${sale.productName}</td>
        <td><span class="tag qtd danger">-${sale.qtdSold} uni.</span></td>
        <td><i class='bx bx-user' style="color:var(--text-muted); margin-right:4px;"></i> ${sale.buyerName}</td>
        <td><i class='bx bxs-badge-check' style="color:var(--primary); margin-right:4px;"></i> ${sale.sellerName}</td>
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

        Sales.processSale(productId, buyerName, sellerName, qtdSold);
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

  cancelSale: (saleId) => {
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
    const pIndex = Inventory.products.findIndex(p => p.id === sale.productId);
    if (pIndex !== -1) {
      Inventory.products[pIndex].qtd += sale.qtdSold;
      Inventory.save();
      Inventory.render();
    } else {
      // Caso o produto original tenha sido deletado inteiramente do sistema
      Toast.show('Aviso: O produto original foi excluído. Venda removida sem devolver o estoque.', 'warning');
    }

    // Remove sale history
    Sales.history.splice(saleIndex, 1);
    Sales.save();
    Sales.render();

    // Trigger Admin refresh if loaded
    if (typeof Admin !== 'undefined' && Admin.renderStats) {
      Admin.renderStats();
    }

    Toast.show('Venda cancelada com sucesso.', 'info');
  },

  processSale: (productId, buyerName, sellerName, qtdSold) => {
    // 1. Find product
    const pIndex = Inventory.products.findIndex(p => p.id === productId);
    if (pIndex === -1) {
      Toast.show('Desculpe, ocorreu um erro na leitura do inventário.', 'error');
      return;
    }

    if (Inventory.products[pIndex].qtd < qtdSold) {
      Toast.show(`Quantidade solicitada excede o estoque limite de ${Inventory.products[pIndex].qtd}.`, 'error');
      return;
    }

    // 2. Transact (Deduct from inventory)
    Inventory.products[pIndex].qtd -= qtdSold;
    
    // If quantity hits exactly 0, one might choose to keep it in DB as history, so we don't delete it.
    Inventory.save();    // Salva estoque
    Inventory.render();  // Atualiza UI de estoque

    // 3. Record Sale
    const saleRecord = {
      id: 'sale_' + Date.now().toString(36),
      productId: productId,
      productName: Inventory.products[pIndex].name,
      buyerName: buyerName,
      sellerName: sellerName,
      qtdSold: qtdSold,
      date: new Date().toISOString()
    };

    Sales.history.push(saleRecord);
    Sales.save();   // Salva histórico de vendas
    Sales.render(); // Atualiza UI de histórico

    Toast.show(`Venda de ${qtdSold}x ${saleRecord.productName} registrada com sucesso!`, 'success');
    document.getElementById('modal-sell-product').classList.remove('active');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('sold-tbody')) {
    Sales.init();
  }
});
