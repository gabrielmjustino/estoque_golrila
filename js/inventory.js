// Gerenciador da aba de Estoque
const Inventory = {
  products: [],

  init: async () => {
    await Inventory.load();
    Inventory.render();
    Inventory.setupEventListeners();
  },

  load: async () => {
    const { data, error } = await AppSupabase.from('inventory').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      Inventory.products = data;
    } else if (error) {
      console.error('Erro ao carregar estoque do Supabase', error);
    }
  },

  render: () => {
    const tbody = document.getElementById('inventory-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (Inventory.products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem;">Nenhum produto cadastrado no estoque atualmente.</td></tr>`;
      return;
    }

    // Sort is handled by Supabase order('created_at', {ascending: false})
    const sortedProducts = Inventory.products;

    sortedProducts.forEach(prod => {
      const tr = document.createElement('tr');
      // Highlight low stock (<= 5)
      const qtdClass = prod.qtd <= 5 ? 'tag qtd danger' : 'tag qtd';
      
      const photoHtml = prod.photo ? `<img src="${prod.photo}" alt="Foto" style="width: 40px; height: 40px; object-fit: cover; border-radius: 8px;">` : `<div style="width: 40px; height: 40px; background: var(--bg-surface-light); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--text-muted);"><i class='bx bx-image-alt'></i></div>`;

      tr.innerHTML = `
        <td style="color: var(--text-muted); font-family: monospace;">#${prod.id.slice(0, 6).toUpperCase()}</td>
        <td>${photoHtml}</td>
        <td style="font-weight: 500;">${prod.name}</td>
        <td><span class="tag">${prod.size}</span></td>
        <td><span class="tag">${prod.color}</span></td>
        <td><span class="${qtdClass}">${prod.qtd} uni.</span></td>
        <td>
          <button class="btn-icon edit" onclick="Inventory.openEditModal('${prod.id}')" title="Editar Produto"><i class='bx bx-pencil'></i></button>
          <button class="btn-icon sell" onclick="Inventory.openSellModal('${prod.id}')" title="Realizar Venda"><i class='bx bx-cart-add'></i></button>
          <button class="btn-icon delete" onclick="Inventory.deleteProduct('${prod.id}')" title="Remover do Sistema"><i class='bx bx-trash'></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  setupEventListeners: () => {
    // --- Modal: Adicionar Produto ---
    const modalAdd = document.getElementById('modal-add-product');
    const btnOpenAdd = document.getElementById('btn-open-add-modal');
    const btnCloseAdd = document.getElementById('close-add-modal');
    const btnCancelAdd = document.getElementById('cancel-add-modal');
    const formAdd = document.getElementById('form-add-product');
    const photoInput = document.getElementById('add-photo');

    let currentPhotoBase64 = '';

    if (photoInput) {
      photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          if (file.size > 2 * 1024 * 1024) {
            Toast.show('Por favor, escolha uma imagem menor que 2MB.', 'warning');
            photoInput.value = '';
            return;
          }
          const reader = new FileReader();
          reader.onload = (ev) => { currentPhotoBase64 = ev.target.result; };
          reader.readAsDataURL(file);
        } else {
          currentPhotoBase64 = '';
        }
      });
    }

    if (btnOpenAdd) btnOpenAdd.addEventListener('click', () => modalAdd.classList.add('active'));

    const closeAddModal = () => {
      modalAdd.classList.remove('active');
      formAdd.reset();
      currentPhotoBase64 = '';
    };

    if (btnCloseAdd) btnCloseAdd.addEventListener('click', closeAddModal);
    if (btnCancelAdd) btnCancelAdd.addEventListener('click', closeAddModal);
    if (modalAdd) modalAdd.addEventListener('click', (e) => { if (e.target === modalAdd) closeAddModal(); });

    if (formAdd) {
      formAdd.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('add-name').value;
        const photo = currentPhotoBase64;
        const qtd = parseInt(document.getElementById('add-qtd').value);
        const size = document.getElementById('add-size').value;
        const color = document.getElementById('add-color').value;
        Inventory.addProduct({ name, photo, qtd, size, color });
        Toast.show('Produto adicionado ao estoque!', 'success');
        closeAddModal();
      });
    }

    // --- Modal: Editar Produto ---
    const modalEdit = document.getElementById('modal-edit-product');
    const btnCloseEdit = document.getElementById('close-edit-modal');
    const btnCancelEdit = document.getElementById('cancel-edit-modal');
    const formEdit = document.getElementById('form-edit-product');
    const editPhotoInput = document.getElementById('edit-photo');
    const editPhotoPreview = document.getElementById('edit-photo-preview');

    let editPhotoBase64 = null; // null = não trocou foto

    if (editPhotoInput) {
      editPhotoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          if (file.size > 2 * 1024 * 1024) {
            Toast.show('Por favor, escolha uma imagem menor que 2MB.', 'warning');
            editPhotoInput.value = '';
            return;
          }
          const reader = new FileReader();
          reader.onload = (ev) => {
            editPhotoBase64 = ev.target.result;
            if (editPhotoPreview) editPhotoPreview.innerHTML = `<img src="${editPhotoBase64}" style="width:60px; height:60px; object-fit:cover; border-radius:8px; margin-top:4px;">`;
          };
          reader.readAsDataURL(file);
        } else {
          editPhotoBase64 = null;
        }
      });
    }

    const closeEditModal = () => {
      modalEdit.classList.remove('active');
      formEdit.reset();
      editPhotoBase64 = null;
      if (editPhotoPreview) editPhotoPreview.innerHTML = '';
    };

    if (btnCloseEdit) btnCloseEdit.addEventListener('click', closeEditModal);
    if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeEditModal);
    if (modalEdit) modalEdit.addEventListener('click', (e) => { if (e.target === modalEdit) closeEditModal(); });

    if (formEdit) {
      formEdit.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-product-id').value;
        const name = document.getElementById('edit-name').value;
        const qtd = parseInt(document.getElementById('edit-qtd').value);
        const size = document.getElementById('edit-size').value;
        const color = document.getElementById('edit-color').value;

        const updateData = { name, qtd, size, color };
        if (editPhotoBase64 !== null) updateData.photo = editPhotoBase64;

        await Inventory.updateProduct(id, updateData);
        closeEditModal();
      });
    }
  },

  openEditModal: (id) => {
    const prod = Inventory.products.find(p => p.id === id);
    if (!prod) return;

    document.getElementById('edit-product-id').value = prod.id;
    document.getElementById('edit-name').value = prod.name;
    document.getElementById('edit-qtd').value = prod.qtd;
    document.getElementById('edit-size').value = prod.size || '';
    document.getElementById('edit-color').value = prod.color || '';

    const preview = document.getElementById('edit-photo-preview');
    if (preview) {
      preview.innerHTML = prod.photo
        ? `<img src="${prod.photo}" style="width:60px; height:60px; object-fit:cover; border-radius:8px; margin-top:4px;" title="Foto atual">`
        : '<span style="font-size:0.75rem; color:var(--text-muted);">Sem foto atual</span>';
    }

    document.getElementById('modal-edit-product').classList.add('active');
  },

  updateProduct: async (id, data) => {
    const { error } = await AppSupabase.from('inventory').update(data).eq('id', id);
    if (!error) {
      await Inventory.load();
      Inventory.render();
      Toast.show('Produto atualizado com sucesso!', 'success');
    } else {
      console.error(error);
      Toast.show('Erro ao atualizar produto.', 'error');
    }
  },

  addProduct: async (data) => {
    const { error } = await AppSupabase.from('inventory').insert([{
      name: data.name,
      photo: data.photo || '',
      qtd: data.qtd,
      size: data.size,
      color: data.color
    }]);

    if (!error) {
      await Inventory.load();    // Sync state
      Inventory.render();  // Atualiza Table Visual
    } else {
      console.error(error);
      Toast.show('Falha ao inserir via banco Supabase', 'error');
    }
  },

  deleteProduct: async (id) => {
    if (confirm('Atenção: Tem certeza que deseja excluir esse produto do banco permanentemente?')) {
      const { error } = await AppSupabase.from('inventory').delete().eq('id', id);
      if (!error) {
        await Inventory.load();
        Inventory.render();
        Toast.show('Produto removido.', 'info');
      } else {
        Toast.show('Erro ao remover do banco.', 'error');
      }
    }
  },

  // Encaminha para o módulo sales.js (a implementar a seguir)
  openSellModal: (id) => {
    if (typeof Sales !== 'undefined') {
      Sales.openSellModal(id);
    } else {
      Toast.show('Módulo de vendas está sendo construído...', 'warning');
    }
  }
};

// Initialization is now managed by app.js (showApp function)
