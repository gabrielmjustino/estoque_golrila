// Gerenciador da aba de Estoque
const Inventory = {
  products: [],

  init: async () => {
    await Inventory.load();
    Inventory.render();
    Inventory.setupEventListeners();
    Inventory.ensureSortOrder(); // garante sort_order no banco se ainda não existir
  },

  // Lightweight load — ordena por sort_order, fallback para created_at
  load: async () => {
    const { data, error } = await AppSupabase
      .from('inventory')
      .select('id, name, qtd, size, color, photo, created_at, sort_order, stock_status, qtd_julio, qtd_justino')
      .order('sort_order', { ascending: true, nullsFirst: false });

    if (!error && data) {
      // Se alguns produtos não têm sort_order ainda, eles vêm no final; preserve a ordem
      Inventory.products = data;
    } else if (error) {
      // Fallback: se a coluna sort_order não existir ainda, carrega sem ela
      const { data: fallback, error: err2 } = await AppSupabase
        .from('inventory')
        .select('id, name, qtd, size, color, photo, created_at, stock_status, qtd_julio, qtd_justino')
        .order('created_at', { ascending: false });

      if (!err2 && fallback) {
        Inventory.products = fallback;
      } else {
        console.error('Erro ao carregar estoque do Supabase', err2);
      }
    }
  },

  // Garante que todos os produtos tenham sort_order definido
  ensureSortOrder: async () => {
    const sem = Inventory.products.filter(p => p.sort_order == null);
    if (sem.length === 0) return;

    // Descobre o maior sort_order existente
    let maxOrder = Inventory.products.reduce((max, p) => {
      return (p.sort_order != null && p.sort_order > max) ? p.sort_order : max;
    }, 0);

    for (const p of sem) {
      maxOrder++;
      await AppSupabase.from('inventory').update({ sort_order: maxOrder }).eq('id', p.id);
      p.sort_order = maxOrder;
    }
  },

  render: () => {
    const tbody = document.getElementById('inventory-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Atualiza o card de total de produtos em estoque
    const totalQtyEl = document.getElementById('inventory-stat-total-qty');
    if (totalQtyEl) {
      const totalQty = Inventory.products.reduce((sum, p) => sum + (p.qtd || 0), 0);
      totalQtyEl.textContent = totalQty;
    }

    if (Inventory.products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 3rem;">Nenhum produto cadastrado no estoque atualmente.</td></tr>`;
      return;
    }

    const fragment = document.createDocumentFragment();

    Inventory.products.forEach(prod => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-id', prod.id);
      tr.setAttribute('draggable', 'true');

      const qtdClass = prod.qtd <= 5 ? 'tag qtd danger' : 'tag qtd';

      const photoHtml = prod.photo
        ? `<img src="${prod.photo}" alt="${prod.name}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-color);">`
        : `<div style="width: 40px; height: 40px; background: var(--bg-surface-light); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--text-muted);"><i class='bx bx-image-alt'></i></div>`;

      // Stock status badge
      const stockMap = {
        em_estoque: { icon: 'bx-check-shield', text: 'Em Estoque', cls: 'stock-ok' },
        aguardando:  { icon: 'bx-time',         text: 'A Caminho',  cls: 'stock-waiting' },
        incerto:     { icon: 'bx-question-mark', text: 'Incerto',    cls: 'stock-uncertain' },
      };
      const sInfo = stockMap[prod.stock_status] || stockMap['em_estoque'];
      const stockBadge = `<span class="stock-badge ${sInfo.cls}"><i class='bx ${sInfo.icon}'></i> ${sInfo.text}</span>`;

      tr.innerHTML = `
        <td class="drag-handle-cell">
          <span class="drag-handle" title="Arraste para reordenar">
            <i class='bx bx-grid-vertical'></i>
          </span>
        </td>
        <td style="color: var(--text-muted); font-family: monospace;">#${prod.id.slice(0, 6).toUpperCase()}</td>
        <td>${photoHtml}</td>
        <td style="font-weight: 500;">${prod.name}</td>
        <td><span class="tag">${prod.size || '—'}</span></td>
        <td><span class="tag">${prod.color || '—'}</span></td>
        <td><span class="${qtdClass}">${prod.qtd} uni.</span></td>
        <td><span class="tag qtd-person">${prod.qtd_julio ?? 0}</span></td>
        <td><span class="tag qtd-person">${prod.qtd_justino ?? 0}</span></td>
        <td>${stockBadge}</td>
        <td>
          <button class="btn-icon edit"    onclick="Inventory.openEditModal('${prod.id}')"    title="Editar Produto"><i class='bx bx-pencil'></i></button>
          <button class="btn-icon sell"    onclick="Inventory.openSellModal('${prod.id}')"    title="Realizar Venda"><i class='bx bx-cart-add'></i></button>
          <button class="btn-icon reserve" onclick="Inventory.openReserveModal('${prod.id}')" title="Criar Reserva"><i class='bx bx-bookmark'></i></button>
          <button class="btn-icon delete"  onclick="Inventory.deleteProduct('${prod.id}')"   title="Remover do Sistema"><i class='bx bx-trash'></i></button>
        </td>
      `;
      fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);

    // Inicializa drag & drop após renderizar
    Inventory.initDragDrop(tbody);
  },

  // ===================== DRAG & DROP =====================
  _drag: {
    draggingEl: null,
    placeholder: null,
    startIndex: -1,
    saveTimeout: null,
  },

  initDragDrop: (tbody) => {
    const d = Inventory._drag;

    // Cria um placeholder estilizado (linha "fantasma")
    const createPlaceholder = () => {
      const ph = document.createElement('tr');
      ph.className = 'drag-placeholder';
      ph.innerHTML = `<td colspan="8"></td>`;
      return ph;
    };

    tbody.querySelectorAll('tr[draggable="true"]').forEach(row => {
      // ── Drag START ──────────────────────────────────────────────────
      row.addEventListener('dragstart', (e) => {
        d.draggingEl = row;
        d.startIndex = [...tbody.children].indexOf(row);

        // Snapshot fantasma: só o handle ativa o drag
        setTimeout(() => {
          row.classList.add('dragging');
        }, 0);

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', row.dataset.id);

        // Cria placeholder
        d.placeholder = createPlaceholder();
      });

      // ── Drag END ────────────────────────────────────────────────────
      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        if (d.placeholder && d.placeholder.parentNode) {
          d.placeholder.parentNode.removeChild(d.placeholder);
        }
        document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
          el.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        d.draggingEl = null;
        d.placeholder = null;
      });

      // ── Drag OVER ──────────────────────────────────────────────────
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!d.draggingEl || d.draggingEl === row) return;
        e.dataTransfer.dropEffect = 'move';

        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
          el.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        if (e.clientY < midY) {
          row.classList.add('drag-over-top');
        } else {
          row.classList.add('drag-over-bottom');
        }
      });

      row.addEventListener('dragleave', (e) => {
        if (!row.contains(e.relatedTarget)) {
          row.classList.remove('drag-over-top', 'drag-over-bottom');
        }
      });

      // ── DROP ────────────────────────────────────────────────────────
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!d.draggingEl || d.draggingEl === row) return;

        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const insertBefore = e.clientY < midY;

        if (insertBefore) {
          tbody.insertBefore(d.draggingEl, row);
        } else {
          row.after(d.draggingEl);
        }

        row.classList.remove('drag-over-top', 'drag-over-bottom');

        // Atualiza a ordem no array local e persiste no banco
        Inventory._updateOrderFromDOM(tbody);
      });
    });
  },

  // Lê a nova ordem do DOM e persiste no Supabase
  _updateOrderFromDOM: (tbody) => {
    const rows = [...tbody.querySelectorAll('tr[data-id]')];
    const newOrder = rows.map((row, idx) => ({
      id: row.dataset.id,
      sort_order: idx + 1,
    }));

    // Atualiza array local
    newOrder.forEach(({ id, sort_order }) => {
      const prod = Inventory.products.find(p => p.id === id);
      if (prod) prod.sort_order = sort_order;
    });

    // Re-ordena o array local para manter consistência
    Inventory.products.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    // Debounce: salva 400ms após o usuário parar de arrastar
    clearTimeout(Inventory._drag.saveTimeout);
    Inventory._drag.saveTimeout = setTimeout(async () => {
      await Inventory._persistOrder(newOrder);
    }, 400);
  },

  // Persiste a nova ordem no Supabase usando upsert em batch
  _persistOrder: async (orderList) => {
    const updates = orderList.map(({ id, sort_order }) =>
      AppSupabase.from('inventory').update({ sort_order }).eq('id', id)
    );

    const results = await Promise.all(updates);
    const hasError = results.some(r => r.error);

    if (hasError) {
      console.warn('Erro ao persistir ordem de arraste no Supabase. A ordem visual foi mantida.');
    }
    // Toast silencioso — não interrompe o fluxo do usuário
  },

  // ===================== EVENT LISTENERS =====================
  setupEventListeners: () => {
    // --- Modal: Adicionar Produto ---
    const modalAdd = document.getElementById('modal-add-product');
    const btnOpenAdd = document.getElementById('btn-open-add-modal');
    const btnCloseAdd = document.getElementById('close-add-modal');
    const btnCancelAdd = document.getElementById('cancel-add-modal');
    const formAdd = document.getElementById('form-add-product');
    const photoInput = document.getElementById('add-photo');

    // Guarda o File selecionado (não mais base64)
    let currentPhotoFile = null;

    if (photoInput) {
      photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          if (file.size > 5 * 1024 * 1024) {
            Toast.show('Por favor, escolha uma imagem menor que 5MB.', 'warning');
            photoInput.value = '';
            currentPhotoFile = null;
            return;
          }
          currentPhotoFile = file;

          // Preview local enquanto não faz upload
          const reader = new FileReader();
          reader.onload = (ev) => {
            const preview = document.getElementById('add-photo-preview');
            if (preview) preview.innerHTML = `<img src="${ev.target.result}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;margin-top:4px;">`;
          };
          reader.readAsDataURL(file);
        } else {
          currentPhotoFile = null;
        }
      });
    }

    if (btnOpenAdd) btnOpenAdd.addEventListener('click', () => modalAdd.classList.add('active'));

    const closeAddModal = () => {
      modalAdd.classList.remove('active');
      formAdd.reset();
      currentPhotoFile = null;
      const preview = document.getElementById('add-photo-preview');
      if (preview) preview.innerHTML = '';
    };

    if (btnCloseAdd) btnCloseAdd.addEventListener('click', closeAddModal);
    if (btnCancelAdd) btnCancelAdd.addEventListener('click', closeAddModal);
    if (modalAdd) modalAdd.addEventListener('click', (e) => { if (e.target === modalAdd) closeAddModal(); });

    if (formAdd) {
      formAdd.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name      = document.getElementById('add-name').value;
        const qtd       = parseInt(document.getElementById('add-qtd').value);
        const size      = document.getElementById('add-size').value;
        const color     = document.getElementById('add-color').value;
        const submitBtn = formAdd.querySelector('[type="submit"]');

        // → Captura e zera IMEDIATAMENTE para evitar re-uso em submits futuros
        const fileToUpload  = currentPhotoFile;
        currentPhotoFile    = null;

        let photoUrl = '';
        submitBtn.disabled = true;

        try {
          if (fileToUpload) {
            submitBtn.textContent = 'Enviando foto... 0%';
            photoUrl = await Cloudinary.upload(fileToUpload, (pct) => {
              submitBtn.textContent = `Enviando foto... ${pct}%`;
            });
          }

          submitBtn.textContent = 'Salvando...';
          await Inventory.addProduct({ name, photo: photoUrl, qtd, size, color });
          Toast.show('Produto adicionado ao estoque!', 'success');
          closeAddModal();
        } catch (err) {
          Toast.show('Erro: ' + (err.message || 'Falha ao salvar produto.'), 'error');
        } finally {
          // Sempre restaura o botão, independente de sucesso ou erro
          submitBtn.disabled = false;
          submitBtn.textContent = 'Salvar Produto';
        }
      });
    }

    // --- Modal: Editar Produto ---
    const modalEdit = document.getElementById('modal-edit-product');
    const btnCloseEdit = document.getElementById('close-edit-modal');
    const btnCancelEdit = document.getElementById('cancel-edit-modal');
    const formEdit = document.getElementById('form-edit-product');
    const editPhotoInput = document.getElementById('edit-photo');
    const editPhotoPreview = document.getElementById('edit-photo-preview');

    let editPhotoFile = null; // null = não trocou foto

    if (editPhotoInput) {
      editPhotoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          if (file.size > 5 * 1024 * 1024) {
            Toast.show('Por favor, escolha uma imagem menor que 5MB.', 'warning');
            editPhotoInput.value = '';
            return;
          }
          editPhotoFile = file;

          // Preview local antes do upload
          const reader = new FileReader();
          reader.onload = (ev) => {
            if (editPhotoPreview) editPhotoPreview.innerHTML = `<img src="${ev.target.result}" style="width:60px; height:60px; object-fit:cover; border-radius:8px; margin-top:4px;">`;
          };
          reader.readAsDataURL(file);
        } else {
          editPhotoFile = null;
        }
      });
    }

    const closeEditModal = () => {
      modalEdit.classList.remove('active');
      formEdit.reset();
      editPhotoFile = null;
      if (editPhotoPreview) editPhotoPreview.innerHTML = '';
      const delBtn = document.getElementById('btn-delete-photo');
      if (delBtn) delBtn.style.display = 'none';
    };

    if (btnCloseEdit) btnCloseEdit.addEventListener('click', closeEditModal);
    if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeEditModal);
    if (modalEdit) modalEdit.addEventListener('click', (e) => { if (e.target === modalEdit) closeEditModal(); });

    // --- Botão: Apagar Foto ---
    const btnDeletePhoto = document.getElementById('btn-delete-photo');
    if (btnDeletePhoto) {
      btnDeletePhoto.addEventListener('click', async () => {
        if (!confirm('Tem certeza que deseja remover a foto deste produto?')) return;

        const id = document.getElementById('edit-product-id').value;
        btnDeletePhoto.disabled = true;
        btnDeletePhoto.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Removendo...`;

        const { error } = await AppSupabase.from('inventory').update({ photo: '' }).eq('id', id);

        if (!error) {
          // Atualiza cache local
          const prod = Inventory.products.find(p => p.id === id);
          if (prod) prod.photo = '';

          if (editPhotoPreview) editPhotoPreview.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted);">Sem foto atual</span>';
          btnDeletePhoto.style.display = 'none';
          editPhotoFile = null;
          Toast.show('Foto removida com sucesso.', 'info');
          Inventory.render(); // Atualiza a linha na tabela
        } else {
          Toast.show('Erro ao remover foto.', 'error');
        }

        btnDeletePhoto.disabled = false;
        btnDeletePhoto.innerHTML = `<i class='bx bx-trash'></i> Apagar Foto`;
      });
    }

    if (formEdit) {
      formEdit.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id    = document.getElementById('edit-product-id').value;
        const name  = document.getElementById('edit-name').value;
        const qtd   = parseInt(document.getElementById('edit-qtd').value);
        const size  = document.getElementById('edit-size').value;
        const color = document.getElementById('edit-color').value;
        const qtdJulio   = parseInt(document.getElementById('edit-qtd-julio')?.value) || 0;
        const qtdJustino = parseInt(document.getElementById('edit-qtd-justino')?.value) || 0;
        const stockStatus = document.getElementById('edit-stock-status')?.value || 'em_estoque';
        const editSubmitBtn = formEdit.querySelector('[type="submit"]');

        // Validação: cada pessoa não pode ter mais do que o estoque total
        if (qtdJulio > qtd) {
          Toast.show(`Qtd. do Júlio (${qtdJulio}) não pode ser maior que o estoque total (${qtd}).`, 'warning');
          return;
        }
        if (qtdJustino > qtd) {
          Toast.show(`Qtd. do Justino (${qtdJustino}) não pode ser maior que o estoque total (${qtd}).`, 'warning');
          return;
        }
        // Validação: a SOMA não pode ultrapassar o total
        if (qtdJulio + qtdJustino > qtd) {
          Toast.show(`A soma Júlio (${qtdJulio}) + Justino (${qtdJustino}) = ${qtdJulio + qtdJustino} não pode ultrapassar o estoque total (${qtd}).`, 'warning');
          return;
        }

        // → Captura e zera IMEDIATAMENTE para evitar re-uso em submits futuros
        const fileToUpload = editPhotoFile;
        editPhotoFile      = null;

        const updateData = { name, qtd, size, color, stock_status: stockStatus, qtd_julio: qtdJulio, qtd_justino: qtdJustino };
        editSubmitBtn.disabled = true;

        try {
          if (fileToUpload !== null) {
            editSubmitBtn.textContent = 'Enviando foto... 0%';
            const url = await Cloudinary.upload(fileToUpload, (pct) => {
              editSubmitBtn.textContent = `Enviando foto... ${pct}%`;
            });
            updateData.photo = url;
          }

          editSubmitBtn.textContent = 'Salvando...';
          await Inventory.updateProduct(id, updateData);
          closeEditModal();
        } catch (err) {
          Toast.show('Erro: ' + (err.message || 'Falha ao atualizar produto.'), 'error');
        } finally {
          editSubmitBtn.disabled = false;
          editSubmitBtn.textContent = 'Salvar Alterações';
        }
      });
    }
  },

  // Opens edit modal — fetches photo only for this one product
  openEditModal: async (id) => {
    const prod = Inventory.products.find(p => p.id === id);
    if (!prod) return;

    document.getElementById('edit-product-id').value = prod.id;
    document.getElementById('edit-name').value = prod.name;
    document.getElementById('edit-qtd').value = prod.qtd;
    document.getElementById('edit-size').value = prod.size || '';
    document.getElementById('edit-color').value = prod.color || '';
    const julioEl = document.getElementById('edit-qtd-julio');
    if (julioEl) {
      julioEl.value = prod.qtd_julio ?? 0;
      julioEl.max   = prod.qtd;
      julioEl.title = `Máximo: ${prod.qtd} (total em estoque)`;
    }
    const justinoEl = document.getElementById('edit-qtd-justino');
    if (justinoEl) {
      justinoEl.value = prod.qtd_justino ?? 0;
      justinoEl.max   = prod.qtd;
      justinoEl.title = `Máximo: ${prod.qtd} (total em estoque)`;
    }
    // Inicializa os hints de máximo
    const hjEl = document.getElementById('edit-julio-hint');
    if (hjEl) hjEl.textContent = `Máx: ${prod.qtd}`;
    const hjnEl = document.getElementById('edit-justino-hint');
    if (hjnEl) hjnEl.textContent = `Máx: ${prod.qtd}`;
    const stockSel = document.getElementById('edit-stock-status');
    if (stockSel) stockSel.value = prod.stock_status || 'em_estoque';

    // Garante que o botão começa oculto até confirmar se há foto
    const delBtn = document.getElementById('btn-delete-photo');
    if (delBtn) delBtn.style.display = 'none';

    document.getElementById('modal-edit-product').classList.add('active');

    // Fetch photo lazily for this specific product
    const preview = document.getElementById('edit-photo-preview');
    if (preview) {
      preview.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted);">Carregando foto...</span>';
      const { data } = await AppSupabase.from('inventory').select('photo').eq('id', id).single();
      if (data && data.photo) {
        preview.innerHTML = `<img src="${data.photo}" style="width:60px; height:60px; object-fit:cover; border-radius:8px;" title="Foto atual">`;
        // Mostra o botão de apagar somente quando há foto
        if (delBtn) delBtn.style.display = 'inline-flex';
      } else {
        preview.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted);">Sem foto atual</span>';
      }
    }
  },

  updateProduct: async (id, data) => {
    const { error } = await AppSupabase.from('inventory').update(data).eq('id', id);
    if (!error) {
      // Always propagate current name to sales and reservations (SECURITY DEFINER bypasses RLS)
      const { error: rpcError } = await AppSupabase.rpc('propagate_product_name', {
        p_product_id: id,
        p_new_name: data.name
      });

      if (rpcError) {
        console.warn('Erro ao propagar nome via RPC:', rpcError);
      } else {
        // Refresh Sales and Reservations lists if already loaded
        if (typeof Sales !== 'undefined' && Sales.load) {
          await Sales.load();
          Sales.render();
        }
        if (typeof Reservations !== 'undefined' && Reservations.load) {
          await Reservations.load();
          Reservations.render();
        }
      }

      await Inventory.load();
      Inventory.render();
      Toast.show('Produto atualizado com sucesso!', 'success');
    } else {
      console.error('Supabase update error:', error);
      // Lança exceção para o handler fechar o modal apenas em sucesso
      throw new Error(error.message || 'Falha ao atualizar produto no banco.');
    }
  },

  addProduct: async (data) => {
    // Novo produto vai para o TOPO (sort_order = 0 e reordena os demais)
    const maxOrder = Inventory.products.length > 0
      ? Math.max(...Inventory.products.map(p => p.sort_order || 0))
      : 0;

    const { error } = await AppSupabase.from('inventory').insert([{
      name: data.name,
      photo: data.photo || '',
      qtd: data.qtd,
      size: data.size,
      color: data.color,
      sort_order: maxOrder + 1,
      qtd_julio: 0,
      qtd_justino: 0,
    }]);

    if (!error) {
      await Inventory.load();
      Inventory.render();
    } else {
      console.error(error);
      Toast.show('Falha ao inserir via banco Supabase', 'error');
    }
  },

  deleteProduct: async (id) => {
    if (confirm('Atenção: Tem certeza que deseja excluir esse produto do banco permanentemente?')) {
      const { error } = await AppSupabase.from('inventory').delete().eq('id', id);
      if (!error) {
        // Optimistic local update
        Inventory.products = Inventory.products.filter(p => p.id !== id);
        Inventory.render();
        Toast.show('Produto removido.', 'info');
      } else {
        Toast.show('Erro ao remover do banco.', 'error');
      }
    }
  },

  // Encaminha para o módulo sales.js
  openSellModal: (id) => {
    if (typeof Sales !== 'undefined') {
      Sales.openSellModal(id);
    } else {
      Toast.show('Módulo de vendas está sendo construído...', 'warning');
    }
  },

  // Encaminha para o módulo reservations.js
  openReserveModal: (id) => {
    if (typeof Reservations !== 'undefined') {
      Reservations.openReserveModal(id);
    } else {
      Toast.show('Módulo de reservas está sendo construído...', 'warning');
    }
  }
};

// Initialization is now managed by app.js (showApp function)
